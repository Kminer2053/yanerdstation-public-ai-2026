import fs from 'node:fs';
import crypto from 'node:crypto';
import {makeFocus} from '../src/route-review-core.js';

// Input is a previously reviewed pool; do not rewrite original counts or reference coordinates.
const poolFile=process.argv[2];
if(!poolFile)throw Error('Usage: node tools/build_origin_entry_review.mjs /absolute/path/pool.json');
const raw=fs.readFileSync(poolFile),pool=JSON.parse(raw);
const registerFile=new URL('../public/data/route-review/register.json',import.meta.url);
const registerRaw=fs.readFileSync(registerFile),{register}=JSON.parse(registerRaw);
const nodes=new Map(register.priority_nodes.map(p=>[p.review_id,p]));
const east=['G1','G2','W-E','O-3390512293'];
const northEast=['G2','G1','W-E','O-3390512293'];
const west=['G3','W-W','O-3403067566'];
const busWest=new Set(['02102','02103','02104','02105','02106','03124','03125','03228','03345']);
const busNorth=new Set(['02117','02123','02505','02685','02694']);
const fixed={
  'STN-SEOUL-SUBWAY-L1':['M-G-075872','M-G-075873','M-G-075893'],
  'STN-SEOUL-SUBWAY-L4':['M-G-073650','M-G-073649','M-G-075893'],
  'STN-SEOUL-AREX':['A-G-076224','A-G-076227','A-G-076225','A-G-076246','T-G-077010','T-G-077004','T-G-077009','T-G-077003'],
  'STN-SEOUL-RAIL':['R-ES-074971','R-ES-074969','R-ES-074970','R-ES-074965','R-ES-074964','R-ES-074958'],
  'STN-SEOUL-GTX':[], 'STN-SEOUL-GYEONGUI':[],
};
const modes={BUS:'버스',PARKING:'주차',SUBWAY:'지하철·광역철도',GTX:'GTX',RAIL:'KTX·일반철도'};
const origins=pool.origins.map(o=>{
  let ids=fixed[o.origin_id];
  if(o.origin_type==='BUS'){
    const ars=o.origin_id.split('-').at(-1);
    ids=busWest.has(ars)?west:busNorth.has(ars)?northEast:east;
  }
  if(o.origin_type==='PARKING')ids=['PKG-011','PKG-019'].includes(o.origin_id)?[...west,'G2']:northEast;
  if(!ids)throw Error('No explicit review policy: '+o.origin_id);
  const hourly=!['GTX','PARKING'].includes(o.origin_type);
  const transport=o.origin_type==='BUS'||o.origin_type==='PARKING';
  const reason=!ids.length?'통계 대표 좌표만 확보. 실제 접속부의 층·문턱은 미확인입니다.':transport?
    '원점의 동·서측 접근 방향에 따른 역사 출입문 검토안입니다. 실제 보행출구·횡단보도·통행 연결은 미검수이며, 지하철 직접 진입은 별도 대안입니다.':
    '기존 개찰·시설 POI에 근거한 접속부 검토안입니다. 유료구역, 정확한 문턱·랜딩, 상대 연결층은 현장에서 확인해야 합니다.';
  return {id:o.origin_id,name:o.origin_name,type:o.origin_type,mode_label:modes[o.origin_type],
    source_location:{longitude:o.longitude,latitude:o.latitude,reference_only:true,locator_ids:o.locator_ids},
    entry_ids:ids.map(id=>'ENTRY-'+id),review_first_entry_id:ids.length?'ENTRY-'+ids[0]:null,
    status:ids.length?'candidate_unverified':'boundary_missing',roles:['origin','destination'],
    user_approved:false,routing_enabled:false,allocation_weight:null,pedestrian_exit:null,
    hourly_status:hourly?'available':'missing',
    hourly_note:hourly?'기존 2026.07 대상 시간별 자료 유지 · 관측/산출/추정/대체 분류 보존':'시간대 미확보 · 추정기준 검토 중, 0명으로 처리하지 않음',
    series_ids:o.series_ids,provenance:o.provenance,reason,
    checks:o.origin_type==='PARKING'?'주차장 보행출구·일반 이용 가능 여부·역사 방문 비율·중복 그룹 확인':
      o.origin_type==='RAIL'?'승강장 번호별 ES 대응·하차/승차 동선 확인':
      o.origin_id==='STN-SEOUL-AREX'?'모델 B3와 운영 층명 구분·일반/직통 및 환승 개찰 범위 확인':'검토 후보는 필수 경유 순서나 인원 배분율이 아님'};
});
const sourceIds=[...new Set(origins.flatMap(o=>o.entry_ids.map(id=>id.slice(6))))];
const entries=sourceIds.map(id=>{
  const point=nodes.get(id);if(!point)throw Error('Unknown source point: '+id);
  const focus=makeFocus(point);
  return {id:'ENTRY-'+id,source_review_id:id,label:point.label,point,
    map_eligible:!!focus&&!focus.referenceOnly,
    boundary_type:id.startsWith('R-ES')?'landing_candidate':id.startsWith('T-G')?'transfer_gate':'entry_candidate',
    origin_ids:origins.filter(o=>o.entry_ids.includes('ENTRY-'+id)).map(o=>o.id),
    user_approved:false,routing_enabled:false,allocation_weight:null};
});
const data={schema_version:1,site:'S202103',target_period:'2026-07',status:'candidate_review',
  routing_enabled:false,demand_allocation_enabled:false,origins,entries,
  provenance:{pool_sha256:crypto.createHash('sha256').update(raw).digest('hex'),register_sha256:crypto.createHash('sha256').update(registerRaw).digest('hex'),
    pool_artifact:'20260916_daily_origin_pool_d9ccb5ff/pool.json',basis:'2026-09-16 user-approved entry-hourly-estimation-review.md'},
  hourly:{new_values_generated:false,source_artifact:'20260915_date_hour_footfall_69fd8c29/14_date_hour_flow.csv',
    source_summary:{origins:28,included_passenger_rows:48984,included_monthly_events:12410020,missing_origins:20},
    note:'운행일 기준. 경기버스는 2025년 같은 월일 대체, 자정 이월 보존. 고유 방문자나 역사 진입 인원이 아닙니다.'},
  models:{
    gtx:{numeric_finalized:false,status:'anchor_missing',formula:'서울역 동일 단위 기준량 × 동구간 성장률 × 요일·방향별 시간분포',
      note:'기존 14,300건/평일은 집계 범위가 다른 비중을 곱한 임시값. 기준량 확보 전 확정하지 않음. 경의선과 1호선 시간분포를 대체 시나리오로 비교.',
      sources:['https://www.korea.kr/news/policyNewsView.do?newsId=148941217']},
    parking:{numeric_finalized:false,status:'calibration_pending',formula:'주차면수 × 실효 일 회전수 × 차량당 동행인원 × 서울역 방문 비율',
      note:'19개 잠정 그룹. 주차장 자체 이용객과 역사 진입자 구분. 회전수/시간분포 보정 전이며 출차·왕복 총량은 미상. 입차를 그대로 복제하지 않음.',
      sources:['https://www.data.go.kr/data/15090908/fileData.do','https://www.data.go.kr/data/15090926/fileData.do']}
  }};
fs.writeFileSync(new URL('../public/data/route-review/origin-entries.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
console.log(`48 origins: ${origins.filter(o=>o.entry_ids.length).length} with candidates, ${entries.filter(e=>e.map_eligible).length} shared map points, ${origins.filter(o=>!o.entry_ids.length).length} unresolved boundaries`);

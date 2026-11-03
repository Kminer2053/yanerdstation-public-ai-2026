import {validGeometry} from './point-review-core.js';

const pending={user_approved:false,routing_enabled:false,review_status:'draft_unverified'};
export function routeDraft({id,label,point_ids,kind='walk',direction='both'},points){
  if(typeof id!=='string'||!id||id.length>120)throw Error('경로 ID를 확인하세요.');
  if(typeof label!=='string'||!label.trim()||label.length>120)throw Error('경로 이름은 1~120자로 입력하세요.');
  if(!Array.isArray(point_ids)||point_ids.length<2||point_ids.length>200||new Set(point_ids).size!==point_ids.length)throw Error('서로 다른 이동점 2~200개를 순서대로 선택하세요.');
  const byId=new Map(points.map(p=>[p.review_id,p]));
  const selected=point_ids.map(id=>byId.get(id));
  if(selected.some(p=>p?.record_kind!=='walk_point'||p.geometry?.type!=='Point'||!validGeometry(p.geometry)))throw Error('실제 좌표가 있는 바닥·계단 이동점만 연결할 수 있습니다.');
  if(!['walk','stairs','escalator','elevator'].includes(kind)||!['both','forward'].includes(direction))throw Error('연결 종류 또는 방향을 확인하세요.');
  const floors=new Set(selected.map(p=>p.floor));
  if(kind==='walk'&&floors.size!==1)throw Error('일반 경로는 같은 층에서 연결하세요. 층간 이동은 연결 종류를 지정하세요.');
  if(kind!=='walk'&&(selected.length!==2||floors.size!==2))throw Error('층간 연결은 서로 다른 층의 랜딩 두 점을 선택하세요.');
  return {id,label:label.trim(),point_ids:[...point_ids],kind,direction,...pending};
}
export function entryBinding(entry_id,point_id,entries,points){
  const entry=entries.find(e=>e.id===entry_id),point=points.find(p=>p.review_id===point_id);
  if(!entry?.map_eligible||!entry.point.floor)throw Error('층이 확인된 역사 진입 후보를 선택하세요. 외부 발생원은 지도에 배치하지 않습니다.');
  if(point?.record_kind!=='walk_point'||point.floor!==entry.point.floor||!validGeometry(point.geometry))throw Error('진입 후보와 같은 층의 바닥·계단 이동점을 선택하세요.');
  return {entry_id,point_id,floor:point.floor,geometry:point.geometry,...pending};
}
export function importRouteConfiguration(payload,{grid,entries,points}){
  const d=payload.route_configuration;
  if(!d)return {routes:[],entry_bindings:[]};
  if(d.schema_version!==1||payload.site!=='S202103'||payload.source_revision!==grid?.source_revision)throw Error('경로 검토안의 역사 또는 격자 버전이 다릅니다.');
  if(!Array.isArray(d.routes)||d.routes.length>100||!Array.isArray(d.entry_bindings)||d.entry_bindings.length>100)throw Error('경로 검토안 개수/형식이 올바르지 않습니다.');
  const routes=d.routes.map(r=>routeDraft(r,points));
  const entry_bindings=d.entry_bindings.map(b=>entryBinding(b.entry_id,b.point_id,entries,points));
  if(new Set(routes.map(r=>r.id)).size!==routes.length||new Set(entry_bindings.map(b=>b.entry_id)).size!==entry_bindings.length)throw Error('중복된 경로 또는 진입점 연결이 있습니다.');
  return {routes,entry_bindings};
}

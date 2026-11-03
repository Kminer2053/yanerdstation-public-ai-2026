// Read-only source extraction. Emits a sanitized JSON register on stdout.
// Usage: bundled-node tools/build_destination_register.mjs <project root>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { isRetiredS38Slot } from '../app/seoul-s38-retirement.js';
import { isRetiredPergolaSlot } from '../app/seoul-pergola-retirement.js';
import { isRetiredLoungeSlot } from '../app/seoul-lounge-retirement.js';
import { isRetiredLoungeSignBodySlot } from '../app/seoul-lounge-sign-retirement.js';
import { isRetiredInformationCenterSlot } from '../app/seoul-information-center.js';
import { isRetiredPlatform111Replacement } from '../app/seoul-platform111-retirement.js';
import { RETIRED_INFORMATION_SHOP_SLOTS, INFORMATION_FACILITIES } from '../app/seoul-information-zone.js';
import { S11_RETIRED_SIGN } from '../app/seoul-s11-booths.js';

const root=process.argv[2];
if(!root)throw Error('Source project root required');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,'outputs',p),'utf8'));
const slots=new Map(), names=new Map(), sources=new Set();
function consume(file, value=read(file)) {
  sources.add(file);
  const rows=Array.isArray(value)?value:value.slots||value.rows||value.new_rows||(value.slot?[value.slot]:value.slot_key?[value]:[]);
  for(const s of rows){
    if(!s.slot_key)continue;
    slots.set(s.slot_key,{...slots.get(s.slot_key),...s,sourceFile:file});
    // Only the current snapshot's approved active version; drafts are not names.
    const versions=(s.versions||value.versions?.filter(v=>v.slot_key===s.slot_key)||[])
      .filter(v=>v.is_active&&v.review_status==='approved').sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));
    if(versions[0]?.current_store_name)names.set(s.slot_key,{label:versions[0].current_store_name,sourceFile:file});
    else if((s.versions||value.versions)&&(!versions.length||Object.hasOwn(versions[0],'current_store_name')))names.delete(s.slot_key);
  }
}
consume('20260831_vworld_seoul_image_catalog/object-texture-slots.json');
// Existing registered app asset (migration 202609080002), not a new placement.
consume('existing TRUEDAN catalog migration',[{slot_key:'7afba516acfae10344297172e7c5c80368d4d3d43b140a71a14ccedc208852bc',
  site_id:'S202103',is_active:true,slot_alias:'TRUEDAN-FRONT-S01',source_kind:'app_asset',target_asset_id:'SEOUL-2F-TRUEDAN',
  target_surface_id:'front-facade',model_name:'TRUEDAN-FACADE',object_label:'TRUEDAN',floor:'2F',
  longitude:126.97100863065477,latitude:37.553635989133866,height_m:37.802389414049685,
  camera_heading_deg:352.785094421892,surface_width_m:6,surface_height_m:3.1378}]);
const early=read('facade_replacements_20260911/final/registration-result.json');
const earlyNames={'F02WL072-S26':'카카오프렌즈','F02WL072-S25':'위니비니','F02WL072-S34':'디자인스킨','F02WL072-S35':'꽃 인스타일',
  'F02WL072-S37':'진생호두과자','F02WL072-S43':'누리분식','F02WL076-S01':'코레일 여행센터 상단 간판','F02WL072-S33':'코레일 여행센터 파사드',
  'TRUEDAN-FRONT-S01':'TRUEDAN','F02WL013-S01':'크리스피크림도너츠','F02WL015-S01':'연인단팥빵 KODOO',
  'F02WL017-S03':'DINGDONG','F02WL021-S01':'스토리웨이','F02WL023-S01':'국군장병라운지 서울역 TMO'};
for(const r of early.results){const v=early.versions.find(v=>v.id===r.versionId&&v.is_active&&v.review_status==='approved');
  if(v&&earlyNames[r.alias])names.set(v.slot_key,{label:earlyNames[r.alias],sourceFile:'facade_replacements_20260911/final/registration-result.json'});}
sources.add('facade_replacements_20260911/final/registration-result.json');
consume('20260914_facade_batch_c8298ba4/live-slots.json');
const batch=read('20260914_facade_batch_c8298ba4/prepared.json');
const checked=read('20260914_facade_batch_c8298ba4/live-verification.json');
for(const p of batch)if(checked.results.some(r=>r.alias===p.alias&&r.reviewStatus==='approved'&&r.isActive)){
  names.set(p.slot_key,{label:p.store,sourceFile:'20260914_facade_batch_c8298ba4/live-verification.json'});
  const s=slots.get(p.slot_key);if(s&&p.geometry)slots.set(p.slot_key,{...s,...p.geometry});
}
sources.add('20260914_facade_batch_c8298ba4/live-verification.json');
for(const f of [
  '20260914_facade_feedback_042651/after.json','20260914_s04_information_zone/after.json',
  '20260914_s11_booth_update/after.json','20260914_s11_booth_update/catalog-rows.json',
  '20260914_information_center_update/catalog-after.json',
  '20260914_trainmates_update/catalog-rows.json','20260914_trainmates_update/west-catalog-row.json',
  '20260914_platform111/catalog-rows.json','20260915_photobooth/catalog-rows.json',
  '20260915_hanjeongsun/after.json','20260915_hanjeongsun/f02wl044-after.json',
  '20260915_dingdong_corner_trim/after.json','20260915_dessert_orientation/after.json',
  '20260915_pharmacy_facade/after.json','20260915_preppers_facade/after.json',
  '20260915_mealbon_orientation/after.json','20260915_selecto_facade/after.json',
])consume(f);
consume('20260915_terarosa_continuous/verified.json',read('20260915_terarosa_continuous/verified.json').after);
consume('20260915_zimcarry/registration-journal.json',read('20260915_zimcarry/registration-journal.json').after);
for(const f of INFORMATION_FACILITIES){const s=slots.get(f.slotKey);if(s)slots.set(f.slotKey,{
  site_id:'S202103',floor:'2F',source_kind:'app_asset',model_name:f.id,object_label:f.label,
  surface_width_m:f.surface.width,surface_height_m:f.surface.height,...s});}

const retired=s=>!s.is_active||[isRetiredS38Slot,isRetiredPergolaSlot,isRetiredLoungeSlot,isRetiredLoungeSignBodySlot,isRetiredInformationCenterSlot].some(fn=>fn(s))
  ||isRetiredPlatform111Replacement({slot_key:s.slot_key,slot:s})||[...RETIRED_INFORMATION_SHOP_SLOTS,S11_RETIRED_SIGN].includes(s.slot_alias);
// Explicit physical-store grouping. Same brand on different floors remains separate.
// F02WL072 is a shared atlas and must NEVER be grouped as one destination.
const definitions=[
  ['DINGDONG','식음료',['F02WL017'],'F02WL017-S03'],
  ['올리브영','쇼핑',['B01WL037','B01WL069'],'B01WL069-S01'],
  ['공차','식음료',['B01WL033'],'B01WL033-S02'],
  ['셀렉토커피','식음료',['B01WL067'],'B01WL067-S01'],
  ['스토리웨이','쇼핑',['B01WL039'],'B01WL039-S02'],
  ['복순도가','쇼핑',['F01WL018'],'F01WL018-S08'],
  ['한정선','식음료',['F02WL044','F02WL045','F02WL046'],'F02WL046-S01'],
  ['GS25','쇼핑',['F02WL047','F02WL048'],'F02WL047-S01'],
  ['잠바주스','식음료',['F02WL039','F02WL040'],'F02WL040-S01'],
  ['Hello MYSeoul','쇼핑',['F02WL033','F02WL035'],'F02WL033-S01'],
  ['프레퍼스','식음료',['F03WL003','F03WL004'],'F03WL004-S01'],
  ['테라로사','식음료',['F03WL005','F03WL006'],'F03WL006-S01'],
  ['카페 드 스카이','식음료',['B02WL040-S01','B02WL040-S02'],'B02WL040-S01'],
  ['신한은행','금융',['B02WL040-S03','B02WL041'],'B02WL041-S05'],
  ['디저트박스','식음료',['B03WL011'],'B03WL011-S02'],
  ['서울 중앙약국','건강·안전',['F03WL015'],'F03WL015-S02'],
  ['코레일 여행센터','안내',['F02WL076','F02WL072-S33'],'F02WL072-S33'],
];
const matches=(s,t)=>t===s.slot_alias||t===s.model_name;
const appInfo={
  'TRAIN-MATES-SEOUL-2F':['TRAIN MATES · 철도기념품','쇼핑','TRAIN-MATES-FRONT-S01'],
  'SEOUL-2F-TRUEDAN':['TRUEDAN','식음료','TRUEDAN-FRONT-S01'],
  'SEOUL-2F-AUNTIE-ANNES-01':['앤티앤즈 · 13번 승강장 앞','식음료','F02WL072-S11'],
  'SEOUL-2F-EGG-RICEBALL-01':['에그폭탄&주먹밥','식음료','EGG-RICEBALL-FRONT-S01'],
  'SEOUL-2F-INFORMATION-CENTER-01':['서울역 안내센터','안내','INFO-CENTER-SOUTH-S01'],
  'SEOUL-2F-INFORMATION-BOOTH-01':['계단 앞 인포메이션 부스','안내','INFO-BOOTH-01-S01'],
  'ZIMCARRY-SEOUL-2F':['ZIMCARRY · 짐캐리 안내벽','보관·배송','ZIMCARRY-FRONT-S01'],
  'SEOUL-3F-LIFEFOURCUTS-01':['인생네컷 스티커사진부스','편의','LIFEFOURCUTS-FRONT-S01'],
};
const cleanName=s=>s.replace(/\s+(정면|전면|측면|외벽|좌측면|우측면|출입구).*$/,'').trim();
const classify=n=>/ZIMCARRY|짐캐리/i.test(n)?'보관·배송':/안내|TIDS|플랫폼111|플랫폼 111|Platform111|TV|행선|TMO|라운지/i.test(n)?'안내':/포토|촬영|테라스/.test(n)?'편의':/은행|ATM|환전/.test(n)?'금융':/약국/.test(n)?'건강·안전':/스토리웨이|GS25|기념품|상품|마이서울|카카오|위니비니|디자인스킨|꽃/i.test(n)?'쇼핑':'식음료';
const grouped=new Map();
for(const s of slots.values()){
  if(retired(s)||!s.slot_alias)continue;
  const approved=names.get(s.slot_key),app=s.source_kind==='app_asset';
  if(!approved&&!app)continue;
  if(app&&/FRAME|F02WL072$/.test(s.target_asset_id||''))continue;
  const def=definitions.find(d=>d[2].some(t=>matches(s,t)));
  const config=appInfo[s.target_asset_id];
  const label=config?.[0]||def?.[0]||cleanName(approved?.label||s.object_label);
  const kind=config?.[1]||def?.[1]||classify(label);
  const key=app?s.target_asset_id:def?`${s.floor}:${def[2][0]}`:`${s.floor}:${s.model_name}:${label}`;
  if(!grouped.has(key))grouped.set(key,{label,category:kind,primaryAlias:config?.[2]||def?.[3],slots:[]});
  grouped.get(key).slots.push({...s,approvedName:approved?.label||null,nameSource:approved?.sourceFile||s.sourceFile});
}
const num=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
function surface(s){
  const ps=(s.surface_placements||[]).filter(p=>[p.longitude,p.latitude,p.height_m].every(v=>num(v)!==null));
  const p={...s,...(ps.find(p=>p.is_primary)||ps[0]||{})};
  return {review_id:s.slot_alias,label:s.approvedName||s.slot_alias,floor:s.floor,
    lon:num(p.longitude),lat:num(p.latitude),source_poi_z:num(p.height_m),
    source_ids:[s.slot_alias,s.target_asset_id||s.model_name],source_basis:s.nameSource,
    destination:true,required_check:'',
    catalog_focus:{sourceKind:s.source_kind||'vworld_uv',model:s.model_name,tdId:s.td_id,
      targetAssetId:s.target_asset_id||'',targetSurfaceId:s.target_surface_id||'',
      cameraHeading:num(p.camera_heading_deg),surfaceWidth:num(p.surface_width_m),surfaceHeight:num(p.surface_height_m),
      surfaceArea:num(p.surface_width_m)*num(p.surface_height_m)||num(s.surface_area_m2),
      cropWidth:num(s.replacement_canvas_width_px)||num(s.crop_width_px),
      cropHeight:num(s.replacement_canvas_height_px)||num(s.crop_height_px)}};
}
const items=[];
for(const g of grouped.values()){
  g.slots.sort((a,b)=>Number(b.slot_alias===g.primaryAlias)-Number(a.slot_alias===g.primaryAlias)||a.slot_alias.localeCompare(b.slot_alias));
  const points=g.slots.map(surface),p=points[0];
  const note=/ZIMCARRY/i.test(g.label)?'짐캐리 안내벽·문 위치입니다. 사진의 50M 표기는 실제 서비스 창구와의 구분이 필요합니다.':/약국/.test(g.label)?'약국과 여자화장실이 함께 담긴 파사드입니다. 각각의 출입문 위치를 별도로 확인하세요.':'파사드 중심을 기준으로 보여줍니다. 보행 출입문·접근 방향은 별도 확인이 필요합니다.';
  points.forEach(x=>{x.required_check=note;});
  p.label=g.label;
  items.push({id:`DEST-${g.slots[0].target_asset_id||g.primaryAlias||p.review_id}`,label:g.label,category:g.category,
    kind:['식음료','쇼핑'].includes(g.category)?'shop':'facility',floor:p.floor,
    basis:'catalog',status:g.slots.every(s=>s.approvedName)?'승인 파사드 기준':'등록 시설 기준',
    primary_id:p.review_id,points,notes:note});
}

// Use the real facility CSV; discard display-symbol/advertisement/old-store POIs.
const require=createRequire('/Users/hoonsbook/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {Workbook}=await import(require.resolve('@oai/artifact-tool'));
const csvFile='20260913_seoul_station_footfall/vworld_seoul_station_pois.csv';
const wb=await Workbook.fromCSV(fs.readFileSync(path.join(root,'outputs',csvFile),'utf8'),{sheetName:'POI'});
const [headers,...rows]=wb.worksheets.getItemAt(0).getUsedRange().values;
const amenities={'엘리베이터':'이동편의','에스컬레이터':'이동편의','무빙워크':'이동편의','매표기':'발권','안내도':'안내',
  '물품보관함':'보관·배송','심장제세동기':'건강·안전','현금인출기':'금융'};
const seen=new Set(),facilities=new Map();
for(const row of rows){
  const r=Object.fromEntries(headers.map((h,i)=>[h,row[i]]));
  if(seen.has(r.puid)||!amenities[r.pnam])continue;seen.add(r.puid);
  const floor=String(r.fname),lon=num(r.x),lat=num(r.y),z=num(r.z);
  const key=[floor,r.pnam,lon,lat,z].join(':');
  if(facilities.has(key)){facilities.get(key).points[0].source_ids.push(r.puid);continue;}
  const p={review_id:`FAC-${r.puid}`,label:r.pnam,floor,lon,lat,source_poi_z:z,source_ids:[r.puid],
    source_basis:csvFile,destination:true,required_check:'원본 시설 POI 위치입니다. 최신 존치 여부와 실제 접근·승하차 지점을 현장에서 확인하세요.'};
  facilities.set(key,{id:p.review_id,label:r.pnam,category:amenities[r.pnam],kind:'facility',floor,
    basis:'source_poi',status:'원본 POI · 현장 확인 필요',primary_id:p.review_id,points:[p],notes:p.required_check});
}
items.push(...facilities.values());sources.add(csvFile);
items.push({id:'DEST-TOILET-UNLOCATED',label:'화장실 · 남녀·장애인',category:'편의',kind:'facility',floor:null,
  basis:'missing',status:'위치 미등록',primary_id:null,points:[],notes:'현재 원본 POI 목록에는 화장실 좌표가 없습니다. 층별 실제 출입구 확인 후 등록이 필요합니다.'});
const order=['2F','3F','1F','B1','B2','B3','B6','B7','4F','RF'];
items.sort((a,b)=>(order.indexOf(a.floor)<0?99:order.indexOf(a.floor))-(order.indexOf(b.floor)<0?99:order.indexOf(b.floor))||a.label.localeCompare(b.label,'ko')||a.id.localeCompare(b.id));
console.log(JSON.stringify({version:1,site:'S202103',compiledAt:'2026-09-16',catalogSnapshotThrough:'2026-09-15',
  sourcePolicy:'저장된 카탈로그 승인·등록 내역과 VWorld 원본 시설 POI. 실시간 영업목록이 아니며, 보행 출입구·경로 승인은 포함하지 않음.',
  sources:[...sources],items}));

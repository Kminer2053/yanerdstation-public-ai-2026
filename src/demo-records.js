import {routeSequenceIssues,routeStepsVia} from './location-workbench-core.js';
export function validateDemoOverrides(overrides,seed,validation){
 const data=structuredClone(seed),pointMap=new Map(validation.points.map(p=>[p.review_id,p]));
 const kinds=['facilities','routes','connections','endpoints','origins'];
 if(!overrides||typeof overrides!=='object'||Array.isArray(overrides))throw Error('입력 형식 오류');
 const textFields=['name','hours','contact','notes','review','effective_date','methodology','facade_url','access_id','direction'];
 for(const [key,v] of Object.entries(overrides)){
  const split=key.indexOf(':'),kind=key.slice(0,split),id=key.slice(split+1),r=kinds.includes(kind)&&data[kind].find(r=>r.id===id&&r.active!==false);
  if(!r||!v||typeof v!=='object'||Array.isArray(v))throw Error('확정 등록부에 있는 항목만 수정할 수 있습니다.');
  for(const [field,value] of Object.entries(v)){
   if(textFields.includes(field)){if(typeof value!=='string'||value.length>(field==='facade_url'?270000:5000))throw Error('수정 필드 형식 오류');}
   else if(!['steps','observations'].includes(field))throw Error('허용되지 않는 수정 필드');
  }
  if(v.name!==undefined&&!v.name.trim())throw Error('등록명을 입력하세요.');
  if(v.facade_url&&!(v.facade_url.startsWith('https://')||/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v.facade_url)))throw Error('파사드는 HTTPS 또는 PNG/JPEG 업로드를 사용하세요.');
  if(v.access_id){const p=pointMap.get(v.access_id);if(kind!=='facilities'||p?.record_kind!=='walk_point'||p.floor!==r.floor)throw Error('시설과 같은 층의 보행점을 지정하세요.');}
  if(v.direction!==undefined&&(!['routes','connections'].includes(kind)||!['both','forward'].includes(v.direction)||kind==='connections'&&r.kind==='elevator'&&v.direction!=='both'))throw Error('통행 방향을 확인하세요.');
  if(v.steps!==undefined){if(kind!=='routes'||!Array.isArray(v.steps)||v.steps.length>1000)throw Error('등록 경로 순서를 확인하세요.');r.steps=v.steps;r.via=routeStepsVia(r,data);}
  if(v.observations!==undefined){
   if(kind!=='origins'||!Array.isArray(v.observations)||v.observations.length>744)throw Error('원점별 744개 이하로 입력하세요.');const used=new Set();
   for(const o of v.observations){const key=o.date+':'+o.hour;if(!/^2026-07-(0[1-9]|[12][0-9]|3[01])$/.test(o.date)||!Number.isInteger(o.hour)||o.hour<0||o.hour>23||![o.arrivals,o.departures].every(n=>Number.isFinite(n)&&n>=0&&n<10000000)||!['observed','estimated'].includes(o.value_class)||typeof o.method!=='string'||o.method.length>2000||(o.value_class==='estimated'&&!o.method.trim())||used.has(key))throw Error('7월 일시·진입/이탈량·추정 근거·중복을 확인하세요.');used.add(key);}
  }
  for(const k of ['name','hours','contact','notes','access_id','direction'])if(v[k]!==undefined)r[k]=v[k];
 }
 // A changed connection must remain usable by every registered route that references it.
 for(const r of data.routes){const changed=overrides['routes:'+r.id]?.steps||overrides['routes:'+r.id]?.direction||r.steps?.some(s=>s.kind==='connection'&&overrides['connections:'+s.connection_id]?.direction);if(changed){const errors=routeSequenceIssues(r,data,pointMap);if(errors.length)throw Error(errors[0].message);}}
 return overrides;
}

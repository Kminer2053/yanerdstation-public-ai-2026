import {validGeometry,areaDraft,buildPointRegister,reviewFeature} from './point-review-core.js';
import {entryFeatures} from './origin-entry-core.js';
import {REVIEW_FLOORS} from './route-review-core.js';

const checked=['draft','checked'];
export function workbenchPoints(register,destinations,grid,origins){
  const points=[...buildPointRegister(register,destinations,grid),...entryFeatures(origins)],ids=new Set(points.map(p=>p.review_id));
  for(const d of destinations.items)for(const p of d.points)if(!ids.has(p.review_id)){points.push(reviewFeature(p,'facility',{record_kind:'source_reference'}));ids.add(p.review_id);}
  return points;
}
export function seedWorkbench({grid,origins,destinations}){
  return {schema_version:1,site:'S202103',source_revision:grid.source_revision,origins:origins.origins.map(o=>({id:o.id,name:o.name,mode:o.mode_label,notes:'',active:true})),
    facilities:destinations.items.map(d=>({id:d.id,name:d.label,category:d.category,floor:d.floor||null,source_id:d.primary_id||null,access_id:null,notes:d.notes||'',hours:'',contact:'',active:true,status:'draft'})),
    endpoints:[],connections:[],routes:[],observations:[],excluded_points:[],legacy_review:null,routing_enabled:false};
}
export function observationKey(r){return [r.origin_id,r.date,r.hour??'day',r.metric].join('|');}
export function validateObservation(r,originIds){
  if(!originIds.has(r.origin_id))throw Error('등록된 원점을 선택하세요.');
  if(typeof r.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||new Date(r.date).toISOString().slice(0,10)!==r.date)throw Error('날짜 형식이 올바르지 않습니다.');
  if(r.hour!==null&&(!Number.isInteger(r.hour)||r.hour<0||r.hour>47))throw Error('시간은 0~47시 또는 일별로 지정하세요.');
  if(!['source_arrivals','source_departures','station_candidate_arrivals'].includes(r.metric))throw Error('수량 구분을 확인하세요.');
  if(r.value!==null&&(typeof r.value!=='number'||!Number.isFinite(r.value)||r.value<0))throw Error('인원은 0 이상 숫자 또는 미확보(빈 값)여야 합니다.');
  if(!['OBSERVED','DERIVED','ESTIMATED','SUBSTITUTED','UNKNOWN'].includes(r.value_class))throw Error('관측·산출·추정·대체 구분을 확인하세요.');
  if(typeof r.source!=='string'||!r.source.trim()||r.source.length>2000)throw Error('출처 또는 추정 기준을 입력하세요.');
  return {origin_id:r.origin_id,date:r.date,hour:r.hour,metric:r.metric,value:r.value,value_class:r.value_class,source:r.source.trim()};
}
export function validateWorkbench(input,{grid,points}){
  const d=structuredClone(input),byId=new Map(points.map(p=>[p.review_id,p]));
  if(d?.schema_version!==1||d.site!=='S202103'||d.source_revision!==grid.source_revision)throw Error('작업판 형식·역사·격자 버전이 다릅니다.');
  const text=(v,label,max=2000)=>{if(typeof v!=='string'||v.length>max)throw Error(`${label} 형식을 확인하세요.`);};
  const name=v=>{text(v,'이름',240);if(!v.trim())throw Error('이름을 입력하세요.');};
  for(const key of ['origins','facilities','endpoints','connections','routes','observations','excluded_points'])if(!Array.isArray(d[key])||d[key].length>(key==='observations'?100000:50000))throw Error(`${key} 목록 형식을 확인하세요.`);
  for(const key of ['origins','facilities','endpoints','connections','routes']){
    if(new Set(d[key].map(r=>r.id)).size!==d[key].length)throw Error('중복 ID가 있습니다.');
    for(const r of d[key]){if(typeof r.id!=='string'||!r.id||r.id.length>120)throw Error('ID 형식 오류');name(r.name);if(key!=='origins'&&!checked.includes(r.status))throw Error('검토 상태를 확인하세요.');}
  }
  const excluded=new Set(d.excluded_points);
  const walk=id=>{const p=byId.get(id);if(p?.record_kind!=='walk_point'||!validGeometry(p.geometry)||excluded.has(id))throw Error('유효한 격자 이동점을 선택하세요.');return p;};
  for(const id of excluded)if(byId.get(id)?.record_kind!=='walk_point')throw Error('제외 목록에 알 수 없는 이동점이 있습니다.');
  const originIds=new Set(d.origins.map(o=>o.id));
  for(const o of d.origins){text(o.mode,'모드',120);text(o.notes,'메모');if(typeof o.active!=='boolean')throw Error('원점 활성 상태 오류');}
  for(const f of d.facilities){if(f.floor!==null&&!REVIEW_FLOORS.includes(f.floor))throw Error('시설 층을 확인하세요.');for(const k of ['category','notes','hours','contact'])text(f[k],k);if(typeof f.active!=='boolean')throw Error('시설 등록 상태 오류');if(f.access_id&&walk(f.access_id).floor!==f.floor)throw Error('시설 출입점은 같은 층이어야 합니다.');if(f.source_id&&!byId.has(f.source_id))throw Error('시설 참고점 ID를 확인하세요.');}
  for(const e of d.endpoints){
    if(!['both','start','end'].includes(e.role)||!REVIEW_FLOORS.includes(e.floor)||!validGeometry(e.geometry))throw Error('출도착 위치·역할을 확인하세요.');
    if(!Array.isArray(e.origin_ids)||e.origin_ids.some(id=>!originIds.has(id)))throw Error('연결 원점을 확인하세요.');
    const p=walk(e.access_id);if(p.floor!==e.floor)throw Error('출도착 접속점은 같은 층이어야 합니다.');
    if(e.geometry.type==='Point'&&JSON.stringify(e.geometry)!==JSON.stringify(p.geometry))throw Error('출도착점과 이동점의 좌표가 다릅니다.');
  }
  for(const c of d.connections){
    if(!['stairs','escalator','elevator'].includes(c.kind)||!['both','forward'].includes(c.direction))throw Error('층간 시설 종류와 방향을 확인하세요.');
    if(c.kind==='elevator'){
      c.stops=connectionStops(c);delete c.from;delete c.to;
      if(c.direction!=='both'||c.stops.length<2||c.stops.length>50||new Set(c.stops).size!==c.stops.length||new Set(c.stops.map(id=>walk(id).floor)).size<2)throw Error('엘리베이터는 서로 다른 층을 포함한 2개 이상의 고유 접속점을 등록하세요.');
    }else{
      const a=walk(c.from),b=walk(c.to);if(a.floor===b.floor)throw Error('층간 연결은 서로 다른 두 층의 접속점이 필요합니다.');
      if(c.path){if(!Array.isArray(c.path)||c.path.length<2||c.path.length>2000||c.path[0]!==c.from||c.path.at(-1)!==c.to)throw Error('층간 이동면 경로의 시작·끝을 확인하세요.');for(const id of c.path)walk(id);}
    }
  }
  const endpoints=new Map(d.endpoints.map(e=>[e.id,e]));
  for(const r of d.routes){
    const from=endpoints.get(r.from),to=endpoints.get(r.to);
    if(!from||!to||from.id===to.id||from.role==='end'||to.role==='start')throw Error('경로의 출발·도착점과 역할을 확인하세요.');
    if(!Array.isArray(r.via)||r.via.length>1000||!['both','forward'].includes(r.direction))throw Error('경유점·방향 형식을 확인하세요.');
    if(r.direction==='both'&&(from.role!=='both'||to.role!=='both'))throw Error('양방향 경로에는 출발·도착 겸용 지점이 필요합니다.');
    if(r.steps!==undefined){
      if(!Array.isArray(r.steps)||r.steps.length>1000)throw Error('경로 순서 형식을 확인하세요.');
      const problems=routeSequenceIssues(r,d,byId);
      if(problems.length)throw Error(problems[0].message);
      if(JSON.stringify(routeStepsVia(r,d))!==JSON.stringify(r.via))throw Error('경로 순서와 경유점 목록이 다릅니다.');
    }
    const chain=[from.access_id,...r.via,to.access_id];for(const id of chain)walk(id);
    for(let i=1;i<chain.length;i++){
      if(chain[i]===chain[i-1])throw Error('연속된 중복 경유점을 제거하세요.');
      if(walk(chain[i-1]).floor!==walk(chain[i]).floor){
        const link=d.connections.find(c=>connectionPath(c,chain[i-1],chain[i]));
        if(!link||r.direction==='both'&&link.direction!=='both')throw Error('층을 바꾸는 구간은 등록된 층간 연결의 두 접속점을 순서대로 경유해야 합니다.');
      }
    }
  }
  d.observations=d.observations.map(o=>validateObservation(o,originIds));
  if(new Set(d.observations.map(observationKey)).size!==d.observations.length)throw Error('동일한 원점·날짜·시간·수량 구분이 중복되었습니다.');
  // Review completion is not automatic activation of production routing.
  d.routing_enabled=false;return d;
}
export function endpointArea(vertices,options){return areaDraft(vertices,options).geometry;}
export function routePointIds(route,state){return [state.endpoints.find(e=>e.id===route.from)?.access_id,...route.via,state.endpoints.find(e=>e.id===route.to)?.access_id].filter(Boolean);}
// The same landing may also be the route's start/end. Keep it only once.
export function compactRouteVia(route,state){
  const from=state.endpoints.find(e=>e.id===route.from)?.access_id,to=state.endpoints.find(e=>e.id===route.to)?.access_id;
  const via=route.via.filter((id,i,a)=>id!==(i?a[i-1]:from));
  if(via.at(-1)===to)via.pop();
  return via;
}
export function connectionStops(c){return c.kind==='elevator'&&Array.isArray(c.stops)?[...c.stops]:[c.from,c.to].filter(Boolean);}
// A shared landing can be B of one connection and A of another. Editing a
// particular connection takes precedence, without changing the stored graph.
export function connectionPointRoles(connections,editing=null){
  const roles=new Map();
  for(const c of connections)for(const id of connectionStops(c)){
    const role=c.kind==='elevator'?null:id===c.from?'A':'B',old=roles.get(id);
    roles.set(id,old&&role&&old!==role?'AB':old||role);
  }
  if(editing)for(const id of connectionStops(editing))roles.set(id,editing.kind==='elevator'?null:id===editing.from?'A':'B');
  return roles;
}
export const connectionCode=(connections,id)=>`C${String(connections.findIndex(c=>c.id===id)+1).padStart(2,'0')}`;
// Display-only markers stay at a real landing; clicking them selects a link,
// never a new walking point or an implicit route edit.
export function routeConnectionMarkers(connections,pointMap,floor){
  const names={stairs:'계단',escalator:'ES',elevator:'승강기'};
  return connections.flatMap((c,index)=>{
    const stops=connectionStops(c).map(id=>pointMap.get(id)).filter(Boolean),p=stops.find(p=>p.floor===floor);
    if(!p)return [];
    return [{review_id:`ROUTE-CONNECTION-${index}`,connection_id:c.id,access_id:p.review_id,
      label:`${connectionCode(connections,c.id)} ${names[c.kind]} · ${[...new Set(stops.map(p=>p.floor))].join('↔')}`,
      floor,geometry:p.geometry,layer:'connector',always_label:true}];
  });
}
export function mergeFacilitySeeds(state,destinations){
  const ids=new Set(state.facilities.map(f=>f.id)),sources=new Set(state.facilities.map(f=>f.source_id).filter(Boolean));
  const added=destinations.items.filter(d=>!ids.has(d.id)&&(!d.primary_id||!sources.has(d.primary_id)))
    .map(d=>({id:d.id,name:d.label,category:d.category,floor:d.floor||null,source_id:d.primary_id||null,
      access_id:null,notes:d.notes||'',hours:'',contact:'',active:true,status:'draft'}));
  return {...state,facilities:[...state.facilities,...added]};
}
export function connectionPairs(c){
  const stops=connectionStops(c);if(c.kind!=='elevator')return [[c.from,c.to]];
  return stops.flatMap((from,i)=>stops.slice(i+1).map(to=>[from,to]));
}
export function connectionPath(c,from,to){
  if(from===to)return null;
  if(c.kind==='elevator')return connectionStops(c).includes(from)&&connectionStops(c).includes(to)?[from,to]:null;
  const path=c.path||[c.from,c.to];
  if(c.from===from&&c.to===to)return path;
  if(c.direction==='both'&&c.to===from&&c.from===to)return [...path].reverse();
  // A user endpoint can lie on the registered stair movement surface. Allow
  // only a contiguous subpath of that exact connection, with the same direction.
  if(c.path){const a=path.indexOf(from),b=path.indexOf(to);if(a>=0&&b>=0){if(a<b)return path.slice(a,b+1);if(c.direction==='both')return path.slice(b,a+1).reverse();}}
  return null;
}

// Keep the legacy via chain for consumers, but retain each chosen connection
// (and direction) as one ordered edit unit. Never migrate saved routes on load.
export const routeStepPoints=step=>step.kind==='connection'?[step.from,step.to]:[step.point_id];
export function routeStepsVia(route,state){
  return compactRouteVia({...route,via:route.steps.flatMap(routeStepPoints)},state);
}
export const routeGeometryKey=r=>JSON.stringify([r.from,r.to,r.direction,r.steps??r.via]);
export function updateRouteRecord(previous,next){
  const record={...previous,...next};
  if(previous&&routeGeometryKey(previous)!==routeGeometryKey(record)){
    delete record.distance_m;delete record.generation;
  }
  return record;
}
export function routeSteps(route,state,pointMap){
  if(Array.isArray(route.steps))return structuredClone(route.steps);
  const chain=routePointIds(route,state);
  const links=chain.slice(1).map((id,i)=>pointMap.get(id)?.floor!==pointMap.get(chain[i])?.floor
    ?state.connections.find(c=>connectionPath(c,chain[i],id)&&(route.direction!=='both'||c.direction==='both')):null);
  const steps=[];
  for(let i=0;i<chain.length;i++){
    if(i&&links[i-1])steps.push({kind:'connection',connection_id:links[i-1].id,from:chain[i-1],to:chain[i]});
    if(i&&i<chain.length-1&&!links[i-1]&&!links[i])steps.push({kind:'point',point_id:chain[i]});
  }
  return steps;
}
export function routeInsertionPoint(route,state,index=route.steps.length){
  return index?routeStepPoints(route.steps[index-1]).at(-1):state.endpoints.find(e=>e.id===route.from)?.access_id;
}
export function routeSequenceIssues(route,state,pointMap){
  const issues=[],add=(index,message)=>issues.push({index,message});
  const from=state.endpoints.find(e=>e.id===route.from),to=state.endpoints.find(e=>e.id===route.to);
  const valid=id=>pointMap.get(id)?.record_kind==='walk_point'&&!state.excluded_points.includes(id);
  if(!from||!to)add(-1,'출발 위치와 도착 위치를 선택하세요.');
  else if(from.id===to.id||from.role==='end'||to.role==='start')add(-1,'서로 다른 출발·도착 위치와 역할을 확인하세요.');
  if(route.direction==='both'&&(from?.role!=='both'||to?.role!=='both'))add(-1,'양방향 경로에는 출발·도착 겸용 지점이 필요합니다.');
  let cursor=from?.access_id;
  for(const [index,step] of route.steps.entries()){
    if(!step||!['point','connection'].includes(step.kind)){add(index,`${index+1}번 순서의 종류를 확인하세요.`);continue;}
    const ids=routeStepPoints(step),entry=ids[0];
    if(ids.some(id=>!valid(id)))add(index,`${index+1}번: 사용할 수 없는 이동점입니다.`);
    if(cursor&&valid(entry)&&pointMap.get(cursor)?.floor!==pointMap.get(entry)?.floor)
      add(index,`${index+1}번 앞: ${pointMap.get(cursor)?.floor} → ${pointMap.get(entry)?.floor} 층간 연결을 추가하세요.`);
    if(step.kind==='point'&&cursor===entry)add(index,`${index+1}번: 바로 앞과 같은 경유점입니다.`);
    if(step.kind==='connection'){
      const c=state.connections.find(c=>c.id===step.connection_id);
      if(!c||!connectionPath(c,step.from,step.to))add(index,`${index+1}번: 층간 연결 또는 이동 방향을 확인하세요.`);
      else if(route.direction==='both'&&c.direction!=='both')add(index,`${index+1}번: 단방향 연결은 양방향 경로에 사용할 수 없습니다.`);
    }
    cursor=ids.at(-1);
  }
  if(cursor&&to&&pointMap.get(cursor)?.floor!==to.floor)
    add(route.steps.length,`도착 전: ${pointMap.get(cursor)?.floor} → ${to.floor} 층간 연결을 추가하세요.`);
  if(cursor&&to&&cursor===to.access_id&&!route.steps.length)add(-1,'출발·도착의 보행 접속점이 같습니다.');
  return issues;
}

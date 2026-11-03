import assert from 'node:assert/strict';
import fs from 'node:fs';
import {indexPoints,nearbyWalkPoints,recommendAccess,facadeInfo,approvedIndex,routePreview,connectionPreview,dataFlowValues,metres,offsetPoint,walkGraphIndex,snapGround,segmentClear,detourPath,landingsOnFloor,routeIssues,stepEntry,stepExit} from '../src/manager-core.js';
import {connectionPath} from '../src/location-workbench-core.js';
import {dataDiagramSVG,DIAGRAM_EDGES} from '../src/manager-data-diagram.js';

const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const seed=json('server/data/workbench-seed.json'),validation=json('server/data/validation.json'),catalog=json('public/data/experience/catalog.json');
const register=Object.fromEntries(['facilities','routes','connections','endpoints','origins'].map(k=>[k,(seed.data[k]||[]).filter(r=>r.active!==false)]));
const points=validation.points.filter(p=>p.record_kind==='walk_point').map(p=>[p.review_id,p.floor,...p.geometry.coordinates]);
const index=indexPoints(points),approved=approvedIndex(json('public/data/jury-frozen/approved-facades.json').replacements);

// Geometry helpers: 10 m east/north offsets measure back as 10 m.
const origin=[126.9707,37.5539,36];
assert(Math.abs(metres(origin,offsetPoint(origin,90,10))-10)<.01&&Math.abs(metres(origin,offsetPoint(origin,0,10))-10)<.01);

// Facade facts: every jury-approved slot that names a registered facility is shown with its image and size.
const byId=new Map(catalog.facilities.map(f=>[f.id,f])),kinds={};
for(const r of register.facilities){const info=facadeInfo(byId.get(r.id),approved);kinds[info.kind]=(kinds[info.kind]||0)+1;
  if(info.kind==='approved'){assert(info.image.startsWith('/data/jury-frozen/images/')&&info.width>0&&info.height>0&&info.replaceable,r.id);}
  else assert(!info.replaceable,r.id+' has no replaceable 3D face');}
assert.equal(kinds.approved,43);assert.equal(register.facilities.length,115);

// Access points: candidates stay on the facility floor and near it; the suggestion is a walk point on that floor.
let suggested=0,near=0;
for(const r of register.facilities){
  const f=byId.get(r.id),c=[f.reference.lon,f.reference.lat,f.reference.height],cands=nearbyWalkPoints(index,r.floor,c,{radius:14,limit:260,floorOnly:true});
  assert(cands.every(k=>index.byId.get(k.id)[1]===r.floor&&k.d<=14&&k.id.startsWith('GRID-')),r.id+' candidates are floor cells on its floor');
  const s=recommendAccess(index,f);if(!s)continue;suggested++;
  assert.equal(index.byId.get(s.id)[1],r.floor);assert(s.id.startsWith('GRID-'),'suggestion is a floor cell, not a stair tread');if(s.distance<=6)near++;
}
assert(suggested>=100,'suggestions for most facilities: '+suggested);assert(near/suggested>.8,'suggestions sit next to the facility: '+near+'/'+suggested);
for(const r of register.facilities.filter(r=>r.access_id))assert.equal(index.byId.get(r.access_id)?.[1],r.floor,r.id+' registered access point is on the same floor');

// Route previews: all registered routes resolve to coordinates and number every step on the map.
for(const r of register.routes){
  const v=routePreview(r,r.steps,register,index.byId);assert(!v.error,r.id+' '+v.error);
  assert.equal(v.coordinates.length,v.floors.length);assert(v.coordinates.length>=2);
  assert.equal(v.stops.length,r.steps.length,r.name+' numbers every step');
  assert(v.stops.every(s=>v.floors.includes(s.floor)));
}
const reversed=register.routes.find(r=>r.steps.length>5),swapped=[...reversed.steps];[swapped[0],swapped[1]]=[swapped[1],swapped[0]];
assert.deepEqual(routePreview(reversed,swapped,register,index.byId).stops[0].point,routePreview(reversed,reversed.steps,register,index.byId).stops[1].point,'reordered steps redraw in the new order');
assert(routePreview(reversed,[{kind:'point',point_id:'GRID-NOT-REAL'}],register,index.byId).error,'unknown points are reported, never drawn');
const drawable=register.connections.filter(c=>!connectionPreview(c,index.byId).error).length;assert(drawable>=80,'connections drawable: '+drawable);

// Map-drawn routes: clicks snap to walkable floor cells, wall crossings are detected and rerouted.
const wg=walkGraphIndex(json('public/data/experience/walk-graph.json')),P=wg.graph.points,grid=P.filter(p=>p[0].startsWith('GRID-'));
for(const p of grid.filter((_,i)=>i%97===0))assert.equal(snapGround(wg,p[1],[p[2],p[3],p[4]]).id,p[0],'a click on a floor cell snaps to that cell');
assert.equal(snapGround(wg,'2F',[126.9707,37.5539,80]),null,'a click far above the floor (roof, other level) is refused');
for(const r of register.routes){const {issues,blocked}=routeIssues(r,register,index.byId,wg);assert.deepEqual(issues,[],r.name+' passes the save rules');assert.deepEqual(blocked,[],r.name+' has no wall-crossing segment');}
// Floors split into areas that meet only through other floors; a detour exists exactly inside one area.
const area=new Map();for(const p of grid){if(area.has(p[0]))continue;const q=[p[0]];area.set(p[0],p[0]);while(q.length){const u=wg.byId.get(q.pop());for(const [v,,link] of wg.graph.adj[u]){const w=P[v];if(link||w[1]!==p[1]||!w[0].startsWith('GRID-')||area.has(w[0]))continue;area.set(w[0],p[0]);q.push(w[0]);}}}
let tried=0,rerouted=0,maxExtra=0,apart=0,rs=7;const rnd=()=>(rs=(rs*1103515245+12345)%2147483648)/2147483648;
for(const floor of ['2F','1F','B1']){
  const cells=grid.filter(p=>p[1]===floor);
  for(let n=0;n<6000&&tried<(floor==='B1'?240:floor==='1F'?160:80);n++){
    const a=cells[Math.floor(rnd()*cells.length)],b=cells[Math.floor(rnd()*cells.length)];
    if(a===b||Math.hypot(a[5]-b[5],a[6]-b[6])>60||segmentClear(wg,a[0],b[0])!==false)continue;
    const d=detourPath(wg,a[0],b[0]);
    if(area.get(a[0])!==area.get(b[0])){apart++;assert.equal(d,null,'separate areas are never joined on one floor');continue;}
    tried++;assert(d,floor+' '+a[0]+'→'+b[0]+' detour inside one walkable area');rerouted++;maxExtra=Math.max(maxExtra,d.length);
    const chain=[a[0],...d,b[0]];for(let k=1;k<chain.length;k++)assert.equal(segmentClear(wg,chain[k-1],chain[k]),true,floor+' detour segment stays on walkable cells');
  }
}
assert(tried>=100&&apart>=20,'detours checked inside areas ('+tried+') and refused across areas ('+apart+')');
assert.deepEqual(detourPath(wg,grid[0][0],grid[0][0]),[]);assert.equal(detourPath(wg,'TREAD-X','GRID-2F-0-0'),null,'stairs are not rerouted');
// One-way escalators board only at their entry and are never offered to a two-way route.
let landings=0;const boarding=register.connections.reduce((n,c)=>n+(c.kind==='elevator'?(c.stops?.length||0):c.direction==='both'?2:1),0);
for(const mode of ['both','forward'])for(const floor of ['B7','B6','B3','B2','B1','1F','2F','3F','4F'])for(const l of landingsOnFloor(register.connections,index.byId,floor,mode)){
  if(mode==='both'){assert.equal(l.connection.direction,'both',l.connection.id+' is one-way and not offered to a two-way route');continue;}
  landings++;assert.equal(index.byId.get(l.landing)[1],floor);
  for(const t of l.targets)assert(connectionPath(l.connection,l.landing,t.id),l.connection.id+' '+l.landing+'→'+t.id+' is a valid registered movement');
}
assert.equal(landings,boarding,'every boarding end is offered on its floor: '+landings);
// Redraw a registered route from sparse clicks: every 6th waypoint plus the connections, detours filling the rest.
for(const r of register.routes.filter(r=>r.steps.length>20)){
  const sparse=[];let prev=register.endpoints.find(e=>e.id===r.from).access_id;
  r.steps.forEach((st,i)=>{if(st.kind==='connection'||i%6===5){if(st.kind==='point'){const d=detourPath(wg,prev,st.point_id)||[];sparse.push(...d.map(point_id=>({kind:'point',point_id})));}else{const d=detourPath(wg,prev,st.from)||[];sparse.push(...d.map(point_id=>({kind:'point',point_id})));}sparse.push(st);prev=stepExit(st);}});
  const endId=register.endpoints.find(e=>e.id===r.to).access_id,tail=detourPath(wg,prev,endId)||[];sparse.push(...tail.map(point_id=>({kind:'point',point_id})));
  const check=routeIssues({...r,steps:sparse},register,index.byId,wg);assert.deepEqual(check.issues,[],r.name+' redrawn');assert.deepEqual(check.blocked,[],r.name+' redrawn without wall crossings');
  assert(sparse.length<=r.steps.length,r.name+' needs no more waypoints than the registered one');
}
// The checks catch a missing floor change and a wall crossing before saving.
const multi=register.routes.find(r=>r.steps.some(s=>s.kind==='connection')),cut=multi.steps.filter(s=>s.kind!=='connection');
assert(routeIssues({...multi,steps:cut},register,index.byId,wg).issues.some(x=>x.message.includes('층간 연결')),'a missing connection is reported');
let wall=null;for(let n=0;n<2000&&!wall;n++){const a=grid[Math.floor(rnd()*grid.length)],b=grid[Math.floor(rnd()*grid.length)];if(a[1]===b[1]&&a[1]==='2F'&&segmentClear(wg,a[0],b[0])===false)wall=[a[0],b[0]];}
const twoF=register.routes.find(r=>register.endpoints.find(e=>e.id===r.from).floor==='2F');
assert(routeIssues({...twoF,steps:[{kind:'point',point_id:wall[0]},{kind:'point',point_id:wall[1]}]},register,index.byId,wg).blocked.some(b=>b.from===wall[0]&&b.to===wall[1]),'a wall-crossing segment is reported');

// Data relationships: the diagram shows the same occupancy numbers as the 3D crowd (12:00 on 18 July).
const date='2026-07-18',hour=12,network=json('public/data/experience/network.json');network.headwayDwell=json('public/data/experience/headway-dwell.json');
const v=dataFlowValues({catalog,network,timeline:json('public/data/experience/timeline.json'),usage:json('public/data/experience/usage.json'),sales:null,register,overrides:{},approved,points,date,hour,edgeValues:json('public/data/experience/flows/'+date+'.json')[hour]});
assert.equal(v.expected,8082);assert.equal(Math.round(v.walking+v.dwell+v.ambient),8082);assert(Math.abs(v.arrivals-6792.7)<.01);
assert.equal(v.origins,53);assert.equal(v.endpoints,8);assert.equal(v.facades,43);assert.equal(v.access,62);assert(v.activeEdges>0&&v.activeEdges<=v.edges);
assert.equal(v.perEndpoint.length,8);assert(Math.abs(v.ambient-v.perEndpoint.reduce((s,e)=>s+e.ambient,0))<1e-6);
const svg=dataDiagramSVG(v);
for(const [from,to] of DIAGRAM_EDGES)assert(svg.includes('data-node="'+from+'"')&&svg.includes('data-node="'+to+'"'),from+'→'+to);
assert(svg.includes('8,082명')&&svg.includes('관측 하차')&&svg.startsWith('<svg')&&svg.endsWith('</svg>'));
assert(!/undefined|NaN/.test(svg),'no missing values in the diagram');
const withEdit=dataFlowValues({catalog,network,timeline:{},usage:{stores:{}},register,overrides:{['facilities:'+register.facilities[0].id]:{access_id:'',facade_url:'data:image/png;base64,AAAA'}},approved,points,date,hour});
assert.equal(withEdit.facadeEdits,1);assert(!/undefined|NaN/.test(dataDiagramSVG(withEdit)),'diagram survives missing hourly data');
console.log('PASS: '+kinds.approved+' approved facades, '+suggested+' access suggestions ('+near+' within 6 m), '+register.routes.length+' routes and '+drawable+' connections drawable, map drawing ('+rerouted+'/'+tried+' wall crossings rerouted, max '+maxExtra+' extra waypoints, '+landings+' connection landings), diagram '+int(v.expected)+' people at '+hour+':00');
function int(n){return new Intl.NumberFormat('ko-KR').format(n);}

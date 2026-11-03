// 3F waiting-hall circulation for the crowd display. A display model, not part of the OD flow model: route
// passages, store frontage and occupancy totals are unchanged.
// The non-transfer dwellers counted at the 2F concourse endpoints (KTX & 일반열차, 동쪽출입구) are spread over the
// 2F+3F concourse by walking-grid area, so the 3F hall takes its area share. Those people ride up, pass the 3F shops
// and the hall, ride down and repeat these closed loops. Walks are shortest paths on the reviewed 2 m grid
// (mesh-tested edges only); rides follow the registered 2F↔3F connection paths. Overnight (0–4시) the dwellers leave
// through the entrances, so nobody is sent upstairs.
// Usage: node tools/build-3f-circulation.mjs (in service/) or node service/tools/build-3f-circulation.mjs (repo root)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {buildWalkIndex,toLocal} from '../src/crowd-core.js';

const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public/data/experience'),read=f=>JSON.parse(fs.readFileSync(dir+'/'+f,'utf8'));
const graph=read('walk-graph.json'),catalog=read('catalog.json'),ix=buildWalkIndex(graph),P=graph.points;
const byId=new Map(P.map((p,i)=>[p[0],i])),connections=new Map(graph.connections.map(c=>[c.id,c]));
const isGrid=i=>P[i][0].startsWith('GRID-');

// Nearest walkable grid point to a grid coordinate (2 m units) on a floor; a far miss means a stale waypoint.
function near(floor,gx,gy){
  let best=-1,bd=Infinity;
  P.forEach((p,i)=>{if(p[1]!==floor||!isGrid(i))return;const d=Math.hypot(p[5]-gx*2,p[6]-gy*2);if(d<bd){bd=d;best=i;}});
  assert(bd<=3,`no walkable grid point near ${floor} ${gx},${gy}`);return best;
}
const linked=i=>graph.adj[i].some(([j,,conn])=>!conn&&P[j][1]===P[i][1]&&isGrid(j));
// Shortest walk on one floor over mesh-tested grid edges (rides excluded).
function walk(from,to){
  const floor=P[from][1];assert.equal(P[to][1],floor,'walk legs stay on one floor');
  if(from===to)return [from];
  const cost=new Float64Array(P.length).fill(Infinity),prev=new Int32Array(P.length).fill(-1),heap=[[0,from]];cost[from]=0;
  const push=e=>{heap.push(e);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p][0]<=e[0])break;heap[i]=heap[p];i=p;}heap[i]=e;};
  const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){let i=0;for(;;){let j=i*2+1;if(j>=heap.length)break;if(j+1<heap.length&&heap[j+1][0]<heap[j][0])j++;if(heap[j][0]>=last[0])break;heap[i]=heap[j];i=j;}heap[i]=last;}return top;};
  while(heap.length){
    const [d,i]=pop();if(d!==cost[i])continue;if(i===to)break;
    for(const [j,c,conn] of graph.adj[i]){if(conn||P[j][1]!==floor||!isGrid(j))continue;const n=d+c;if(n<cost[j]-1e-9){cost[j]=n;prev[j]=i;push([n,j]);}}
  }
  assert(Number.isFinite(cost[to]),`no walk ${P[from][0]} → ${P[to][0]}`);
  const path=[];for(let i=to;i!==-1;i=prev[i])path.push(i);return path.reverse();
}
const facility=id=>{const f=catalog.facilities.find(f=>f.id===id);assert(f?.access_id&&byId.has(f.access_id),'3F facility access '+id);return f;};
const point=i=>({id:P[i][0],lon:P[i][2],lat:P[i][3],h:P[i][4],floor:P[i][1]});

// Grid waypoints (2 m units) in the 3F hall; shops come from the catalog access points.
const W={
  corridor:['3F',-5,22],centre:['3F',-4,28],east:['3F',11,29],west:['3F',-23,29],southWest:['3F',-14,26],southEast:['3F',4,26],
  ktx:['2F',-5,3],eastBank:['2F',20,35],westBank:['2F',-32,29],
};
const SHOP={terarosa:'DEST-F03WL006-S01',taegeukdang:'DEST-F03WL007-S01',preppers:'DEST-F03WL004-S01',photo:'DEST-SEOUL-3F-LIFEFOURCUTS-01',millbon:'DEST-F03WL002-S01',pharmacy:'DEST-F03WL015-S02'};
// Escalator pairs per bank. The editor stores their running direction (forward, from → to): facing up the slope the
// right-hand escalator runs up and the left-hand one down. A bank whose escalator has no usable 3F landing uses its
// stairs for that direction.
const BANKS={ktx:['AUTO-F02MV007-3-1','AUTO-F02MV007-4-1'],east:['AUTO-F02MV007-5-1','AUTO-F02MV007-6-1'],west:['AUTO-F02MV007-1-1','AUTO-F02MV007-2-1']};
const STAIRS={ktx:'AUTO-F02MV002-1-1',east:'AUTO-F02MV006-2-1',west:'AUTO-F02MV006-1-1'};
// A ride is usable when both landings have walking edges (tools/diagnose-ride-landings.mjs shows why one does not).
const usable=id=>{const c=connections.get(id);return linked(byId.get(c.from))&&linked(byId.get(c.to));};
const running=id=>{const c=connections.get(id);return c.direction!=='forward'?'both':P[byId.get(c.from)][4]<P[byId.get(c.to)][4]?'up':'down';};
function sides(pair){
  const run=Object.fromEntries(pair.map(id=>[running(id),id]));
  assert(run.up&&run.down,'bank without an up and a down escalator: '+pair.join(', '));return {up:run.up,down:run.down};
}
const LOOPS=[
  {route_id:'C3F-KTX',name:'KTX 맞이방 → 3층 순환',start:W.ktx,bank:'ktx',
   via:[W.corridor,{rest:W.centre},{shop:SHOP.terarosa},{shop:SHOP.taegeukdang},W.east,W.southEast,W.southWest,W.west,{shop:SHOP.pharmacy},{shop:SHOP.millbon},{shop:SHOP.preppers},{shop:SHOP.photo},W.corridor]},
  {route_id:'C3F-EAST',name:'동쪽 맞이방 → 3층 순환',start:W.eastBank,bank:'east',
   via:[{shop:SHOP.taegeukdang},{shop:SHOP.terarosa},{rest:W.centre},{shop:SHOP.photo},{shop:SHOP.preppers},W.southWest,W.southEast,W.east]},
  {route_id:'C3F-WEST',name:'서쪽 맞이방 → 3층 순환',start:W.westBank,bank:'west',
   via:[W.west,{shop:SHOP.pharmacy},{shop:SHOP.millbon},{shop:SHOP.preppers},{rest:W.centre},{rest:W.southWest}]},
  {route_id:'C3F-HALL',name:'3층 맞이방 순환',start:W.east,
   via:[W.southEast,{rest:W.southWest},W.west,{shop:SHOP.pharmacy},{shop:SHOP.millbon},{shop:SHOP.preppers},{shop:SHOP.photo},{rest:W.centre},{shop:SHOP.terarosa},{shop:SHOP.taegeukdang}]},
];

function build(spec){
  const pts=[],stops=[],used=[];let at=near(...spec.start);
  const add=q=>{if(pts.at(-1)?.id!==q.id)pts.push(q);};
  const walkTo=i=>{for(const k of walk(at,i))add(point(k));at=i;};
  // A ride follows the registered step path (2F landing → steps → 3F landing, reversed going down); steps take the
  // floor of the nearer landing level.
  const ride=id=>{
    const c=connections.get(id);assert(c?.path&&c.coordinates?.length===c.path.length&&usable(id),'ride '+id);
    const a=byId.get(c.from),b=byId.get(c.to),[low,high]=P[a][4]<P[b][4]?[a,b]:[b,a];
    const steps=c.path.slice(1,-1).map((pid,k)=>{const [lon,lat,h]=c.coordinates[k+1];return {id:pid,lon,lat,h};});if(low!==a)steps.reverse();
    const mid=(P[low][4]+P[high][4])/2,up=P[at][1]===P[low][1];for(const s of steps)s.floor=s.h<mid?P[low][1]:P[high][1];
    assert(c.direction==='both'||(up?a===low:a===high),'ride against its running direction '+id);
    walkTo(up?low:high);used.push(id);for(const s of up?steps:steps.reverse())add(s);add(point(up?high:low));at=up?high:low;
  };
  const bank=spec.bank?sides(BANKS[spec.bank]):null,rides=bank&&{up:usable(bank.up)?bank.up:STAIRS[spec.bank],down:usable(bank.down)?bank.down:STAIRS[spec.bank]};
  const start=at;add(point(start));
  if(rides)ride(rides.up);
  for(const v of spec.via){
    if(Array.isArray(v)){walkTo(near(...v));continue;}
    if(v.rest){walkTo(near(...v.rest));const p=pts.at(-1);stops.push({i:pts.length-1,kind:'rest',spot:[p.lon,p.lat,p.h]});continue;}
    const f=facility(v.shop),hd=Number(f.reference?.focus?.cameraHeading);walkTo(byId.get(f.access_id));
    stops.push({i:pts.length-1,kind:'shop',id:f.id,name:f.name,spot:f.access,face:Number.isFinite(hd)?Math.round((hd+180)%360):null});
  }
  if(rides)ride(rides.down);
  walkTo(start);
  const xy=pts.map(q=>toLocal(ix,q.lon,q.lat));let distance=0,upper=0;
  for(let k=1;k<pts.length;k++){const d=Math.hypot(xy[k][0]-xy[k-1][0],xy[k][1]-xy[k-1][1],pts[k].h-pts[k-1].h);distance+=d;if(pts[k].floor==='3F'&&pts[k-1].floor==='3F')upper+=d;}
  const kind=id=>id===bank?.up?'escalator_up':id===bank?.down?'escalator_down':'stairs';
  return {route_id:spec.route_id,name:spec.name,kind:'circulation',weight:1,distance_m:+distance.toFixed(2),upper_m:+upper.toFixed(2),
    rides:rides&&{up:{id:rides.up,kind:kind(rides.up)},down:{id:rides.down,kind:kind(rides.down)}},stops,point_ids:pts.map(q=>q.id),floors:pts.map(q=>q.floor),coordinates:pts.map(q=>[q.lon,q.lat,+q.h.toFixed(3)])};
}

const routes=LOOPS.map(build),cells=f=>P.filter(p=>p[1]===f&&p[0].startsWith('GRID-')).length,area={'2F':cells('2F')*4,'3F':cells('3F')*4};
const concourse=catalog.endpoints.filter(e=>e.floor==='2F');
assert.deepEqual(concourse.map(e=>e.name).sort(),['KTX&일반열차','동쪽출입구'],'2F concourse endpoints changed; review the share basis');
for(const r of routes){assert.equal(r.point_ids[0],r.point_ids.at(-1),'closed loop '+r.route_id);assert(r.floors.every(f=>f==='2F'||f==='3F'));assert(r.upper_m>r.distance_m*.6,'mostly upstairs '+r.route_id);}
const out={
  revision:graph.revision,generated:new Date().toISOString().slice(0,10),kind:'display_model',
  note:'3층 맞이방 순환 · 2층 출도착점(KTX&일반열차·동쪽출입구) 비환승 체류 중 3층 보행면적 몫을 3층으로 배치한 표시용 모형. 유동 모형 경로·구간 통과량·매장 인근 통과에는 넣지 않음. 에스컬레이터는 올라가는 방향 기준 오른쪽 상행·왼쪽 하행. 심야(0~4시)는 외부 출입구로 빠져나가므로 3층 배치 없음.',
  share:{endpoints:concourse.map(e=>e.id),ratio:+(area['3F']/(area['2F']+area['3F'])).toFixed(4),basis:'walk_grid_area',area_m2:area,off_hours:[0,1,2,3,4]},
  pause:{shop:{p:.35,min:20,max:90,radius:1.5},rest:{p:.55,min:40,max:180,radius:4}},
  routes,
};
fs.writeFileSync(dir+'/circulation-3f.json',JSON.stringify(out));
console.log('3F circulation: share '+out.share.ratio+' ('+area['3F']+' / '+(area['2F']+area['3F'])+' m²) · '+routes.map(r=>r.route_id+' '+Math.round(r.distance_m)+'m (3F '+Math.round(r.upper_m)+'m, '+r.stops.length+' stops'+(r.rides?', up '+r.rides.up.id.slice(5,-2)+' '+r.rides.up.kind+' / down '+r.rides.down.id.slice(5,-2)+' '+r.rides.down.kind:'')+')').join(' · '));

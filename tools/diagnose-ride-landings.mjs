// Why a ride landing has no walking edge. Re-runs the walk-graph mesh test (route-walkability.explain: floor support,
// 0.35 m body clearance, obstacles 0.15–1.85 m above the floor, 0.2 m samples) on every edge out of each 2F↔3F landing
// and prints what blocks it. For each escalator pair it also reports which one is on the right facing up the slope
// (the up escalator) and, for an isolated 3F landing, the first exit on the escalator axis that passes the same test
// (point, step → exit with the moving-step rules, exit → connected grid point). Read-only; needs the VWorld tile
// snapshot in the workspace, like build-experience-data --graph.
// Usage: node tools/diagnose-ride-landings.mjs (in service/) or node service/tools/diagnose-ride-landings.mjs (repo root)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadWalkability} from './route-walkability.mjs';

const service=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.resolve(process.env.STATION_SOURCE_WORKSPACE||path.dirname(service));
const grid=JSON.parse(fs.readFileSync(path.join(root,'worktrees/offline-route-editor/public/data/route-review/grid-all.json'),'utf8'));
const graph=JSON.parse(fs.readFileSync(path.join(service,'public/data/experience/walk-graph.json'),'utf8'));
const mesh=await loadWalkability(root,grid),byId=new Map(grid.points.map(p=>[p.review_id,p]));
const linked=new Set(graph.points.filter((p,i)=>graph.adj[i].some(([j,,c])=>!c&&graph.points[j][1]===p[1])).map(p=>p[0]));
const flat=p=>p.point_kind!=='connector_tread',fmt=v=>v.map(n=>n.toFixed(2)).join(', ');
const rides=graph.connections.filter(c=>[c.from,c.to].map(id=>byId.get(id)?.floor).sort().join()==='2F,3F'),upper=c=>byId.get(c.from).floor==='3F'?c.from:c.to;

function edges(a){
  return grid.points.filter(b=>b!==a&&flat(b)&&b.floor===a.floor&&Math.abs(a.enu[0]-b.enu[0])<=grid.spacing_m+.001&&Math.abs(a.enu[1]-b.enu[1])<=grid.spacing_m+.001&&Math.abs(a.enu[0]-b.enu[0])+Math.abs(a.enu[1]-b.enu[1])>=.01&&Math.abs(a.enu[2]-b.enu[2])<=.35)
    .map(b=>({to:b.review_id,reason:mesh.explain(a,b,{all:true})}));
}
function axis(c){
  const t=c.path.map(id=>byId.get(id)).filter(p=>p&&!flat(p));if(t[0].enu[2]>t.at(-1).enu[2])t.reverse();
  const a=t[0].enu,b=t.at(-1).enu,l=Math.hypot(b[0]-a[0],b[1]-a[1]);
  return {treads:t,dir:[(b[0]-a[0])/l,(b[1]-a[1])/l],mid:[(a[0]+b[0])/2,(a[1]+b[1])/2]};
}
// First exit k m past the last step along the axis with body clearance, a clean step → exit leg and a clean walk on
// to a connected 3F grid point within 3.2 m.
function exitFor(c){
  const {treads,dir}=axis(c),last=treads.at(-1),level=byId.get(upper(c)).enu[2],step={...last,floor:'3F'};
  for(let k=1;k<=4.01;k+=.25){
    const e={floor:'3F',point_kind:'grid',source_ids:[],enu:[last.enu[0]+dir[0]*k,last.enu[1]+dir[1]*k,level]};
    if(mesh.explain(e,{...e,enu:[e.enu[0]+.01,e.enu[1],level]})||mesh.explain(step,e))continue;
    const to=grid.points.filter(p=>p.floor==='3F'&&linked.has(p.review_id)&&Math.hypot(p.enu[0]-e.enu[0],p.enu[1]-e.enu[1])<=3.2)
      .sort((p,q)=>Math.hypot(p.enu[0]-e.enu[0],p.enu[1]-e.enu[1])-Math.hypot(q.enu[0]-e.enu[0],q.enu[1]-e.enu[1])).find(p=>!mesh.explain(e,p));
    if(to)return {k,at:e.enu.slice(0,2),to:to.review_id};
  }
  return null;
}
console.log('2F↔3F 승강 연결 도착점 검사 · 보행 연결은 바닥 지지, 몸 여유 '+grid.clearance_m+' m, 바닥 위 0.15~1.85 m 장애물을 0.2 m 간격으로 확인');
for(const c of rides){
  for(const end of [c.from,c.to]){
    const a=byId.get(end),rows=edges(a),open=rows.filter(r=>!r.reason).length,blocked=rows.filter(r=>r.reason);
    const why=[...new Set(blocked.map(r=>r.reason.check==='obstacle'?r.reason.models.join('+'):r.reason.check))].join(', ');
    const first=blocked.length?Math.min(...blocked.map(r=>r.reason.t*Math.hypot(...a.enu.slice(0,2).map((v,i)=>v-byId.get(r.to).enu[i])))):null;
    console.log(`${c.id} ${c.kind}${c.direction==='forward'?(end===c.from?' 출발':' 도착'):''} ${a.floor} ${end} (${fmt(a.enu.slice(0,2))}) 보행 연결 ${open}/${rows.length}`+(blocked.length?` · 막힘 ${why} · 도착점에서 ${first.toFixed(2)} m 안`:''));
  }
  if(!linked.has(upper(c))){const e=exitFor(c);console.log('   → '+(e?`축선 ${e.k} m 앞 출구 (${fmt(e.at)})에서 ${e.to}로 통과`:'축선 4 m 안에 통과하는 출구 없음 · 편집기에서 계단 경로와 도착점 재지정 필요'));}
}
const pairs=[['AUTO-F02MV007-3-1','AUTO-F02MV007-4-1'],['AUTO-F02MV007-5-1','AUTO-F02MV007-6-1'],['AUTO-F02MV007-1-1','AUTO-F02MV007-2-1']];
// Every floor: ride landings and elevator stops without a walking edge (graph check only).
const isolated=graph.connections.flatMap(c=>(c.kind==='elevator'?c.stops||[]:[c.from,c.to]).filter(e=>!linked.has(e)).map(e=>c.id.slice(5)+' '+e));
console.log('전 층 층간 연결 중 보행 연결 없는 착지점 '+isolated.length+'곳'+(isolated.length?': '+isolated.join(', '):''));
for(const [p,q] of pairs){
  const A=axis(rides.find(c=>c.id===p)),B=axis(rides.find(c=>c.id===q)),u=[A.dir[0]+B.dir[0],A.dir[1]+B.dir[1]],side=(B.mid[0]-A.mid[0])*u[1]-(B.mid[1]-A.mid[1])*u[0];
  const stored=id=>{const c=rides.find(c=>c.id===id);return c.direction!=='forward'?'양방향':byId.get(c.from).enu[2]<byId.get(c.to).enu[2]?'상행':'하행';};
  console.log(`${p} · ${q}: 올라가는 방향 기준 오른쪽 ${side>0?q:p}(상행) · 왼쪽 ${side>0?p:q}(하행) · 편집기 ${p.slice(5,-2)} ${stored(p)}, ${q.slice(5,-2)} ${stored(q)}`);
}

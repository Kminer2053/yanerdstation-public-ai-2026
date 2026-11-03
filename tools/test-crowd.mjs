import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildWalkIndex,buildLane,lanePoint,cellAt,lineHeight,snapWalkable,slideMove,openHeading,facilitySpot,crowdComposition,agentCounts,upperShare,upperAgents,pickWeighted,selectNearest,randomInPolygon,toLocal,rand} from '../src/crowd-core.js';
import {createCameraComparison} from '../src/camera-comparison.js';

// Synthetic 2F corridor: 40 m long, walkable from y=-4 to y=4, with one pillar cell at (20,4).
const lon0=126.97,lat0=37.554,toLon=x=>lon0+x/88000,toLat=y=>lat0+y/111000,points=[],adj=[];
for(let gx=0;gx<=20;gx++)for(let gy=-2;gy<=2;gy++){if(gx===10&&gy===2)continue;points.push(['GRID-2F-'+gx+'-'+gy,'2F',toLon(gx*2),toLat(gy*2),36,gx*2,gy*2,0]);}
points.forEach((p,i)=>adj.push(points.flatMap((q,j)=>i!==j&&Math.abs(p[5]-q[5])<=2&&Math.abs(p[6]-q[6])<=2?[[j,Math.hypot(p[5]-q[5],p[6]-q[6]),null]]:[])));
const graph={origin:{lon:lon0,lat:lat0,height:36},points,adj,connections:[]};
const ix=buildWalkIndex(graph);
const [x,y]=toLocal(ix,toLon(12),toLat(-2));assert(Math.abs(x-12)<1e-6&&Math.abs(y+2)<1e-6,'lon/lat maps back onto the grid frame');
assert(cellAt(ix,'2F',12.4,-2.3,36)>=0);assert.equal(cellAt(ix,'2F',12,6,36),-1,'outside the corridor wall');assert.equal(cellAt(ix,'3F',12,0,36),-1,'other floor');assert.equal(cellAt(ix,'2F',12,0,40),-1,'other level');
assert.notEqual(lineHeight(ix,'2F',0,0,36,38,3),null);assert.equal(lineHeight(ix,'2F',16,4,36,24,4),null,'a straight line through the pillar is blocked');
assert.equal(snapWalkable(ix,'2F',20,4,36,3)>=0,true);

const route={coordinates:[],floors:[],point_ids:[]};for(let gx=0;gx<=20;gx++){route.coordinates.push([toLon(gx*2),toLat(0),36]);route.floors.push('2F');route.point_ids.push('GRID-2F-'+gx+'-0');}
const lane=buildLane(ix,route);
assert.equal(lane.n,21);assert(Math.abs(lane.length-40)<1e-6);
assert(Math.abs(lane.R[5]-3.75)<1e-9&&Math.abs(lane.L[5]-3.75)<1e-9,'clearance = walkable half-width minus 1 m margin, same on both sides');
assert(lane.L[10]<lane.L[5],'the pillar narrows the left side');assert(lane.L[9]<=lane.L[10]+.6*2+1e-9&&lane.L[8]<=lane.L[5],'narrowing is ramped in, not a step');
const right=lanePoint(ix,lane,12,1),left=lanePoint(ix,lane,12,-1);
assert(Math.abs(right.y+3.75)<1e-9&&Math.abs(left.y-3.75)<1e-9,'u=±1 reaches each side wall margin');
assert.equal(lanePoint(ix,lane,2.5,1).y>-1,true,'sideways offset fades in near the start');
for(let s=2;s<=38;s+=.7)for(const u of [-1,-.5,0,.5,1]){const p=lanePoint(ix,lane,s,u);assert(cellAt(ix,p.floor,p.x,p.y,p.h,.9)>=0,'lane point stays on walkable cells');}

// First-person walking: free steps, wall stop with body gap, sliding along the wall, no stepping into the pillar.
assert.deepEqual(Object.values(slideMove(ix,'2F',10,0,36,.5,0)).slice(0,2),[10.5,0]);
assert.equal(slideMove(ix,'2F',10,4.4,36,0,.5),null,'blocked by the corridor wall');
const slid=slideMove(ix,'2F',10,4.4,36,.4,.4);assert(slid&&slid.y===4.4&&Math.abs(slid.x-10.4)<1e-9,'diagonal into a wall slides along it');
assert.equal(slideMove(ix,'2F',19,3,36,0,0),null);
let px=14,py=4;for(let k=0;k<60;k++){const m=slideMove(ix,'2F',px,py,36,.2,0);if(!m)break;px=m.x;py=m.y;assert(cellAt(ix,'2F',px,py,36)>=0);}
assert(px<19,'the pillar cell at (20,4) stops a walker on that row');
const eastWest=openHeading(ix,'2F',2,0,36);assert(Math.abs(Math.sin(eastWest))>.9,'first-person start faces along the corridor');
assert.deepEqual(facilitySpot(ix,{floor:'2F',access:[toLon(12),toLat(0),30]}).slice(0,2),[toLon(12),toLat(0)]);
assert.equal(facilitySpot(ix,{floor:'2F',access:[toLon(12),toLat(0),35.4]})[2],36,'access marker sits on the floor level');
const facade=facilitySpot(ix,{floor:'2F',reference:{lon:toLon(12),lat:toLat(5.5),height:37.8,focus:{cameraHeading:180}}});
assert(cellAt(ix,'2F',...toLocal(ix,facade[0],facade[1]),facade[2])>=0,'facade-only facility is pulled onto a walkable cell');
const facingNorth=facilitySpot(ix,{floor:'2F',reference:{lon:toLon(12),lat:toLat(0),height:37.8,focus:{cameraHeading:0}}});
assert(toLocal(ix,facingNorth[0],facingNorth[1])[1]>0,'cameraHeading is the facade front normal: the marker moves to that side');
assert.equal(facilitySpot(ix,{floor:'2F'}),null);

// Camera comparison can be switched from several buttons (map toolbar, walk bar, open-world HUD) with one shared state.
globalThis.window??=new EventTarget();window.isSecureContext=true;globalThis.document??=new EventTarget();document.hidden=false;
const cameraButtons=[0,1,2].map(()=>Object.assign(new EventTarget(),{setAttribute(k,v){this[k]=v;}}));let grant;
const compare=createCameraComparison({video:{srcObject:null,async play(){}},status:{},container:{hidden:true},button:cameraButtons[0],buttons:cameraButtons.slice(1),mediaDevices:{getUserMedia:()=>new Promise(r=>grant=r)}});
cameraButtons[2].dispatchEvent(new Event('click'));assert(compare.active&&cameraButtons.every(b=>b['aria-pressed']==='true'&&b.textContent==='카메라 끄기'));
grant({getTracks:()=>[{stop(){}}]});await new Promise(r=>setImmediate(r));cameraButtons[1].dispatchEvent(new Event('click'));assert(!compare.active&&cameraButtons.every(b=>b['aria-pressed']==='false'));compare.destroy();

const endpoints={A:{dwell:600,ambient:30},B:{dwell:0,ambient:0}},routes=[{from_endpoint:'A',to_endpoint:'B',distance_m:100},{from_endpoint:'B',to_endpoint:'A',distance_m:100}];
const edges=[{length_m:125}],comp=crowdComposition({routes,values:[3600,0],edges,edgeValues:[0,3600],endpoints});
assert.equal(comp.walking,100);assert.equal(comp.dwell,600);assert.equal(comp.ambient,30);assert.equal(comp.expected,730);assert.equal(comp.dwellW.get('A'),600);
assert.equal(crowdComposition({routes,values:[3600,0],endpoints:{}}).walking,80,'route length fallback without edge values');
const counts=agentCounts(comp,73);assert.equal(counts.total,73);assert.equal(counts.walk+counts.dwell+counts.ambient,73);assert.equal(counts.walk,10);assert.equal(counts.dwell,60);
assert.deepEqual(agentCounts({expected:0,walking:0,dwell:0,ambient:0},100),{total:0,walk:0,dwell:0,ambient:0});
assert.equal(pickWeighted([['a',1],['b',3]],.1),'a');assert.equal(pickWeighted([['a',1],['b',3]],.9),'b');assert.equal(pickWeighted([['a',0]],.5),null);

const cands=[{id:1,d2:100},{id:2,d2:400},{id:3,d2:900,model:{}},{id:4,d2:1000}];
assert.equal(selectNearest([...cands],10).length,4,'everyone in view becomes a person when it fits');
assert.deepEqual(selectNearest([...cands],2).map(a=>a.id),[1,2]);
assert.deepEqual(selectNearest([{id:1,d2:100},{id:2,d2:440},{id:3,d2:500,model:{}}],2).map(a=>a.id),[1,3],'a person already shown keeps its model near the cut-off');

const square={type:'Polygon',coordinates:[[[0,0,5],[10,0,5],[10,10,5],[0,10,5],[0,0,5]]]},o={rs:7};
for(let k=0;k<200;k++){const p=randomInPolygon(square,rand(o),rand(o),rand(o));assert(p[0]>=0&&p[0]<=10&&p[1]>=0&&p[1]<=10&&p[2]===5);}
assert.deepEqual(randomInPolygon({type:'Point',coordinates:[1,2,3]},.5,.5,.5),[1,2,3]);

// Seoul data: sideways spread never leaves the walking grid where the route line itself is on it.
const base='public/data/experience/',j=f=>JSON.parse(fs.readFileSync(base+f,'utf8'));
const seoul=buildWalkIndex(j('walk-graph.json')),network=j('network.json');let samples=0;
for(const r of network.routes){const l=buildLane(seoul,r),cur={i:0};
  for(let s=l.S[1];s<=l.S[l.n-2];s+=1.7){const c={...lanePoint(seoul,l,s,0,cur)};if(cellAt(seoul,c.floor,c.x,c.y,c.h,.9)<0)continue;
    for(const u of [-1,-.4,.4,1]){const p=lanePoint(seoul,l,s,u,{i:cur.i});samples++;assert(cellAt(seoul,p.floor,p.x,p.y,p.h,.9)>=0,'Seoul lane offset off the grid');}}}
assert(samples>10000);
const hd=j('headway-dwell.json'),catalog=j('catalog.json'),timeline=j('timeline.json'),flows=j('flows/2026-07-18.json'),ep={};
for(const e of catalog.endpoints){const h=hd.endpoints[e.id];ep[e.id]={dwell:h?.dwell_seconds?.[12]??180,ambient:h?.dates?.['2026-07-18']?.ambient_hourly?.[12]??0};}
const noon=crowdComposition({routes:network.routes,values:timeline['2026-07-18'].routes[12],edges:network.edges,edgeValues:flows[12],endpoints:ep});
assert.equal(noon.expected,8082,'same occupancy estimate as the previous scene formula');
// 3F hall circulation: closed 2F/3F loops on walking-graph steps whose lanes keep people on the grid; the hall takes
// its walking-area share of the 2F concourse dwellers and the ambient total stays the same.
const circ=j('circulation-3f.json'),walkGraph=seoul.graph,byId=new Map(walkGraph.points.map((p,i)=>[p[0],i]));
const cells=f=>walkGraph.points.filter(p=>p[1]===f&&p[0].startsWith('GRID-')).length;
assert.equal(circ.share.ratio,+(cells('3F')/(cells('2F')+cells('3F'))).toFixed(4));
assert.deepEqual([...circ.share.endpoints].sort(),catalog.endpoints.filter(e=>e.floor==='2F').map(e=>e.id).sort());
let loopSamples=0;
for(const r of circ.routes){
  assert.equal(r.point_ids[0],r.point_ids.at(-1),'closed loop '+r.route_id);assert(r.floors.every(f=>f==='2F'||f==='3F')&&r.floors.includes('3F'));
  for(let k=1;k<r.point_ids.length;k++){
    const a=byId.get(r.point_ids[k-1]),b=byId.get(r.point_ids[k]);if(a===undefined||b===undefined||r.floors[k]!==r.floors[k-1])continue;
    assert(walkGraph.adj[a].some(e=>e[0]===b),'loop step off the walking graph '+r.point_ids[k-1]+' → '+r.point_ids[k]);
  }
  for(const st of r.stops)assert(st.i>0&&st.i<r.point_ids.length-1&&r.floors[st.i]==='3F'&&st.spot.length===3,'stop on the 3F part '+r.route_id);
  // Every grid point of a loop can be walked from (no isolated ride landing).
  for(const id of r.point_ids){const i=byId.get(id);if(i!==undefined&&id.startsWith('GRID-'))assert(walkGraph.adj[i].some(([j,,c])=>!c&&walkGraph.points[j][1]===walkGraph.points[i][1]),'isolated point in loop '+id);}
  if(r.rides){
    // Facing up the slope the right-hand escalator runs up: the up ride's steps lie to the right of the down ride's.
    const steps=id=>{const c=walkGraph.connections.find(c=>c.id===id),t=c.coordinates.slice(1,-1);if(t[0][2]>t.at(-1)[2])t.reverse();return t.map(([lon,lat])=>toLocal(seoul,lon,lat));};
    const u=steps(r.rides.up.id),d=steps(r.rides.down.id),mid=t=>[(t[0][0]+t.at(-1)[0])/2,(t[0][1]+t.at(-1)[1])/2],dir=t=>[t.at(-1)[0]-t[0][0],t.at(-1)[1]-t[0][1]];
    const a=dir(u),b=dir(d),m=[mid(u)[0]-mid(d)[0],mid(u)[1]-mid(d)[1]];
    if(r.rides.up.kind==='escalator_up')assert(m[0]*(a[1]+b[1])-m[1]*(a[0]+b[0])>0,'up escalator on the right '+r.route_id);
    assert.equal(r.rides.down.kind,'escalator_down',r.route_id);
  }
  const l=buildLane(seoul,r),cur={i:0};
  for(let s=l.S[1];s<=l.S[l.n-2];s+=1.7){const c={...lanePoint(seoul,l,s,0,cur)};if(cellAt(seoul,c.floor,c.x,c.y,c.h,.9)<0)continue;
    for(const u of [-1,-.4,.4,1]){const p=lanePoint(seoul,l,s,u,{i:cur.i});loopSamples++;assert(cellAt(seoul,p.floor,p.x,p.y,p.h,.9)>=0,'3F loop offset off the grid');}}
}
assert(loopSamples>1000);
const up=upperShare(noon,circ.share),concourse=circ.share.endpoints.reduce((v,id)=>v+(noon.ambientW.get(id)||0),0);
assert(concourse>0&&Math.abs(up.upper-concourse*circ.share.ratio)<1e-9,'3F share of the 2F concourse dwellers');
assert(Math.abs([...up.stay.values()].reduce((a,b)=>a+b,0)+up.upper-noon.ambient)<1e-6,'moving dwellers upstairs keeps the ambient total');
const noonAgents=agentCounts(noon,3000),upAgents=upperAgents(noonAgents,noon,up.upper);
assert(upAgents>0&&upAgents<=noonAgents.ambient&&Math.abs(upAgents/noonAgents.ambient-up.upper/noon.ambient)<.01);
assert.equal(upperAgents(noonAgents,noon,0),0);assert.equal(upperShare(noon,null).upper,0);
assert.equal(upperShare(noon,circ.share,12).upper,up.upper,'daytime hour keeps the share');
for(const h of [0,1,2,3,4])assert.equal(upperShare(noon,circ.share,h).upper,0,'overnight dwellers leave through the entrances, none upstairs at '+h+'시');
assert.deepEqual(circ.routes.filter(r=>r.rides).map(r=>r.rides.up.id+'>'+r.rides.down.id),['AUTO-F02MV007-4-1>AUTO-F02MV007-3-1','AUTO-F02MV007-5-1>AUTO-F02MV007-6-1','AUTO-F02MV007-1-1>AUTO-F02MV007-2-1']);
console.log('PASS: walkable grid lookup, wall clearance lanes, first-person wall sliding, facility marker spots, shared camera toggles, occupancy composition, nearest-first person models, Seoul lane spread ('+samples+' samples) and 3F hall loops ('+loopSamples+' samples, '+Math.round(up.upper)+' of '+Math.round(noon.ambient)+' dwellers upstairs at noon)');

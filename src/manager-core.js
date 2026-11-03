// Pure helpers for the manager workbench: facade/access review, route previews and data relationships.
import {crowdComposition,buildWalkIndex,toLocal,lineHeight,snapWalkable} from './crowd-core.js';
import {sum} from './experience-core.js';
import {routeSequenceIssues} from './location-workbench-core.js';

const LAT_M=111320;
export const metres=(a,b)=>{const k=Math.cos(a[1]*Math.PI/180)*LAT_M;return Math.hypot((b[0]-a[0])*k,(b[1]-a[1])*LAT_M);};
// Heading in degrees clockwise from north (a facade's cameraHeading is its front normal).
export function offsetPoint(p,headingDeg,dist){
  const a=headingDeg*Math.PI/180,k=Math.cos(p[1]*Math.PI/180)*LAT_M;
  return [p[0]+Math.sin(a)*dist/k,p[1]+Math.cos(a)*dist/LAT_M,p[2]];
}

// points: [id,floor,lon,lat,h] from /api/demo/points.
export function indexPoints(points){
  const byId=new Map(),byFloor=new Map();
  for(const p of points){byId.set(p[0],p);if(!byFloor.has(p[1]))byFloor.set(p[1],[]);byFloor.get(p[1]).push(p);}
  return {byId,byFloor};
}
// floorOnly keeps level floor cells (GRID-*) and skips stair/escalator treads, which are never shop entrances.
export function nearbyWalkPoints(index,floor,center,{radius=14,limit=260,rise=4.5,floorOnly=false}={}){
  const out=[];
  for(const p of index.byFloor.get(floor)||[]){
    if(Math.abs(p[4]-center[2])>rise||floorOnly&&!p[0].startsWith('GRID-'))continue;
    const d=metres(center,[p[2],p[3]]);if(d<=radius)out.push({id:p[0],point:[p[2],p[3],p[4]],d});
  }
  return out.sort((a,b)=>a.d-b.d).slice(0,limit);
}
export function facilityPoint(f){const r=f?.reference;return r&&[r.lon,r.lat,r.height].every(Number.isFinite)?[r.lon,r.lat,r.height]:null;}
// Suggest the walk point just in front of the facade (or nearest to the reference when no photo facade exists).
export function recommendAccess(index,f){
  const c=facilityPoint(f);if(!c)return null;
  const h=f.reference?.focus?.cameraHeading,target=Number.isFinite(h)?offsetPoint(c,h,1.8):c;
  const best=nearbyWalkPoints(index,f.floor,target,{radius:10,limit:1,floorOnly:true})[0];
  return best?{id:best.id,point:best.point,distance:metres(c,best.point)}:null;
}

export const approvedIndex=replacements=>new Map((replacements||[]).filter(r=>r?.slot?.slot_alias).map(r=>[r.slot.slot_alias,r]));
// Normalised facade facts for one facility: approved jury image, dedicated model face, or none.
export function facadeInfo(f,approved){
  const r=f?approved.get(f.source_id):null,focus=f?.reference?.focus;
  if(r)return {kind:'approved',slotAlias:r.slot.slot_alias,image:r.image_url,file:r.file_name,width:r.replacement_width_px,height:r.replacement_height_px,
    mime:r.replacement_mime_type,area:r.slot.surface_area_m2,heading:r.slot.camera_heading_deg,model:r.slot.model_name,label:r.current_store_name,
    reviewed:r.reviewed_at,sha256:r.sha256,replaceable:true};
  if(focus)return {kind:focus.sourceKind==='app_asset'?'model':'unapproved',slotAlias:f.source_id,model:focus.model,heading:focus.cameraHeading,
    surface:[focus.surfaceWidth,focus.surfaceHeight],area:focus.surfaceArea,replaceable:false};
  return {kind:'none',replaceable:false};
}

// Map coordinates for a registered route in its current (possibly edited) step order.
export function routePreview(record,steps,register,byId){
  const ids=[],stops=[],skipped=[];
  const start=register.endpoints.find(e=>e.id===record.from),end=register.endpoints.find(e=>e.id===record.to);
  if(start?.access_id)ids.push(start.access_id);
  steps.forEach((s,i)=>{
    if(s.kind==='point'){ids.push(s.point_id);stops.push({index:i,kind:'step',id:s.point_id});return;}
    const c=register.connections.find(c=>c.id===s.connection_id),path=c?.path||[s.from,s.to];
    const seq=(path[0]===s.from?path:[...path].reverse()).filter(id=>{if(byId.has(id))return true;skipped.push(id);return false;});
    ids.push(...seq);if(seq.length)stops.push({index:i,kind:'connection',id:seq[0],name:c?.name||s.connection_id});
  });
  if(end?.access_id)ids.push(end.access_id);
  const missing=ids.filter(id=>!byId.has(id));
  if(missing.length)return {error:'경로의 포인트 ID를 확인하세요: '+missing.slice(0,3).join(', '),missing};
  if(ids.length<2)return {error:'경로에 표시할 포인트가 2개 이상 필요합니다.'};
  const ps=ids.map(id=>byId.get(id));
  return {coordinates:ps.map(p=>p.slice(2,5)),floors:ps.map(p=>p[1]),skipped,
    stops:stops.map(s=>({...s,floor:byId.get(s.id)[1],point:byId.get(s.id).slice(2,5)})),start:start?.name,end:end?.name};
}
// Map-drawn routes use the reviewed walking graph (/data/experience/walk-graph.json): clicks snap to level floor
// cells, and a straight segment that would cross a wall is replaced by waypoints along walkable cells.
export function walkGraphIndex(graph){return {graph,ix:buildWalkIndex(graph),byId:new Map(graph.points.map((p,i)=>[p[0],i]))};}
export function snapGround(wg,floor,[lon,lat,h],{radius=3}={}){
  const [x,y]=toLocal(wg.ix,lon,lat),i=snapWalkable(wg.ix,floor,x,y,h,radius);if(i<0)return null;
  const p=wg.graph.points[i];return {id:p[0],point:[p[2],p[3],p[4]],d:Math.hypot(p[5]-x,p[6]-y)};
}
const floorCell=(wg,id)=>typeof id==='string'&&id.startsWith('GRID-')?wg.byId.get(id):undefined;
// true: the straight walk stays on walkable cells; false: it leaves them (wall, void); null: not judged (stairs, other floor).
export function segmentClear(wg,aId,bId){
  const a=floorCell(wg,aId),b=floorCell(wg,bId);if(a===undefined||b===undefined)return null;
  const A=wg.graph.points[a],B=wg.graph.points[b];if(A[1]!==B[1])return null;
  return lineHeight(wg.ix,A[1],A[5],A[6],A[4],B[5],B[6])!==null;
}
function floorPath(wg,a,b){
  const P=wg.graph.points,adj=wg.graph.adj,floor=P[a][1],tx=P[b][5],ty=P[b][6],h=i=>Math.hypot(P[i][5]-tx,P[i][6]-ty);
  const g=new Map([[a,0]]),came=new Map(),done=new Set(),heap=[[h(a),a]];
  const push=(f,i)=>{heap.push([f,i]);let k=heap.length-1;while(k){const q=(k-1)>>1;if(heap[q][0]<=heap[k][0])break;[heap[q],heap[k]]=[heap[k],heap[q]];k=q;}};
  const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;for(let k=0;;){const l=2*k+1,r=l+1;let m=k;if(l<heap.length&&heap[l][0]<heap[m][0])m=l;if(r<heap.length&&heap[r][0]<heap[m][0])m=r;if(m===k)break;[heap[m],heap[k]]=[heap[k],heap[m]];k=m;}}return top[1];};
  while(heap.length){
    const i=pop();if(i===b)break;if(done.has(i))continue;done.add(i);
    for(const [j,d,link] of adj[i]){
      if(link||P[j][1]!==floor||!P[j][0].startsWith('GRID-'))continue;
      const next=g.get(i)+d;if(next<(g.get(j)??Infinity)){g.set(j,next);came.set(j,i);push(next+h(j),j);}
    }
  }
  if(a!==b&&!came.has(b))return null;
  const path=[b];while(path.at(-1)!==a)path.push(came.get(path.at(-1)));return path.reverse();
}
// Intermediate waypoint ids for a walk from a to b on one floor: [] when the straight line is already clear,
// null when it cannot be judged or no walkable path connects them.
export function detourPath(wg,aId,bId){
  const clear=segmentClear(wg,aId,bId);if(clear===null)return null;if(clear)return [];
  const path=floorPath(wg,wg.byId.get(aId),wg.byId.get(bId));if(!path)return null;
  const P=wg.graph.points,floor=P[path[0]][1],out=[];
  const sight=(i,j)=>lineHeight(wg.ix,floor,P[i][5],P[i][6],P[i][4],P[j][5],P[j][6])!==null;
  for(let k=0;k<path.length-1;){let j=k+1;while(j+1<path.length&&sight(path[k],path[j+1]))j++;if(j<path.length-1)out.push(P[path[j]][0]);k=j;}
  return out;
}
// Registered connection landings on one floor, with the floors each one leads to.
export function landingsOnFloor(connections,byId,floor,direction='both'){
  const out=[];
  for(const c of connections){
    if(direction==='both'&&c.direction!=='both')continue;
    const stops=c.kind==='elevator'&&Array.isArray(c.stops)?c.stops:[c.from,c.to];
    for(const id of stops){
      const p=byId.get(id);if(!p||p[1]!==floor)continue;
      const targets=(c.kind==='elevator'?stops.filter(s=>s!==id):id===c.from?[c.to]:c.direction==='both'?[c.from]:[]).map(t=>byId.get(t)).filter(Boolean);
      if(targets.length)out.push({connection:c,landing:id,point:p.slice(2,5),targets:targets.map(t=>({id:t[0],floor:t[1]}))});
    }
  }
  return out;
}
export const stepEntry=s=>s.kind==='point'?s.point_id:s.from;
export const stepExit=s=>s.kind==='point'?s.point_id:s.to;
// The server's save rules plus straight segments that leave the walkable floor.
export function routeIssues(route,register,byId,wg){
  const pointMap={get:id=>{const p=byId.get(id);return p&&{record_kind:'walk_point',floor:p[1]};}};
  const issues=routeSequenceIssues(route,{endpoints:register.endpoints,connections:register.connections,excluded_points:[]},pointMap),blocked=[];
  if(wg){
    let prev=register.endpoints.find(e=>e.id===route.from)?.access_id;
    route.steps.forEach((s,i)=>{if(segmentClear(wg,prev,stepEntry(s))===false)blocked.push({index:i,from:prev,to:stepEntry(s)});prev=stepExit(s);});
    const end=register.endpoints.find(e=>e.id===route.to)?.access_id;if(segmentClear(wg,prev,end)===false)blocked.push({index:route.steps.length,from:prev,to:end});
  }
  return {issues,blocked};
}
export function connectionPreview(c,byId){
  const ids=(c.path||c.stops||[c.from,c.to]).filter(id=>byId.has(id));
  if(ids.length<2)return {error:'층간연결 좌표가 부족합니다.'};
  const ps=ids.map(id=>byId.get(id));
  return {coordinates:ps.map(p=>p.slice(2,5)),floors:ps.map(p=>p[1]),ends:[ps[0],ps.at(-1)]};
}

// Values behind every arrow of the data relationship diagram for one date and hour.
export function dataFlowValues({catalog,network,timeline,usage,sales,register,overrides={},approved,points=[],date,hour,edgeValues=[]}){
  const t=timeline?.[date],entry=t?.entries?.[hour]||{},routeValues=t?.routes?.[hour]||[],hd=network?.headwayDwell?.endpoints||{};
  const endpoints={},perEndpoint=[];let real=0,model=0;
  for(const e of catalog?.endpoints||[]){
    const h=hd[e.id],d=h?.dates?.[date],dwell=h?.dwell_seconds?.[hour]??180,ambient=d?.ambient_hourly?.[hour]??h?.ambient_hourly?.[hour]??0;
    endpoints[e.id]={dwell,ambient};real+=d?.real_hourly?.[hour]||0;model+=d?.model_hourly?.[hour]||0;
    perEndpoint.push({id:e.id,name:e.name,mode:h?.mode||'entrance',dwell,ambient,arrivals:entry.by_endpoint?.[e.id]?.arrivals??null,departures:entry.by_endpoint?.[e.id]?.departures??null});
  }
  const comp=crowdComposition({routes:network?.routes||[],values:routeValues,edges:network?.edges||[],edgeValues,endpoints});
  let activeEdges=0,maxEdge=0;for(let k=1;k<edgeValues.length;k+=2)if(edgeValues[k]>0){activeEdges++;maxEdge=Math.max(maxEdge,edgeValues[k]);}
  const day=catalog?.dates?.indexOf(date)??-1,storeIds=Object.keys(usage?.stores||{});
  const storeUsage=storeIds.map(id=>usage.stores[id]?.hourly?.[day]?.[hour]).filter(Number.isFinite);
  const storeSales=Object.values(sales?.stores||{}).map(s=>s?.hourly?.[hour]).filter(Number.isFinite);
  const facilities=register?.facilities||[],origins=register?.origins||[],modes={};
  for(const o of origins)modes[o.mode]=(modes[o.mode]||0)+1;
  const access=facilities.filter(f=>(overrides['facilities:'+f.id]?.access_id??f.access_id)).length;
  return {
    date,hour,origins:origins.length,modes,endpoints:perEndpoint.length,perEndpoint,
    arrivals:entry.arrivals??null,departures:entry.departures??null,
    routes:network?.routes?.length||0,registeredRoutes:register?.routes?.length||0,routeFlow:sum(routeValues),
    edges:network?.edges?.length||0,activeEdges,maxEdge,connections:register?.connections?.length||0,walkPoints:points.length,
    real,model,ambient:comp.ambient,walking:comp.walking,dwell:comp.dwell,expected:comp.expected,
    stores:storeIds.length,storeUsage:storeUsage.length?sum(storeUsage):null,storeSales:storeSales.length?sum(storeSales):null,
    facilities:facilities.length,access,facades:facilities.filter(f=>approved?.has(f.source_id)).length,
    facadeEdits:facilities.filter(f=>overrides['facilities:'+f.id]?.facade_url).length,
  };
}

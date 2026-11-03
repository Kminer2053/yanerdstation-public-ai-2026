import {connectionPairs,connectionPath,routeStepsVia} from '../src/location-workbench-core.js';
export const distance=(a,b)=>Math.hypot(...a.enu.map((v,i)=>v-b.enu[i]));
const tread=p=>p.point_kind==='connector_tread';
class Heap{
  a=[];
  push(item){let i=this.a.length;this.a.push(item);while(i){const p=(i-1)>>1;if(this.a[p][0]<=item[0])break;this.a[i]=this.a[p];i=p;}this.a[i]=item;}
  pop(){const root=this.a[0],last=this.a.pop();if(this.a.length){let i=0;while(i*2+1<this.a.length){let j=i*2+1;if(j+1<this.a.length&&this.a[j+1][0]<this.a[j][0])j++;if(this.a[j][0]>=last[0])break;this.a[i]=this.a[j];i=j;}this.a[i]=last;}return root;}
}
export function buildWalkingGraph(grid,state,{segment=()=>true}={}){
  const excluded=new Set(state.excluded_points),all=new Map(grid.points.filter(p=>!excluded.has(p.review_id)).map(p=>[p.review_id,p]));
  // Interior stair endpoints require their own movement surface, not a silent
  // relocation to a floor slab. Other stairs use the registered path as a unit.
  const endpointModels=new Set(state.endpoints.flatMap(e=>{const p=all.get(e.access_id);if(!p)throw Error(`출도착점 누락: ${e.name}`);return tread(p)?p.source_ids:[];}));
  const points=[...all.values()].filter(p=>!tread(p)||p.source_ids.some(id=>endpointModels.has(id)));
  const ids=new Map(points.map((p,i)=>[p.review_id,i])),adj=points.map(()=>[]),bins=new Map(),size=4;
  const bin=(p)=>`${p.floor}:${Math.floor(p.enu[0]/size)}:${Math.floor(p.enu[1]/size)}`;
  for(const p of points){const k=bin(p);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(p);}
  const near=(p,r)=>{const rows=[];for(let x=Math.floor((p.enu[0]-r)/size);x<=Math.floor((p.enu[0]+r)/size);x++)for(let y=Math.floor((p.enu[1]-r)/size);y<=Math.floor((p.enu[1]+r)/size);y++)rows.push(...(bins.get(`${p.floor}:${x}:${y}`)||[]));return rows;};
  let walkingEdges=0,connectionEdges=0;
  const add=(a,b,cost,connection_id=null)=>{if(ids.has(a)&&ids.has(b)&&cost>0)adj[ids.get(a)].push({to:ids.get(b),cost,connection_id});};
  for(const [i,p] of points.entries())for(const q of near(p,3.1)){
    if(ids.get(q.review_id)<=i)continue;
    const dx=Math.abs(p.enu[0]-q.enu[0]),dy=Math.abs(p.enu[1]-q.enu[1]),dz=Math.abs(p.enu[2]-q.enu[2]),flat=!tread(p)&&!tread(q);
    if(flat){if(dx>grid.spacing_m+.001||dy>grid.spacing_m+.001||dx+dy<.01||dz>.35)continue;}
    else if(tread(p)&&tread(q)){if(!p.source_ids.some(id=>q.source_ids.includes(id))||Math.hypot(dx,dy)>1.01||dz>.65)continue;}
    else if(Math.hypot(dx,dy)>3.1||dz>.5)continue;
    if(!segment(p,q))continue;
    const d=distance(p,q);add(p.review_id,q.review_id,d);add(q.review_id,p.review_id,d);walkingEdges++;
  }
  const connect=(c,a,b)=>{
    const path=connectionPath(c,a,b);if(!path||path.some(id=>!all.has(id)))return;
    const cost=path.slice(1).reduce((sum,id,i)=>sum+distance(all.get(path[i]),all.get(id)),0);
    add(a,b,cost,c.id);connectionEdges++;
  };
  for(const c of state.connections){
    for(const [a,b] of connectionPairs(c)){connect(c,a,b);if(c.direction==='both')connect(c,b,a);}
    if(c.kind!=='elevator'&&c.path)for(const id of c.path.slice(1,-1)){
      if(!ids.has(id))continue;
      for(const stop of [c.from,c.to])if(all.get(stop)?.floor!==all.get(id)?.floor){connect(c,id,stop);connect(c,stop,id);}
    }
  }
  return {points,ids,adj,all,stats:{nodes:points.length,walkingEdges,connectionEdges,metric:'3D ENU metres',spacing_m:grid.spacing_m}};
}
export function shortestFrom(graph,start){
  const n=graph.points.length,cost=new Float64Array(n).fill(Infinity),previous=new Array(n),startIndex=graph.ids.get(start);
  if(startIndex===undefined)throw Error(`그래프 시작점 누락 ${start}`);
  const heap=new Heap();cost[startIndex]=0;heap.push([0,startIndex]);
  while(heap.a.length){const [d,i]=heap.pop();if(d!==cost[i])continue;for(const edge of graph.adj[i]){const next=d+edge.cost;if(next<cost[edge.to]-1e-9){cost[edge.to]=next;previous[edge.to]={from:i,edge};heap.push([next,edge.to]);}}}
  return {cost,previous};
}
export function shortestPath(graph,result,end){
  const i=graph.ids.get(end);if(i===undefined||!Number.isFinite(result.cost[i]))return null;
  const edges=[];let at=i;
  while(result.previous[at]){const {from,edge}=result.previous[at];edges.push({from:graph.points[from].review_id,to:graph.points[at].review_id,cost:edge.cost,connection_id:edge.connection_id});at=from;}
  edges.reverse();return {distance_m:result.cost[i],edges};
}
function straight(a,b,c){
  const u=b.enu.map((v,i)=>v-a.enu[i]),v=c.enu.map((x,i)=>x-b.enu[i]);
  return Math.abs(u[0]*v[1]-u[1]*v[0])<1e-7&&u[0]*v[0]+u[1]*v[1]>0&&Math.abs(distance(a,b)+distance(b,c)-distance(a,c))<.00001;
}
export function pathSteps(path,pointMap){
  const steps=[];let run=[];
  const flush=()=>{const compact=[];for(const id of run){while(compact.length>1&&straight(pointMap.get(compact.at(-2)),pointMap.get(compact.at(-1)),pointMap.get(id)))compact.pop();compact.push(id);}steps.push(...compact.slice(1,-1).map(point_id=>({kind:'point',point_id})));run=[];};
  for(const e of path.edges){
    if(e.connection_id){flush();steps.push({kind:'connection',connection_id:e.connection_id,from:e.from,to:e.to});}
    else {if(!run.length)run.push(e.from);run.push(e.to);}
  }
  flush();return steps;
}
export function proposeShortestRoutes(graph,state,{sourceRevision,batchId}){
  const routes=[],unreachable=[],results=new Map(state.endpoints.map(e=>[e.id,shortestFrom(graph,e.access_id)]));
  for(let i=0;i<state.endpoints.length;i++)for(let j=i+1;j<state.endpoints.length;j++){
    const a=state.endpoints[i],b=state.endpoints[j],ab=a.role!=='end'&&b.role!=='start'?shortestPath(graph,results.get(a.id),b.access_id):null,ba=b.role!=='end'&&a.role!=='start'?shortestPath(graph,results.get(b.id),a.access_id):null;
    const reverseSafe=ab&&ba&&Math.abs(ab.distance_m-ba.distance_m)<1e-6&&ab.edges.every(e=>!e.connection_id||state.connections.find(c=>c.id===e.connection_id)?.direction==='both');
    const candidates=reverseSafe?[[a,b,ab,'both']]:[[a,b,ab,'forward'],[b,a,ba,'forward']];
    for(const [from,to,path,direction] of candidates){
      if(!path){unreachable.push({from:from.id,to:to.id,from_name:from.name,to_name:to.name});continue;}
      const steps=pathSteps(path,graph.all),route={name:`${from.name} ${direction==='both'?'↔':'→'} ${to.name}`,from:from.id,to:to.id,direction,status:'draft',steps};
      routes.push({...route,via:routeStepsVia(route,state),distance_m:Number(path.distance_m.toFixed(2)),generation:{method:'dijkstra-mesh-checked-grid-v1',batch_id:batchId,source_revision:sourceRevision,raw_point_ids:[from.access_id,...path.edges.map(e=>e.to)],connection_ids:path.edges.filter(e=>e.connection_id).map(e=>e.connection_id),notes:'현행 모델 보행 격자 및 등록된 층간연결의 거리 최소 후보. 대기시간·개찰구 통제·현장 운행 방향 미검수. 좌표/출도착점 이동 없음.'}});
    }
  }
  return {routes,unreachable};
}

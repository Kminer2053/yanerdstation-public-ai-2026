// Shared client/server movement rules. All coordinates are local metres, never latitude/longitude.
export const POSES=['idle','wave','bow','cheer','sit','jump'];
export const PALETTE=['#35766a','#c77c50','#7285a4','#9b6c87','#b8a36b','#73846a'];
export const SPAWN=Object.freeze([10,20]);
const RADIUS=.18;
const segmentDistance=(x,z,ax,az,bx,bz)=>{const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-ax-t*dx,z-az-t*dz);};
const insidePolygon=(x,z,polygon)=>{let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
export function walkIndex(walk,barriers=[],floor='2F',footprints=[]){
 const buckets=new Map();for(const line of barriers){const [ax,az,bx,bz]=line;for(let x=Math.floor((Math.min(ax,bx)-RADIUS)/2);x<=Math.floor((Math.max(ax,bx)+RADIUS)/2);x++)for(let z=Math.floor((Math.min(az,bz)-RADIUS)/2);z<=Math.floor((Math.max(az,bz)+RADIUS)/2);z++){const key=x+','+z;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(line);}}
 const solids=new Map();for(const polygon of footprints){const xs=polygon.map(p=>p[0]),zs=polygon.map(p=>p[1]);for(let x=Math.floor(Math.min(...xs)/2);x<=Math.floor(Math.max(...xs)/2);x++)for(let z=Math.floor(Math.min(...zs)/2);z<=Math.floor(Math.max(...zs)/2);z++){const key=x+','+z;if(!solids.has(key))solids.set(key,[]);solids.get(key).push(polygon);}}
 const nodes=walk.points.map((_,i)=>i).filter(i=>!walk.floors||walk.floors[i]===floor),eligible=new Set(nodes);
 return {walk,floor,nodes,eligible,buckets,solids,edgeValidity:new Map(),cells:new Map(nodes.map(i=>{const p=walk.points[i];return [Math.round(p[0]/walk.step)+','+Math.round(p[2]/walk.step),i];}))};
}
export function cellAt(index,x,z){return index.cells.get(Math.round(x/index.walk.step)+','+Math.round(z/index.walk.step))??-1;}
export function validPoint(index,x,z){const key=Math.floor(x/2)+','+Math.floor(z/2);return Number.isFinite(x)&&Number.isFinite(z)&&cellAt(index,x,z)>=0&&!(index.buckets?.get(key)||[]).some(line=>segmentDistance(x,z,...line)<RADIUS)&&!(index.solids?.get(key)||[]).some(p=>insidePolygon(x,z,p));}
export function groundAt(index,x,z){const i=cellAt(index,x,z);return i<0?0:index.walk.points[i][1];}
export function makeIndexes(hall,architecture,custom={}){return Object.fromEntries(Object.keys(hall.floors||{'2F':{}}).map(floor=>[floor,walkIndex(hall.walk,[...(architecture.barriersByFloor?.[floor]||(floor==='2F'?architecture.barriers:[])||[]),...(custom.barriersByFloor?.[floor]||[])],floor,custom.footprintsByFloor?.[floor]||[])]));}
export function traversable(index,from,to){
 if(!validPoint(index,from[0],from[1])||!validPoint(index,to[0],to[1]))return false;
 const length=Math.hypot(to[0]-from[0],to[1]-from[1]),n=Math.max(1,Math.ceil(length/.25));let previous=cellAt(index,...from);
 for(let k=1;k<=n;k++){const x=from[0]+(to[0]-from[0])*k/n,z=from[1]+(to[1]-from[1])*k/n,i=cellAt(index,x,z);if(!validPoint(index,x,z)||i!==previous&&!index.walk.edges[previous].includes(i))return false;previous=i;}
 return true;
}
export function slide(index,x,z,dx,dz){
 for(const p of [[x+dx,z+dz],[x+dx,z],[x,z+dz]])if(traversable(index,[x,z],p))return p;
 return [x,z];
}
export function nearestCell(index,x,z){let best=-1,d=Infinity;for(const i of index.nodes){const p=index.walk.points[i],v=(p[0]-x)**2+(p[2]-z)**2;if(v<d&&validPoint(index,p[0],p[2])){d=v;best=i;}}return best;}
export function pathTo(index,start,end){
 if(start<0||end<0||!index.eligible.has(start)||!index.eligible.has(end))return [];const seen=new Map([[start,-1]]),queue=[start];
 for(let k=0;k<queue.length;k++){const i=queue[k];if(i===end)break;for(const n of index.walk.edges[i])if(index.eligible.has(n)&&!seen.has(n)){const key=Math.min(i,n)+','+Math.max(i,n);let valid=index.edgeValidity.get(key);if(valid===undefined){const a=index.walk.points[i],b=index.walk.points[n];valid=traversable(index,[a[0],a[2]],[b[0],b[2]]);index.edgeValidity.set(key,valid);}if(valid){seen.set(n,i);queue.push(n);}}}
 if(!seen.has(end))return [];const result=[];for(let i=end;i!==-1;i=seen.get(i))result.push(index.walk.points[i]);return result.reverse();
}
export const shortAngle=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export function directedConnections(hall){return (hall.connections||[]).flatMap(c=>[{...c,via:c.id},...(c.direction==='both'?[{...c,via:c.id,from:c.to,to:c.from,actualpath:[...c.actualpath].reverse()}]:[])]);}
export function relocationNode(hall,indexes,id){const n=hall.walk.pointIds?.indexOf(id)??-1;if(n<0)return null;const floor=hall.walk.floors[n],p=hall.walk.points[n],index=indexes[floor];return index&&validPoint(index,p[0],p[2])?{id,node:n,floor,point:p}:null;}
// Small binary-heap Dijkstra over the existing walk graph and registered floor links.
export function routeAcross(hall,indexes,fromFloor,x,z,toFloor,tx,tz){
 const a=indexes[fromFloor],b=indexes[toFloor];if(!a||!b)return null;const start=nearestCell(a,x,z),end=nearestCell(b,tx,tz);if(start<0||end<0)return null;
 const links=new Map();for(const c of directedConnections(hall)){if(!links.has(c.from.node))links.set(c.from.node,[]);links.get(c.from.node).push(c);}
 const cost=new Map([[start,0]]),back=new Map(),heap=[[0,start]],visited=new Set();
 const push=item=>{heap.push(item);for(let i=heap.length-1;i>0;){const p=(i-1)>>1;if(heap[p][0]<=heap[i][0])break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p;}};
 const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){heap[0]=last;for(let i=0;;){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&heap[c+1][0]<heap[c][0])c++;if(heap[i][0]<=heap[c][0])break;[heap[i],heap[c]]=[heap[c],heap[i]];i=c;}}return first;};
 while(heap.length){const [distance,node]=pop();if(visited.has(node))continue;visited.add(node);if(node===end)break;const floor=hall.walk.floors[node],ix=indexes[floor],p=hall.walk.points[node],neighbors=[];
  for(const next of hall.walk.edges[node]){if(!ix.eligible.has(next))continue;const q=hall.walk.points[next],key=Math.min(node,next)+','+Math.max(node,next);let valid=ix.edgeValidity.get(key);if(valid===undefined){valid=traversable(ix,[p[0],p[2]],[q[0],q[2]]);ix.edgeValidity.set(key,valid);}if(valid)neighbors.push({node:next,length:Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2])});}
  for(const connection of links.get(node)||[]){const q=connection.to.point,ix2=indexes[connection.to.floor];if(ix2&&validPoint(ix2,q[0],q[2]))neighbors.push({node:connection.to.node,length:connection.actualpath.reduce((s,v,i,path)=>s+(i?Math.hypot(...v.map((n,k)=>n-path[i-1][k])):0),0),connection});}
  for(const edge of neighbors){const score=distance+edge.length;if(score<(cost.get(edge.node)??Infinity)){cost.set(edge.node,score);back.set(edge.node,{node,connection:edge.connection});push([score,edge.node]);}}
 }
 if(!cost.has(end))return null;const parts=[];for(let n=end;n!==start;){const edge=back.get(n);if(!edge)return null;parts.push(edge.connection?{points:edge.connection.actualpath,connection:edge.connection}:{points:[hall.walk.points[edge.node],hall.walk.points[n]]});n=edge.node;}return {points:parts.reverse().flatMap(p=>p.points),connections:parts.filter(p=>p.connection).map(p=>p.connection),distance:cost.get(end)};
}
export function travelDuration(path){return Math.max(2500,Math.min(9000,path.reduce((s,p,i)=>s+(i?Math.hypot(...p.map((v,k)=>v-path[i-1][k])):0),0)/3.4*1000));}
export function sampleTravel(travel,elapsedMs){const path=travel.path;if(!path?.length)return null;const segments=path.slice(1).map((p,i)=>Math.hypot(...p.map((v,k)=>v-path[i][k]))),total=segments.reduce((a,b)=>a+b,0);let target=Math.max(0,Math.min(1,elapsedMs/travel.durationMs))*total;for(let i=0;i<segments.length;i++){if(target<=segments[i]){const t=segments[i]?target/segments[i]:0,a=path[i],b=path[i+1];return {x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,z:a[2]+(b[2]-a[2])*t,yaw:Math.atan2(b[0]-a[0],-(b[2]-a[2]))};}target-=segments[i];}const p=path.at(-1);return {x:p[0],y:p[1],z:p[2],yaw:0};}

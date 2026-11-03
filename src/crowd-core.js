// Crowd placement helpers built on the reviewed 2 m walking grid. Pure functions: no Cesium, no DOM.
export const GRID_STEP=2;
const cellKey=(f,cx,cy)=>(f*8192+cx+4096)*8192+cy+4096;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function rand(o){let s=o.rs|0||1;s^=s<<13;s^=s>>>17;s^=s<<5;o.rs=s;return (s>>>0)/4294967296;}

export function buildWalkIndex(graph){
  const o=graph.origin,pts=graph.points,floors=new Map(),cells=new Map();
  let n=0,sl=0,sll=0,sx=0,sxl=0,sa=0,saa=0,sy=0,sya=0;
  for(const p of pts){if(!p[0].startsWith('GRID-'))continue;const dl=p[2]-o.lon,da=p[3]-o.lat;n++;sl+=dl;sll+=dl*dl;sx+=p[5];sxl+=p[5]*dl;sa+=da;saa+=da*da;sy+=p[6];sya+=p[6]*da;}
  const mx=(n*sxl-sl*sx)/(n*sll-sl*sl),bx=(sx-mx*sl)/n,my=(n*sya-sa*sy)/(n*saa-sa*sa),by=(sy-my*sa)/n;
  pts.forEach((p,i)=>{
    if(!p[0].startsWith('GRID-'))return;
    if(!floors.has(p[1]))floors.set(p[1],floors.size);
    const k=cellKey(floors.get(p[1]),Math.round(p[5]/GRID_STEP),Math.round(p[6]/GRID_STEP)),list=cells.get(k);
    if(list)list.push(i);else cells.set(k,[i]);
  });
  return {graph,floors,cells,lon0:o.lon,lat0:o.lat,mx,bx,my,by};
}
export const toLocal=(ix,lon,lat)=>[ix.mx*(lon-ix.lon0)+ix.bx,ix.my*(lat-ix.lat0)+ix.by];
export const toLonLat=(ix,x,y)=>[ix.lon0+(x-ix.bx)/ix.mx,ix.lat0+(y-ix.by)/ix.my];

// Grid point standing at (x,y) on this floor whose level is closest to h, or -1 (wall, void, other level).
export function cellAt(ix,floor,x,y,h,tol=1.2){
  const f=ix.floors.get(floor);if(f===undefined)return -1;
  const list=ix.cells.get(cellKey(f,Math.round(x/GRID_STEP),Math.round(y/GRID_STEP)));if(!list)return -1;
  let best=-1,bd=tol;for(const i of list){const d=Math.abs(ix.graph.points[i][4]-h);if(d<=bd){bd=d;best=i;}}
  return best;
}
// Height at the end of a straight walk that stays on walkable cells without jumping levels, else null.
export function lineHeight(ix,floor,x0,y0,h0,x1,y1,step=.6){
  const n=Math.max(1,Math.ceil(Math.hypot(x1-x0,y1-y0)/step));let h=h0;
  for(let k=1;k<=n;k++){const c=cellAt(ix,floor,x0+(x1-x0)*k/n,y0+(y1-y0)*k/n,h,.6);if(c<0)return null;h=ix.graph.points[c][4];}
  return h;
}
export function snapWalkable(ix,floor,x,y,h,maxRadius=8){
  let c=cellAt(ix,floor,x,y,h,2);if(c>=0)return c;
  for(let r=1;r<=maxRadius;r++)for(let k=0;k<16;k++){const a=k*Math.PI/8;c=cellAt(ix,floor,x+Math.cos(a)*r,y+Math.sin(a)*r,h,2);if(c>=0)return c;}
  return -1;
}
// One first-person step on walkable cells, keeping a small body gap ahead; slides along a wall instead of stopping dead.
export function slideMove(ix,floor,x,y,h,dx,dy,probe=.4){
  const at=(mx,my)=>{
    const l=Math.hypot(mx,my);if(!l)return null;
    const c=cellAt(ix,floor,x+mx,y+my,h,.6);if(c<0)return null;
    const ch=ix.graph.points[c][4];if(cellAt(ix,floor,x+mx+mx/l*probe,y+my+my/l*probe,ch,.6)<0)return null;
    return {x:x+mx,y:y+my,h:ch,cell:c};
  };
  return at(dx,dy)||(dx?at(dx,0):null)||(dy?at(0,dy):null);
}
// Heading (clockwise from north) with the longest open walk, so a first-person start does not face a wall.
export function openHeading(ix,floor,x,y,h,reach=12){
  let best=0,bestLen=-1;
  for(let k=0;k<16;k++){
    const a=k*Math.PI/8;let len=0,hh=h;
    for(let d=1;d<=reach;d++){const c=cellAt(ix,floor,x+Math.sin(a)*d,y+Math.cos(a)*d,hh,.6);if(c<0)break;hh=ix.graph.points[c][4];len=d;}
    if(len>bestLen){bestLen=len;best=a;}
  }
  return best;
}
// Marker spot for a facility: its walkway access point, or the facade point pulled 1.5 m out along its front normal
// (focus.cameraHeading is the side the facade faces, where the viewing camera stands), on the floor level.
export function facilitySpot(ix,f){
  let lon,lat,h;
  if(Array.isArray(f.access)&&f.access.length===3&&f.access.every(Number.isFinite))[lon,lat,h]=f.access;
  else if(f.reference&&[f.reference.lon,f.reference.lat,f.reference.height].every(Number.isFinite)){
    ({lon,lat,height:h}=f.reference);const hd=Number(f.reference.focus?.cameraHeading);
    if(Number.isFinite(hd)){const a=hd*Math.PI/180,[x,y]=toLocal(ix,lon,lat);[lon,lat]=toLonLat(ix,x+Math.sin(a)*1.5,y+Math.cos(a)*1.5);}
    h-=1.8;
  }else return null;
  const [x,y]=toLocal(ix,lon,lat),c=snapWalkable(ix,f.floor,x,y,h,4);
  if(c<0)return [lon,lat,h];
  const p=ix.graph.points[c];
  return Array.isArray(f.access)?[lon,lat,p[4]]:[p[2],p[3],p[4]];
}
export function walkNeighbors(ix,i){
  const g=ix.graph,f=g.points[i][1];
  return g.adj[i].filter(e=>!e[2]&&g.points[e[0]][1]===f&&g.points[e[0]][0].startsWith('GRID-')).map(e=>e[0]);
}

// Route centreline with wall clearance on each side, so walkers can spread across the corridor width.
export function buildLane(ix,route,{maxWidth=9,margin=1,slope=.6,step=.5,smooth=2}={}){
  const src=route.coordinates,n=src.length,floors=route.floors,ids=route.point_ids||[];
  const X=new Float64Array(n),Y=new Float64Array(n),H=new Float64Array(n),stair=new Uint8Array(n);
  for(let i=0;i<n;i++){[X[i],Y[i]]=toLocal(ix,src[i][0],src[i][1]);H[i]=src[i][2];}
  for(let i=0;i<n;i++)stair[i]=String(ids[i]||'').startsWith('TREAD-')||(i>0&&floors[i]!==floors[i-1])||(i<n-1&&floors[i]!==floors[i+1])?1:0;
  const SX=Float64Array.from(X),SY=Float64Array.from(Y);
  for(let i=1;i<n-1;i++){
    if(stair[i])continue;let sx=0,sy=0,c=0;
    for(let k=Math.max(0,i-smooth);k<=Math.min(n-1,i+smooth);k++)if(!stair[k]&&floors[k]===floors[i]){sx+=X[k];sy+=Y[k];c++;}
    const x=sx/c,y=sy/c;
    if(cellAt(ix,floors[i],x,y,H[i])>=0){SX[i]=x;SY[i]=y;}
  }
  const onGrid=k=>cellAt(ix,floors[k],SX[k],SY[k],H[k],.6)>=0;
  const walkable=(a,b)=>floors[a]!==floors[b]||!onGrid(a)||!onGrid(b)||lineHeight(ix,floors[b],SX[a],SY[a],H[a],SX[b],SY[b])!==null;
  for(let pass=0,changed=true;changed&&pass<6;pass++){
    changed=false;
    for(let i=1;i<n;i++)if(!walkable(i-1,i)){for(const k of [i-1,i])if(SX[k]!==X[k]||SY[k]!==Y[k]){SX[k]=X[k];SY[k]=Y[k];changed=true;}}
  }
  const NX=new Float64Array(n),NY=new Float64Array(n),L=new Float64Array(n),R=new Float64Array(n),S=new Float64Array(n);
  for(let i=0;i<n;i++){const a=Math.max(0,i-1),b=Math.min(n-1,i+1),tx=SX[b]-SX[a],ty=SY[b]-SY[a],l=Math.hypot(tx,ty)||1;NX[i]=ty/l;NY[i]=-tx/l;}
  for(let i=0;i<n;i++){
    if(stair[i]||cellAt(ix,floors[i],SX[i],SY[i],H[i])<0)continue;
    for(const side of [1,-1]){
      let h=H[i],ok=0;
      for(let d=step/2;d<=maxWidth+margin;d+=step){const c=cellAt(ix,floors[i],SX[i]+side*NX[i]*d,SY[i]+side*NY[i]*d,h,.6);if(c<0)break;h=ix.graph.points[c][4];ok=d;}
      (side>0?R:L)[i]=clamp(ok-margin,0,maxWidth);
    }
  }
  for(let i=1;i<n;i++)S[i]=S[i-1]+Math.hypot(SX[i]-SX[i-1],SY[i]-SY[i-1],H[i]-H[i-1]);
  for(const A of [L,R]){
    for(let i=1;i<n;i++)A[i]=Math.min(A[i],A[i-1]+slope*(S[i]-S[i-1]));
    for(let i=n-2;i>=0;i--)A[i]=Math.min(A[i],A[i+1]+slope*(S[i+1]-S[i]));
  }
  return {n,X:SX,Y:SY,H,S,NX,NY,L,R,floors,length:S[n-1]};
}
// Point at distance s along the lane, pushed sideways by u (-1 left wall … 1 right wall) and faded in near both ends.
export function lanePoint(ix,lane,s,u,out={}){
  const S=lane.S,n=lane.n;let i=clamp(out.i|0,0,n-2);
  while(i<n-2&&S[i+1]<=s)i++;while(i>0&&S[i]>s)i--;
  const seg=S[i+1]-S[i],t=seg>0?clamp((s-S[i])/seg,0,1):0,lerp=A=>A[i]+(A[i+1]-A[i])*t;
  const x=lerp(lane.X),y=lerp(lane.Y),h=lerp(lane.H),floor=t<.5?lane.floors[i]:lane.floors[i+1];
  let nx=lerp(lane.NX),ny=lerp(lane.NY);const nl=Math.hypot(nx,ny)||1;nx/=nl;ny/=nl;
  const clear=u>=0?lerp(lane.R):lerp(lane.L),taper=clamp(Math.min((s-S[1])/6,(S[n-2]-s)/6),0,1),off=u*clear*taper;
  out.i=i;out.x=x;out.y=y;out.h=h;out.floor=floor;
  if(off){const c=cellAt(ix,floor,x+nx*off,y+ny*off,h,.8);if(c>=0){out.x=x+nx*off;out.y=y+ny*off;out.h=ix.graph.points[c][4];}}
  return out;
}

// Same occupancy terms the scene has always reported: walking on edges + endpoint dwell + ambient.
export function crowdComposition({routes,values,edges=[],edgeValues=[],endpoints={}}){
  let walking=0;
  for(let k=0;k<edgeValues.length;k+=2){const e=edges[edgeValues[k]],v=edgeValues[k+1];if(e&&v>0)walking+=v/3600*((e.length_m||2)/1.25);}
  const routeW=routes.map((r,i)=>Math.max(0,Number(values?.[i])||0));
  if(!edgeValues.length)routes.forEach((r,i)=>{walking+=routeW[i]/3600*((r.distance_m||0)/1.25);});
  const dwellW=new Map(),ambientW=new Map(),add=(m,k,v)=>m.set(k,(m.get(k)||0)+v);let dwell=0,ambient=0;
  routes.forEach((r,i)=>{
    const v=routeW[i];if(!v)return;
    const a=v/3600*(endpoints[r.from_endpoint]?.dwell||0),b=v/3600*(endpoints[r.to_endpoint]?.dwell||0);
    if(a){add(dwellW,r.from_endpoint,a);dwell+=a;}if(b){add(dwellW,r.to_endpoint,b);dwell+=b;}
  });
  for(const id in endpoints){const a=Math.max(0,Number(endpoints[id].ambient)||0);if(a){ambientW.set(id,a);ambient+=a;}}
  return {expected:Math.round(walking+dwell+ambient),walking,dwell,ambient,routeW,dwellW,ambientW};
}
// Where the 2F concourse dwellers are drawn: the 3F hall takes its share (ratio and endpoints come from the
// circulation data, 3F walking area over 2F+3F) of the non-transfer dwellers counted at those endpoints, except in
// the overnight hours when they leave through the entrances. Totals are unchanged; returns the people shown upstairs
// and the ambient weight left at each endpoint.
export function upperShare(comp,share,hour=null){
  const off=Number.isInteger(hour)&&(share?.off_hours||[]).includes(hour);
  const ratio=off?0:clamp(Number(share?.ratio)||0,0,1),ids=new Set(share?.endpoints||[]),stay=new Map();let upper=0;
  for(const [id,w] of comp.ambientW){const up=ids.has(id)?w*ratio:0;upper+=up;stay.set(id,w-up);}
  return {upper,stay};
}
// Simulated ambient agents that circulate upstairs, in proportion to the people moved there.
export const upperAgents=(counts,comp,upper)=>comp.ambient>0?Math.min(counts.ambient,Math.round(counts.ambient*clamp(upper,0,comp.ambient)/comp.ambient)):0;
export function agentCounts(c,cap){
  const total=clamp(Math.min(cap,c.expected),0,Infinity),sum=c.walking+c.dwell+c.ambient;
  if(!total||!sum)return {total:0,walk:0,dwell:0,ambient:0};
  const walk=Math.round(total*c.walking/sum),dwell=Math.min(total-walk,Math.round(total*c.dwell/sum));
  return {total,walk,dwell,ambient:total-walk-dwell};
}
export function pickWeighted(items,r){
  let total=0;for(const [,w] of items)if(w>0)total+=w;if(!total)return null;
  let t=r*total;for(const [k,w] of items){if(!(w>0))continue;t-=w;if(t<=0)return k;}
  return items.filter(([,w])=>w>0).at(-1)[0];
}
// Nearest candidates get the limited person models; ones already shown as models are favoured to avoid flicker.
export function selectNearest(cands,capacity,keep=.8){
  if(cands.length<=capacity)return cands;
  const key=a=>a.model?a.d2*keep:a.d2;
  return cands.sort((a,b)=>key(a)-key(b)).slice(0,Math.max(0,capacity));
}
export function randomInPolygon(geo,r1,r2,r3){
  if(!geo)return null;if(geo.type==='Point')return geo.coordinates;
  const ring=geo.coordinates?.[0];if(!ring||ring.length<3)return null;
  const closed=ring.length>3&&ring[0][0]===ring.at(-1)[0]&&ring[0][1]===ring.at(-1)[1],n=closed?ring.length-1:ring.length;
  const areas=[];let total=0;
  for(let k=1;k<n-1;k++){const a=Math.abs((ring[k][0]-ring[0][0])*(ring[k+1][1]-ring[0][1])-(ring[k+1][0]-ring[0][0])*(ring[k][1]-ring[0][1]));areas.push(a);total+=a;}
  let t=r1*total,k=0;while(k<areas.length-1&&t>areas[k]){t-=areas[k];k++;}
  let u=r2,v=r3;if(u+v>1){u=1-u;v=1-v;}
  const A=ring[0],B=ring[k+1],D=ring[k+2];
  return [A[0]+u*(B[0]-A[0])+v*(D[0]-A[0]),A[1]+u*(B[1]-A[1])+v*(D[1]-A[1]),A[2]??0];
}

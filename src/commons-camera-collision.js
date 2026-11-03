// Static rendered triangles only: no guessed volumes and no movement changes.
// Position/index BufferAttributes are shared with their meshes. Rebuild this
// index if a mesh's geometry or world transform changes after construction.
const EPS=1e-8;
const opaque=material=>!!material&&material.visible!==false&&!material.transparent&&(material.opacity??1)>=1;
const visible=mesh=>{for(let object=mesh;object;object=object.parent)if(object.visible===false)return false;return true;};

function readTriangle(source,offset,out){
 const {position,index,matrix,identity}=source;
 for(let corner=0;corner<3;corner++){
  const vertex=index?index.getX(offset+corner):offset+corner,x=position.getX(vertex),y=position.getY(vertex),z=position.getZ(vertex),k=corner*3;
  if(identity){out[k]=x;out[k+1]=y;out[k+2]=z;}
  else{out[k]=matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12];out[k+1]=matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13];out[k+2]=matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14];}
 }
}

function intersection(ox,oy,oz,dx,dy,dz,limit,vertices){
 const ax=vertices[0],ay=vertices[1],az=vertices[2],e1x=vertices[3]-ax,e1y=vertices[4]-ay,e1z=vertices[5]-az,e2x=vertices[6]-ax,e2y=vertices[7]-ay,e2z=vertices[8]-az;
 const px=dy*e2z-dz*e2y,py=dz*e2x-dx*e2z,pz=dx*e2y-dy*e2x,det=e1x*px+e1y*py+e1z*pz;
 if(Math.abs(det)>1e-10){
  const inverse=1/det,tx=ox-ax,ty=oy-ay,tz=oz-az,u=(tx*px+ty*py+tz*pz)*inverse;
  if(u < -EPS||u>1+EPS)return Infinity;
  const qx=ty*e1z-tz*e1y,qy=tz*e1x-tx*e1z,qz=tx*e1y-ty*e1x,v=(dx*qx+dy*qy+dz*qz)*inverse;
  if(v < -EPS||u+v>1+EPS)return Infinity;
  const distance=(e2x*qx+e2y*qy+e2z*qz)*inverse;
  return distance>=-EPS&&distance<=limit+EPS?Math.max(0,distance):Infinity;
 }
 // A ray exactly along a wall plane must not end inside that drawn triangle.
 // Clip its projected 2D segment against the actual three edges.
 const nx=e1y*e2z-e1z*e2y,ny=e1z*e2x-e1x*e2z,nz=e1x*e2y-e1y*e2x,length=Math.hypot(nx,ny,nz);
 if(length<1e-12||Math.abs((ox-ax)*nx+(oy-ay)*ny+(oz-az)*nz)>EPS*length||Math.abs(dx*nx+dy*ny+dz*nz)>EPS*length)return Infinity;
 const drop=Math.abs(nx)>=Math.abs(ny)&&Math.abs(nx)>=Math.abs(nz)?0:Math.abs(ny)>=Math.abs(nz)?1:2,uAxis=drop===0?1:0,vAxis=drop===2?1:2;
 const ou=uAxis===0?ox:oy,ov=vAxis===2?oz:oy,du=uAxis===0?dx:dy,dv=vAxis===2?dz:dy;
 const signedArea=(vertices[3+uAxis]-vertices[uAxis])*(vertices[6+vAxis]-vertices[vAxis])-(vertices[3+vAxis]-vertices[vAxis])*(vertices[6+uAxis]-vertices[uAxis]),sign=signedArea>=0?1:-1;
 let near=0,far=limit;
 for(let i=0;i<3;i++){
  const j=(i+1)%3,au=vertices[i*3+uAxis],av=vertices[i*3+vAxis],eu=vertices[j*3+uAxis]-au,ev=vertices[j*3+vAxis]-av,side=sign*(eu*(ov-av)-ev*(ou-au)),slope=sign*(eu*dv-ev*du);
  if(Math.abs(slope)<1e-12){if(side < -EPS)return Infinity;continue;}
  const boundary=(-EPS-side)/slope;if(slope>0)near=Math.max(near,boundary);else far=Math.min(far,boundary);
  if(near>far+EPS)return Infinity;
 }
 return near>=-EPS&&near<=limit+EPS?Math.max(0,near):Infinity;
}

/**
 * clip(from, to, target) writes the first safe point on this segment and returns
 * whether a rendered triangle was hit. All vector aliases are supported.
 * Rays/output are capped at maxDistance (12 m by default); use this for walking
 * cameras, not long-range overview cameras. A zero-length ray is unchanged.
 */
export function createCameraCollision(meshes,{cellSize=8,clearance=.18,maxDistance=12}={}){
 if(!Array.isArray(meshes)||!Number.isFinite(cellSize)||cellSize<1||cellSize>32||!Number.isFinite(clearance)||clearance<0||clearance>1||!Number.isFinite(maxDistance)||maxDistance<=0||maxDistance>32)throw new TypeError('Invalid camera collision input');
 const started=performance.now(),sources=[],scratch=new Float64Array(9),grid=new Map();let total=0,references=0;
 for(const mesh of meshes){
  if(!mesh?.geometry||mesh.isInstancedMesh)continue;
  const geometry=mesh.geometry,position=geometry.getAttribute('position'),index=geometry.getIndex();if(!position||position.itemSize<3)continue;
  mesh.updateWorldMatrix?.(true,false);
  const matrix=new Float64Array(mesh.matrixWorld.elements),identity=matrix.every((value,i)=>value===(i%5===0?1:0)),count=index?.count??position.count,drawStart=Math.max(0,geometry.drawRange.start),drawEnd=Math.min(count,Number.isFinite(geometry.drawRange.count)?drawStart+geometry.drawRange.count:count);
  const ranges=Array.isArray(mesh.material)?geometry.groups.map(group=>({start:Math.max(drawStart,group.start),end:Math.min(drawEnd,group.start+group.count),materialIndex:group.materialIndex})): [{start:drawStart,end:drawEnd,materialIndex:null}];
  for(const range of ranges){
   const material=range.materialIndex===null?mesh.material:mesh.material[range.materialIndex];if(!opaque(material)||range.end<=range.start)continue;
   if(!Number.isInteger(range.start)||range.start%3||!Number.isInteger(range.end)||range.end%3)throw new TypeError('Camera collision requires complete triangles');
   sources.push({mesh,position,index,matrix,identity,...range});total+=(range.end-range.start)/3;
  }
 }
 if(total>1_000_000)throw new RangeError('Camera collision triangle budget exceeded');
 let sourceIds=sources.length<=65535?new Uint16Array(total):new Uint32Array(total),offsets=new Uint32Array(total),heights=new Float32Array(total*2),seen=new Uint32Array(total),active=new Uint8Array(sources.length),stamp=0,id=0;
 for(let sourceId=0;sourceId<sources.length;sourceId++){
  const source=sources[sourceId];
  for(let offset=source.start;offset<source.end;offset+=3,id++){
   readTriangle(source,offset,scratch);if(!scratch.every(Number.isFinite))throw new TypeError('Camera collision geometry contains invalid coordinates');
   sourceIds[id]=sourceId;offsets[id]=offset;heights[id*2]=Math.min(scratch[1],scratch[4],scratch[7]);heights[id*2+1]=Math.max(scratch[1],scratch[4],scratch[7]);
   const x0=Math.floor(Math.min(scratch[0],scratch[3],scratch[6])/cellSize),x1=Math.floor(Math.max(scratch[0],scratch[3],scratch[6])/cellSize),z0=Math.floor(Math.min(scratch[2],scratch[5],scratch[8])/cellSize),z1=Math.floor(Math.max(scratch[2],scratch[5],scratch[8])/cellSize);
   if((x1-x0+1)*(z1-z0+1)>4096)throw new RangeError('Camera collision triangle extent exceeded');
   for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const key=x+','+z;let cell=grid.get(key);if(!cell){cell=[];grid.set(key,cell);}cell.push(id);references++;}
  }
 }
 let gridBytes=0;for(const [key,ids]of grid){const compact=new Uint32Array(ids);grid.set(key,compact);gridBytes+=compact.byteLength;}
 const stats={meshes:sources.length,triangles:total,cells:grid.size,references,typedBytes:sourceIds.byteLength+offsets.byteLength+heights.byteLength+seen.byteLength+active.byteLength+scratch.byteLength+sources.reduce((sum,s)=>sum+s.matrix.byteLength,0)+gridBytes,buildMs:performance.now()-started,queries:0,lastCandidates:0,lastTriangleTests:0};let disposed=false;
 return {
  stats,
  clip(from,to,target){
   const ox=from.x,oy=from.y,oz=from.z,tx=to.x,ty=to.y,tz=to.z;
   if(![ox,oy,oz,tx,ty,tz].every(Number.isFinite)||typeof target?.set!=='function')throw new TypeError('Camera collision requires finite vectors and an output vector');
   const fullLength=Math.hypot(tx-ox,ty-oy,tz-oz);if(disposed||fullLength<EPS){target.set(tx,ty,tz);return false;}
   const dx=(tx-ox)/fullLength,dy=(ty-oy)/fullLength,dz=(tz-oz)/fullLength,outputLimit=Math.min(fullLength,maxDistance),limit=Math.min(outputLimit+clearance,maxDistance),endX=ox+dx*limit,endY=oy+dy*limit,endZ=oz+dz*limit,minY=Math.min(oy,endY)-1e-5,maxY=Math.max(oy,endY)+1e-5;
   stats.queries++;stats.lastCandidates=0;stats.lastTriangleTests=0;stamp=(stamp+1)>>>0;if(!stamp){seen.fill(0);stamp=1;}
   for(let i=0;i<sources.length;i++){const source=sources[i],material=source.materialIndex===null?source.mesh.material:source.mesh.material[source.materialIndex];active[i]=visible(source.mesh)&&opaque(material)?1:0;}
   let nearest=limit,hit=false;
   const x0=Math.floor(Math.min(ox,endX)/cellSize),x1=Math.floor(Math.max(ox,endX)/cellSize),z0=Math.floor(Math.min(oz,endZ)/cellSize),z1=Math.floor(Math.max(oz,endZ)/cellSize);
   for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){
    const cell=grid.get(x+','+z);if(!cell)continue;
    for(let n=0;n<cell.length;n++){
     const triangle=cell[n];if(seen[triangle]===stamp)continue;seen[triangle]=stamp;stats.lastCandidates++;
     const sourceId=sourceIds[triangle];if(!active[sourceId]||heights[triangle*2]>maxY||heights[triangle*2+1]<minY)continue;
     readTriangle(sources[sourceId],offsets[triangle],scratch);stats.lastTriangleTests++;
     const distance=intersection(ox,oy,oz,dx,dy,dz,nearest,scratch);if(distance<=nearest){nearest=distance;hit=true;}
    }
   }
   const distance=hit?Math.min(outputLimit,Math.max(0,nearest-clearance)):outputLimit;target.set(ox+dx*distance,oy+dy*distance,oz+dz*distance);return hit;
  },
  dispose(){disposed=true;grid.clear();sources.length=0;sourceIds=offsets=heights=seen=active=null;},
 };
}

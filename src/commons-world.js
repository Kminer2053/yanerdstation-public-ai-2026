import * as T from 'three';
import {PALETTE,validPoint,nearestCell,routeAcross} from './commons-core.js';
import {createDetailStreaming} from './commons-textures.js';
import {createCommonsScreens} from './commons-screens.js';
import {createCustomWorld} from './commons-custom.js';
import {createConnectionMarkers} from './commons-connections.js';
import {createCameraCollision} from './commons-camera-collision.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function geometry(positions,uv,indices){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));if(uv)g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));if(indices)g.setIndex(Array.isArray(indices)?indices:new T.BufferAttribute(indices,1));g.computeVertexNormals();return g;}
function pattern(ceiling=false){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d');c.fillStyle=ceiling?'#d7d9d2':'#c8c9bd';c.fillRect(0,0,512,512);
 const n=ceiling?10:6,s=512/n;c.strokeStyle=ceiling?'#bfc5bf':'#abb4aa';c.lineWidth=1;
 for(let i=0;i<n;i++){c.beginPath();c.moveTo(i*s,0);c.lineTo(i*s,512);c.stroke();c.beginPath();c.moveTo(0,i*s);c.lineTo(512,i*s);c.stroke();}
 if(ceiling){const glow=c.createRadialGradient(256,256,10,256,256,100);glow.addColorStop(0,'#ffffff');glow.addColorStop(.4,'#f5fcff');glow.addColorStop(1,'#d7d9d200');c.fillStyle=glow;c.fillRect(156,156,200,200);c.fillStyle='#97a4a0';c.fillRect(228,228,56,56);c.fillStyle='#fcffff';c.fillRect(233,233,46,46);}
 else{for(let i=0;i<1100;i++){const x=(i*137.3)%512,y=(i*83.67)%512;c.fillStyle=i%2?'#fff1':'#5361520e';c.fillRect(x,y,1.5,1.5);}c.strokeStyle='#d4d6c9';c.lineWidth=5;c.strokeRect(0,0,512,512);}
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=4;return texture;
}
function skyTexture(sunset=false){
 const c=document.createElement('canvas');c.width=1024;c.height=512;const ctx=c.getContext('2d'),g=ctx.createLinearGradient(0,0,0,512);
 g.addColorStop(0,sunset?'#586a8b':'#71abd0');g.addColorStop(.55,sunset?'#ebbe9c':'#d1e6ec');g.addColorStop(1,sunset?'#f0d8b7':'#ecf0e7');ctx.fillStyle=g;ctx.fillRect(0,0,1024,512);
 for(let i=0;i<32;i++){const x=(i*193.7)%1024,y=110+(i*53)%160;const cloud=ctx.createRadialGradient(x,y,2,x,y,90);cloud.addColorStop(0,sunset?'#ffedda66':'#ffffff88');cloud.addColorStop(1,'#ffffff00');ctx.fillStyle=cloud;ctx.save();ctx.translate(0,y*.5);ctx.scale(1,.5);ctx.fillRect(x-95,y-95,190,190);ctx.restore();}
 const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;return texture;
}
function avatarBatch(scene){
 const capacity=32,parts=[],dummy=new T.Object3D(),color=new T.Color();
 const add=(name,g,mat,count=capacity)=>{const mesh=new T.InstancedMesh(g,mat,count);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.count=0;scene.add(mesh);parts.push({name,mesh});return mesh;};
 const basic=(c,opts={})=>new T.MeshStandardMaterial({color:c,roughness:.95,...opts});
 const torso=add('torso',new T.CylinderGeometry(.24,.21,.62,8),basic('#ffffff'));
 add('hips',new T.BoxGeometry(.39,.22,.26),basic('#455760'));
 add('head',new T.SphereGeometry(.17,10,8),basic('#d2aa82'));
 add('neck',new T.CylinderGeometry(.065,.07,.15,7),basic('#d2aa82'));
 add('hair',new T.SphereGeometry(.174,10,6,0,Math.PI*2,0,Math.PI*.52),basic('#303d38'));
 add('arms',new T.CylinderGeometry(.065,.06,.53,7),basic('#ffffff'),capacity*2);
 add('hands',new T.SphereGeometry(.07,7,6),basic('#d2aa82'),capacity*2);
 add('legs',new T.CylinderGeometry(.086,.075,.64,7),basic('#3f515b'),capacity*2);
 add('feet',new T.BoxGeometry(.15,.11,.28),basic('#2c3d3d'),capacity*2);
 add('eyes',new T.SphereGeometry(.022,5,4),new T.MeshBasicMaterial({color:'#28362e'}),capacity*2);
 add('shadow',new T.CircleGeometry(.32,16),new T.MeshBasicMaterial({color:'#263b31',transparent:true,opacity:.17,depthWrite:false,side:T.DoubleSide}));
 const localRotation=new T.Euler(),yawRotation=new T.Quaternion(),axisY=new T.Vector3(0,1,0),boneDirection=new T.Vector3(),boneQuaternion=new T.Quaternion(),boneEuler=new T.Euler();
 const put=(mesh,i,p,offset,rotation=[0,0,0],scale=1)=>{const yaw=-p.yaw,cos=Math.cos(yaw),sin=Math.sin(yaw);dummy.position.set(p.x+offset[0]*cos+offset[2]*sin,(p.y||0)+offset[1]+(p.jump||0),p.z-offset[0]*sin+offset[2]*cos);dummy.quaternion.setFromEuler(localRotation.set(...rotation)).premultiply(yawRotation.setFromAxisAngle(axisY,yaw));dummy.scale.setScalar(scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);};
 return {update(actors,time){
  const people=actors.slice(0,capacity);
  for(const [i,p] of people.entries()){
   const wave=p.pose==='wave',bow=p.pose==='bow',cheer=p.pose==='cheer',sit=p.pose==='sit',phase=p.moving?Math.sin(time*8+i)*.5:0,sink=sit?-.4:0;
   const shirt=p.npc?'#97a28e':PALETTE[p.color%PALETTE.length];
   for(const part of parts){const {mesh,name}=part;const double=['arms','hands','legs','feet','eyes'].includes(name);mesh.count=people.length*(double?2:1);
    if(name==='torso'){put(mesh,i,p,[0,1.12+sink,0],[bow?.52:0,0,0]);mesh.setColorAt(i,color.set(shirt));}
    else if(name==='hips')put(mesh,i,p,[0,.76+sink,0]);
    else if(name==='head'||name==='hair')put(mesh,i,p,[0,1.68+sink,bow?-.2:0],[bow?.35:0,0,0]);
    else if(name==='neck')put(mesh,i,p,[0,1.47+sink,bow?-.06:0],[bow?.35:0,0,0]);
    else if(name==='shadow'){const ground={...p,jump:0};put(mesh,i,ground,[0,.025,0],[-Math.PI/2,0,0],1+(p.jump||0)*.3);}
    else for(let side=0;side<2;side++){
     const sign=side?1:-1,j=i*2+side;
     if(name==='eyes')put(mesh,j,p,[sign*.06,1.71+sink,(bow?-.2:0)-.148]);
     if(name==='legs')put(mesh,j,p,[sign*.115,.43+sink,sit?-.24:Math.sin(phase*sign)*.14],[sit?Math.PI/2:phase*sign,0,0]);
     if(name==='feet')put(mesh,j,p,[sign*.115,.09+Math.max(0,phase*sign)*.08,sit?-.56:-.045+Math.sin(phase*sign)*.22]);
     const raised=cheer||wave&&side===1,shoulder=[sign*.235,1.38+sink,0],delta=raised?[sign*(cheer?.28:.2),.43,wave?Math.sin(time*10)*.11:0]:[sign*.045,-.52*Math.cos(phase*sign),bow?-.18:-Math.sin(phase*sign)*.52];
     if(name==='arms'){boneQuaternion.setFromUnitVectors(axisY,boneDirection.set(...delta).normalize());boneEuler.setFromQuaternion(boneQuaternion);put(mesh,j,p,shoulder.map((v,k)=>v+delta[k]/2),[boneEuler.x,boneEuler.y,boneEuler.z]);mesh.setColorAt(j,color.set(shirt));}
     if(name==='hands')put(mesh,j,p,shoulder.map((v,k)=>v+delta[k]));
    }
    mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
   }
  }
  if(!people.length)parts.forEach(p=>p.mesh.count=0);
 },dispose(){for(const p of parts){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();}}};
}
export async function createCommonsWorld({host,hall,architecture,custom,indexes,onFacility,onPosition,onError,onStats}){
 let currentFloor='2F',index=indexes[currentFloor];
 const mobile=matchMedia('(max-width:650px)').matches,renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.25:1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;host.append(renderer.domElement);
 const scene=new T.Scene();scene.background=new T.Color('#dce7e4');scene.fog=new T.Fog('#dce7e4',140,500);
 const camera=new T.PerspectiveCamera(58,1,.07,1200),look=new T.Vector3(),desired=new T.Vector3();camera.position.set(18,19,26);look.set(0,.8,0);camera.lookAt(look);
 const ambient=new T.HemisphereLight('#f5faf4','#9d9581',2.4),sun=new T.DirectionalLight('#fff4db',2.1);sun.position.set(-20,40,8);scene.add(ambient,sun);
 const daySky=skyTexture(),eveningSky=skyTexture(true),sky=new T.Mesh(new T.SphereGeometry(1000,24,12),new T.MeshBasicMaterial({map:daySky,side:T.BackSide,depthWrite:false,fog:false,toneMapped:false}));scene.add(sky);
 const floorTexture=pattern(),floor=new T.Mesh(new T.PlaneGeometry(hall.extent[2]-hall.extent[0]+15,hall.extent[3]-hall.extent[1]+15),new T.MeshStandardMaterial({map:floorTexture,roughness:.92,color:'#dce0d5'}));floor.rotation.x=-Math.PI/2;floor.position.set((hall.extent[0]+hall.extent[2])/2,-.025,(hall.extent[1]+hall.extent[3])/2);floorTexture.repeat.set((hall.extent[2]-hall.extent[0]+15)/3.6,(hall.extent[3]-hall.extent[1]+15)/3.6);scene.add(floor);
 const ceilingPositions=hall.ceilings.flat(2),ceilingUV=hall.ceilings.flatMap(t=>t.flatMap(p=>[p[0]/6,p[2]/6]));
 const roof=new T.Mesh(geometry(ceilingPositions,ceilingUV),new T.MeshBasicMaterial({map:pattern(true),side:T.DoubleSide,color:'#f6f7ed',toneMapped:false}));scene.add(roof);
 const pavement=new T.InstancedMesh(new T.BoxGeometry(1.95,.012,1.95),new T.MeshStandardMaterial({color:'#d6d8c9',roughness:1,transparent:true,opacity:.26}),hall.walk.points.length),dummy=new T.Object3D();
 hall.walk.points.forEach((p,i)=>{dummy.position.set(p[0],p[1]-.012,p[2]);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();pavement.setMatrixAt(i,dummy.matrix);});scene.add(pavement);
 const pointCloud=new T.Points(new T.BufferGeometry(),new T.PointsMaterial({color:'#498e77',size:3,sizeAttenuation:false,transparent:true,opacity:.75,depthWrite:false}));scene.add(pointCloud);
 // Load the merged two-floor architectural shell without original tile payloads.
 const shellResponse=await fetch(architecture.url+'?v='+architecture.version);if(!shellResponse.ok)throw Error('서울역 건축 형상을 불러오지 못했어요.');const shellBytes=await shellResponse.arrayBuffer(),shells=[];
 const architectureTexture=architecture.texture?await new T.TextureLoader().loadAsync(architecture.texture+'?v='+architecture.version):null;if(architectureTexture){architectureTexture.colorSpace=T.SRGBColorSpace;architectureTexture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());}
 for(const group of architecture.groups){const positions=new Float32Array(shellBytes,group.positions.byteOffset,group.positions.count),indices=new Uint32Array(shellBytes,group.indices.byteOffset,group.indices.count),uv=group.uv?new Float32Array(shellBytes,group.uv.byteOffset,group.uv.count):null,material=new T.MeshStandardMaterial({...group.material,map:uv?architectureTexture:null,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1,depthWrite:!group.material.transparent});const g=geometry(positions,uv,indices);if(group.kind==='floors'){const tileUV=[];for(let i=0;i<positions.length;i+=3)tileUV.push(positions[i]/3.6/floorTexture.repeat.x,positions[i+2]/3.6/floorTexture.repeat.y);g.setAttribute('uv',new T.Float32BufferAttribute(tileUV,2));material.map=floorTexture;material.color.set('#dce0d5');}const mesh=new T.Mesh(g,material);mesh.name=group.name;mesh.userData={floor:group.floor,kind:group.kind,roofContext:group.roofContext};scene.add(mesh);shells.push(mesh);}
 const texture=await new T.TextureLoader().loadAsync(hall.atlas+'?v='+hall.version);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
 const shops=[];for(const floor of Object.keys(hall.floors)){const positions=[],uv=[],triangles=[],pickIds=[];for(const f of hall.facades.filter(f=>f.floor===floor)){const offset=positions.length/3;positions.push(...f.positions);uv.push(...f.uv);triangles.push(...f.indices.map(i=>i+offset));for(let i=0;i<f.indices.length/3;i++)pickIds.push(f.facilityId);}const mesh=new T.Mesh(geometry(positions,uv,triangles),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));mesh.renderOrder=2;mesh.userData={floor,pickIds};scene.add(mesh);shops.push(mesh);}
 const actors=avatarBatch(scene),ray=new T.Raycaster(),pointer=new T.Vector2();
 let route=null,overview=true,overviewZoom=1,dark=false,dirty=true,distance=5.3,disposed=false,lastStats=0,renderCount=0,frames=0,frameMs=0,lastActorState='',snapCamera=false;
 const projected=new T.Vector3();
 const customWorld=await createCustomWorld({scene,custom,onChange:()=>dirty=true});
 const details=createDetailStreaming({scene,renderer,hall:{...hall,facades:[...hall.facades,...custom.photos]},architecture,shells,mobile,onChange:()=>dirty=true});
 const screens=await createCommonsScreens(scene,hall,()=>dirty=true);
 const markers=createConnectionMarkers(scene,hall);
 const cameraCollision=createCameraCollision([...shells,roof,...shops,...customWorld.meshes]);
 const ceilingAt=(x,z,min)=>{let height=Infinity;for(const [a,b,c] of hall.ceilings){if(Math.min(a[1],b[1],c[1])<min)continue;const det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(det)<1e-8)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det;if(u>=0&&v>=0&&u+v<=1)height=Math.min(height,u*a[1]+v*b[1]+(1-u-v)*c[1]);}return height;};
 const applyVisibility=()=>{roof.visible=!overview&&currentFloor==='2F';floor.visible=!overview||currentFloor==='2F';pavement.visible=!overview;pointCloud.visible=overview;for(const mesh of shells)mesh.visible=!overview||mesh.userData.floor===currentFloor&&mesh.userData.kind!=='roof';for(const mesh of shops)mesh.visible=!overview||mesh.userData.floor===currentFloor;customWorld.setVisibility(currentFloor,overview);markers.setFloor(currentFloor,overview);screens.setVisibility?.(currentFloor,overview);pointCloud.geometry.dispose();pointCloud.geometry=new T.BufferGeometry().setFromPoints(index.nodes.filter(i=>{const p=hall.walk.points[i];return validPoint(index,p[0],p[2]);}).map(i=>{const p=hall.walk.points[i];return new T.Vector3(p[0],p[1]+.06,p[2]);}));dirty=true;};
 applyVisibility();
 const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();dirty=true;};const observer=new ResizeObserver(resize);observer.observe(host);resize();
 const contextLost=e=>{e.preventDefault();onError?.('3D 그래픽 연결이 중단되었습니다. 페이지를 다시 열어 주세요.');};renderer.domElement.addEventListener('webglcontextlost',contextLost);
 return {
  get canvas(){return renderer.domElement;},
  setFloor(floor){if(!indexes[floor])return;currentFloor=floor;index=indexes[floor];applyVisibility();snapCamera=true;},
  setOverview(on){overview=on;applyVisibility();if(!on)snapCamera=true;},
  setDistance(change){if(overview)overviewZoom=clamp(overviewZoom+change*.1,.4,1.8);else distance=clamp(distance+change,2.5,8);dirty=true;},
  frameFacility(size){if(Array.isArray(size)&&size.every(Number.isFinite)){distance=clamp(Math.max(size[0],size[2]*1.5)*.75,5.3,8);snapCamera=true;dirty=true;}},
  light(){dark=!dark;sky.material.map=dark?eveningSky:daySky;scene.background.set(dark?'#ddc4a6':'#dce7e4');scene.fog.color.copy(scene.background);sun.color.set(dark?'#ffc18a':'#fff4db');sun.intensity=dark?1.3:2.1;ambient.intensity=dark?2:2.4;dirty=true;return dark;},
  pick(x,y){const box=renderer.domElement.getBoundingClientRect();pointer.set((x-box.left)/box.width*2-1,-(y-box.top)/box.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(shops.filter(m=>m.visible))[0],other=customWorld.pick(ray);if(other&&(!hit||other.distance<hit.distance)){onFacility?.(other.facilityId||'asset:'+other.assetId);return;}if(hit&&hit.object.userData.pickIds[hit.faceIndex]){onFacility?.(hit.object.userData.pickIds[hit.faceIndex]);return;}if(overview){const p=ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-hall.floors[currentFloor].height),new T.Vector3());if(p){const n=nearestCell(index,p.x,p.z);if(n>=0&&Math.hypot(hall.walk.points[n][0]-p.x,hall.walk.points[n][2]-p.z)<2.3)onPosition?.(hall.walk.pointIds[n]);}}},
  routeTo(floor,x,z,facility){if(route){scene.remove(route);route.geometry.dispose();route.material.dispose();route=null;}if(!facility?.access)return false;const plan=routeAcross(hall,indexes,floor,x,z,facility.floor||floor,facility.access[0],facility.access[2]);if(!plan)return false;const points=plan.points.length?plan.points:[hall.walk.points[nearestCell(indexes[floor],x,z)]];const g=new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(p[0],p[1]+.07,p[2])));route=new T.Line(g,new T.LineBasicMaterial({color:'#d1a03f'}));scene.add(route);dirty=true;return plan;},
  tick({self,people,time,dt,active}){
   if(disposed)return;let unsettled=false;
   if(overview){const f=hall.floors[currentFloor],e=f.extent,w=e[2]-e[0],d=e[3]-e[1],cx=(e[0]+e[2])/2,cz=(e[1]+e[3])/2,halfFov=Math.min(camera.fov*Math.PI/360,Math.atan(Math.tan(camera.fov*Math.PI/360)*camera.aspect)),range=Math.hypot(w,d)/2/Math.sin(halfFov)*1.04*overviewZoom;desired.set(.25,.95,.48).normalize().multiplyScalar(range).add(new T.Vector3(cx,f.height,cz));look.set(cx,f.height,cz);}
   else if(self.inTransit){
    desired.set(self.x,(self.y||0)+1.55,self.z);look.set(self.x+Math.sin(self.yaw)*2,(self.y||0)+1.4,self.z-Math.cos(self.yaw)*2);
   }else{
    let d=distance;
    for(let r=.6;r<=distance;r+=.3){const x=self.x-Math.sin(self.yaw)*r,z=self.z+Math.cos(self.yaw)*r;if(!validPoint(index,x,z)){d=Math.max(.6,r-.25);break;}}
    desired.set(self.x-Math.sin(self.yaw)*d,(self.y||0)+1.5+d*.17+self.pitch*2.5,self.z+Math.cos(self.yaw)*d);look.set(self.x,(self.y||0)+1.35-self.pitch*.8+(self.jump||0)*.25,self.z);
    desired.y=clamp(desired.y,(self.y||0)+1.2,ceilingAt(desired.x,desired.z,(self.y||0)+1.85)-.22);
    cameraCollision.clip(look,desired,desired);
   }
   if(snapCamera){camera.position.copy(desired);snapCamera=false;}
   const gap=camera.position.distanceToSquared(desired);unsettled=gap>.00003;camera.position.lerp(desired,Math.min(1,dt*9));if(!overview&&!self.inTransit)cameraCollision.clip(look,camera.position,camera.position);camera.lookAt(look);
   const state=people.map(p=>[p.id,p.floor,p.x.toFixed(3),(p.y||0).toFixed(3),p.z.toFixed(3),p.yaw.toFixed(3),p.pose,p.color,(p.jump||0).toFixed(3)].join(',')).join('|');if(state!==lastActorState){dirty=true;lastActorState=state;}
   const closeCamera=!overview&&Math.hypot(camera.position.x-self.x,camera.position.z-self.z)<1.1;actors.update(overview?people.filter(p=>!p.self&&p.floor===currentFloor):closeCamera?people.filter(p=>!p.self):people,time);
   frames++;frameMs+=dt*1000;
   details.update(camera.position,time,overview,currentFloor,self.inTransit);screens.tick(time);markers.update(camera);
   if(active||unsettled||dirty){renderer.render(scene,camera);renderCount++;dirty=false;}
   if(!lastStats)lastStats=time;
   if(time-lastStats>1){const elapsed=time-lastStats;onStats?.({fps:Math.round(frames/elapsed),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries,renders:Math.round(renderCount/elapsed),detailTextures:details.count(),mobile});lastStats=time;frames=frameMs=renderCount=0;}
  },
  labels(people){return people.map(p=>{projected.set(p.x,(p.y||0)+2.05+(p.jump||0),p.z).project(camera);return {id:p.id,x:(projected.x*.5+.5)*host.clientWidth,y:(-projected.y*.5+.5)*host.clientHeight,visible:(!p.floor||p.floor===currentFloor)&&projected.z>-1&&projected.z<1&&Math.abs(projected.x)<1&&Math.abs(projected.y)<1&&Math.hypot(p.x-camera.position.x,p.z-camera.position.z)<23,npc:p.npc,self:p.self};});},
  invalidate(){dirty=true;},
  dispose(){disposed=true;observer.disconnect();renderer.domElement.removeEventListener('webglcontextlost',contextLost);cameraCollision.dispose();screens.dispose();markers.dispose();customWorld.dispose();details.dispose();actors.dispose();pointCloud.geometry.dispose();pointCloud.material.dispose();scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose();}}});daySky.dispose();eveningSky.dispose();renderer.dispose();renderer.domElement.remove();},
 };
}

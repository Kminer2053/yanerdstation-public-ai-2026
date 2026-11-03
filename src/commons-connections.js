import * as T from 'three';
import {directedConnections} from './commons-core.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const accent={'3F':'#37ded2','2F':'#f0c86a'};
function labelTexture(target){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
 const context=canvas.getContext('2d');if(!context)throw new Error('층간 이동 안내 이미지를 만들지 못했어요.');
 context.clearRect(0,0,512,256);context.beginPath();context.roundRect(8,8,496,240,36);
 context.fillStyle='#163a3df2';context.fill();context.strokeStyle=accent[target];context.lineWidth=8;context.stroke();
 context.font='700 132px system-ui, -apple-system, sans-serif';context.textAlign='center';context.textBaseline='middle';
 context.fillStyle='#ffffff';context.fillText((target==='3F'?'↑ ':'↓ ')+target,256,135);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;return texture;
}

// Each entry is the registered departure point of a directed connection. Two
// paths can share one physical landing; identical signs there are drawn once.
export function createConnectionMarkers(scene,hall){
 const entries=[],seen=new Set();
 for(const connection of directedConnections(hall)){
  const {from,to}=connection;
  if(!['2F','3F'].includes(from?.floor)||!['2F','3F'].includes(to?.floor)||from.floor===to.floor||!Array.isArray(from.point)||from.point.length!==3||!from.point.every(Number.isFinite))continue;
  const key=[from.floor,...from.point,to.floor].join(':');if(seen.has(key))continue;seen.add(key);entries.push({point:from.point,floor:from.floor,target:to.floor});
 }
 const ringGeometry=new T.RingGeometry(.49,.67,32);ringGeometry.rotateX(-Math.PI/2);
 const labelGeometry=new T.PlaneGeometry(2,1);
 const ringMaterial=new T.MeshBasicMaterial({color:'#ffffff',side:T.DoubleSide,depthTest:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const ring=new T.InstancedMesh(ringGeometry,ringMaterial,Math.max(1,entries.length));ring.name='commons-connection-rings';ring.frustumCulled=false;
 const labels=new Map(),meshes=[ring],textures=[],materials=[ringMaterial];
 try{
  for(const target of ['2F','3F']){
   const texture=labelTexture(target);textures.push(texture);
   const material=new T.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.05,side:T.DoubleSide,depthTest:true,depthWrite:false,toneMapped:false});materials.push(material);
   const mesh=new T.InstancedMesh(labelGeometry,material,Math.max(1,entries.filter(e=>e.target===target).length));mesh.name='commons-connection-label-'+target;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;meshes.push(mesh);labels.set(target,{mesh,entries:[]});
  }
 }catch(error){for(const mesh of meshes)mesh.dispose();for(const material of materials)material.dispose();for(const texture of textures)texture.dispose();ringGeometry.dispose();labelGeometry.dispose();throw error;}
 for(const mesh of meshes)scene.add(mesh);
 const dummy=new T.Object3D(),color=new T.Color(),billboard=new T.Quaternion(),cameraPoint=new T.Vector3(),entryPoint=new T.Vector3();
 let currentFloor=null,overview=false,disposed=false;
 function setFloor(floor,isOverview){
  if(disposed)return;
  if(currentFloor===floor&&overview===Boolean(isOverview))return;
  currentFloor=floor;overview=Boolean(isOverview);
  const active=entries.filter(entry=>entry.floor===floor);ring.count=active.length;ring.visible=active.length>0;
  for(let i=0;i<active.length;i++){
   const entry=active[i];dummy.position.set(entry.point[0],entry.point[1]+.045,entry.point[2]);dummy.quaternion.identity();dummy.scale.setScalar(1);dummy.updateMatrix();ring.setMatrixAt(i,dummy.matrix);ring.setColorAt(i,color.set(accent[entry.target]));
  }
  ring.instanceMatrix.needsUpdate=true;if(ring.instanceColor)ring.instanceColor.needsUpdate=true;
  for(const [target,record] of labels){record.entries=active.filter(entry=>entry.target===target);record.mesh.count=record.entries.length;record.mesh.visible=record.entries.length>0;}
 }
 function update(camera){
  if(disposed||!camera)return;
  camera.getWorldQuaternion(billboard);camera.getWorldPosition(cameraPoint);
  for(const {mesh,entries:active} of labels.values()){
   for(let i=0;i<active.length;i++){
    const entry=active[i];entryPoint.set(entry.point[0],entry.point[1]+2.3,entry.point[2]);
    const width=overview?clamp(cameraPoint.distanceTo(entryPoint)*.06,2.4,7):1.6;
    dummy.position.copy(entryPoint);dummy.quaternion.copy(billboard);dummy.scale.set(width/2,width/2,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
   }
   if(active.length)mesh.instanceMatrix.needsUpdate=true;
  }
 }
 setFloor('2F',false);
 return {
  setFloor,update,
  dispose(){if(disposed)return;disposed=true;for(const mesh of meshes){scene.remove(mesh);mesh.dispose();}ringGeometry.dispose();labelGeometry.dispose();for(const material of materials)material.dispose();for(const texture of textures)texture.dispose();},
 };
}

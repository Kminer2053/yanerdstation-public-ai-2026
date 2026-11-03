import {playPose} from '../src/exploration-play.js';

// A single, lazy-loaded instance of our existing CC0 commuter. No new asset download source.
export function createExplorerAvatar(C,viewer,{onError=()=>{}}={}){
 let model=null,loading=null,disposed=false,ready=false;
 const nodes=new Map(),names=['Hips','Spine','Head','LeftUpperArm','RightUpperArm','LeftForearm','RightForearm','LeftThigh','RightThigh','LeftShin','RightShin','LeftFoot','RightFoot'];
 async function load(){
  if(loading||disposed)return loading;
  loading=C.Model.fromGltfAsync({url:'/assets/walk-crowd/person-0.glb',scale:.98,allowPicking:false,show:false,shadows:C.ShadowMode.DISABLED}).then(m=>{
   if(disposed){m.destroy();return;}model=m;
   const init=()=>{if(disposed||ready)return;for(const name of names){const node=m.getNode(name);if(node)nodes.set(name,node);}ready=true;viewer.scene.requestRender();};
   if(m.ready)init();else m.readyEvent.addEventListener(init);
   viewer.scene.primitives.add(m);viewer.scene.requestRender();
  }).catch(()=>{if(!disposed)onError();});
  return loading;
 }
 return {
  load,
  get primitive(){return model;},
  update({visible,position,heading,walked,moving,play}){
   if(!model)return;model.show=Boolean(visible&&ready);if(!model.show)return;
   const pose=playPose(play,walked,moving),p=C.Cartesian3.fromDegrees(position[0],position[1],position[2]+play.jumpHeight);
   model.modelMatrix=C.Transforms.headingPitchRollToFixedFrame(p,new C.HeadingPitchRoll(heading-Math.PI/2+pose.yawOffset,0,0));
   for(const [name,node]of nodes){const a=pose.joints[name]||[0,0,0];
    const qx=C.Quaternion.fromAxisAngle(C.Cartesian3.UNIT_X,a[0]),qy=C.Quaternion.fromAxisAngle(C.Cartesian3.UNIT_Y,a[1]),qz=C.Quaternion.fromAxisAngle(C.Cartesian3.UNIT_Z,a[2]);
    const q=C.Quaternion.multiply(qz,C.Quaternion.multiply(qy,qx,new C.Quaternion()),new C.Quaternion());
    const rotation=C.Matrix4.fromTranslationQuaternionRotationScale(C.Cartesian3.ZERO,q,new C.Cartesian3(1,1,1));
    node.matrix=C.Matrix4.multiply(node.originalMatrix,rotation,new C.Matrix4());
   }
  },
  hide(){if(model)model.show=false;},
  destroy(){disposed=true;if(model&&!model.isDestroyed())viewer.scene.primitives.remove(model);model=null;nodes.clear();}
 };
}

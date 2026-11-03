// Cosmetic play never changes the navigation position, floor, or walkable-cell height.
export const POSES=Object.freeze({wave:'손 흔들기',bow:'인사',cheer:'만세',photo:'사진 포즈'});
const durations={wave:3,bow:2.4,cheer:3,photo:Infinity}; // Hold the photo pose until moving/jumping or switching views.
export const createPlayState=()=>({jumpTime:null,jumpHeight:0,pose:null,poseTime:0});
export function resetPlay(s){Object.assign(s,createPlayState());}
export function playAction(s,action,{mode,view,riding=false}){
 if(mode!=='explore'||view!=='third'||riding)return false;
 if(action==='jump'){if(s.jumpTime!==null)return false;s.jumpTime=0;s.pose=null;s.poseTime=0;return true;}
 if(!Object.hasOwn(POSES,action)||s.jumpTime!==null)return false;
 s.pose=action;s.poseTime=0;return true;
}
export function tickPlay(s,dt,{moving=false,riding=false}={}){
 dt=Math.max(0,Math.min(.08,dt||0));
 if(riding){resetPlay(s);return;}
 if(s.jumpTime!==null){s.jumpTime+=dt;if(s.jumpTime>=.72){s.jumpTime=null;s.jumpHeight=0;}else s.jumpHeight=.5*Math.sin(Math.PI*s.jumpTime/.72);}
 if(moving){s.pose=null;s.poseTime=0;}
 else if(s.pose){s.poseTime+=dt;if(s.poseTime>=durations[s.pose]){s.pose=null;s.poseTime=0;}}
}
// Joint-local radians for the existing commuter skeleton, all unspecified joints are neutral.
export function playPose(s,walked,moving){
 const swing=moving?Math.sin(walked*5):0;
 const joints={LeftThigh:[swing*.52,0,0],RightThigh:[-swing*.52,0,0],LeftShin:[Math.max(0,-swing)*.65,0,0],RightShin:[Math.max(0,swing)*.65,0,0],LeftUpperArm:[-swing*.32,0,-.06],RightUpperArm:[swing*.32,0,.06]};
 if(s.jumpTime!==null){joints.LeftUpperArm=[-.3,0,-.65];joints.RightUpperArm=[-.3,0,.65];joints.LeftShin=[.35,0,0];joints.RightShin=[.35,0,0];}
 const t=s.poseTime,e=s.pose?Math.min(1,t/.25,(durations[s.pose]-t)/.3):0;
 if(s.pose==='wave'){joints.RightUpperArm=[0,0,e*(2.55+Math.sin(t*12)*.22)];joints.RightForearm=[0,0,e*.25];}
 if(s.pose==='bow'){joints.Spine=[Math.sin(Math.min(1,t/2.4)*Math.PI)*.55,0,0];joints.Head=[.15*e,0,0];}
 if(s.pose==='cheer'){joints.LeftUpperArm=[0,0,-2.65*e];joints.RightUpperArm=[0,0,2.65*e];}
 if(s.pose==='photo'){joints.RightUpperArm=[-.5*e,0,2.15*e];joints.RightForearm=[-.6*e,0,.35*e];joints.Head=[0,.15*e,-.14*e];}
 return {joints,yawOffset:s.pose?Math.PI:0};
}

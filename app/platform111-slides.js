export const PLATFORM111_SLIDES=Object.freeze({
 image:'/assets/seoul-platform111/ktx-poster.webp',
 text:'/assets/seoul-platform111/platform111-message.svg',
 aspect:2167/941,textAspect:3,holdMs:4000,
 creditHtml:'공개용 절차 생성 샘플 · 원본 KTX 사진 미포함',
 basis:'공개용 합성 이미지와 문구를 교대하는 시안. 실제 광고·실시간 방송 아님.'
});
const shared=new WeakMap();
// Both floor representations share a slow clock. Texture objects never change
// during playback: only a scalar switches between two preloaded still frames.
export function acquirePlatformSlides(viewer,notify,runtime={}){
 let controller=shared.get(viewer);
 if(!controller){
  const doc=runtime.document??document,reduce=runtime.reduce??matchMedia('(prefers-reduced-motion: reduce)');
  const later=runtime.setTimeout??setTimeout,cancel=runtime.clearTimeout??clearTimeout,users=new Set();
  let timer=null,index=0;
  const running=()=>!doc.hidden&&!reduce.matches&&[...users].some(u=>u.active);
  const announce=()=>{for(const u of users)u.notify(index);viewer.scene.requestRender();};
  const tick=()=>{timer=null;if(!running())return;index=1-index;announce();update();};
  function update(){
   if(!running()){if(timer!==null)cancel(timer);timer=null;if(reduce.matches&&index!==0){index=0;announce();}return;}
   if(timer===null)timer=later(tick,PLATFORM111_SLIDES.holdMs);
  }
  const changed=()=>update();doc.addEventListener('visibilitychange',changed);reduce.addEventListener('change',changed);
  controller={add(fn){const u={active:false,notify:fn};users.add(u);fn(index);return u;},set(u,value){if(u.active!==value){u.active=value;update();}},remove(u){users.delete(u);update();if(!users.size){doc.removeEventListener('visibilitychange',changed);reduce.removeEventListener('change',changed);shared.delete(viewer);}}};
  shared.set(viewer,controller);
 }
 const user=controller.add(notify);return {setActive(value){controller.set(user,!!value);},destroy(){controller.remove(user);}};
}

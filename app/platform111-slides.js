export const PLATFORM111_SLIDES=Object.freeze({
 image:'/assets/seoul-platform111/ktx-poster.webp',
 text:'/assets/seoul-platform111/platform111-message.svg',
 aspect:2167/941,textAspect:3,holdMs:4000,
 creditHtml:'KTX 사진: <a href="https://commons.wikimedia.org/wiki/File:KTX-1.jpg" target="_blank" rel="noopener noreferrer">Minseong Kim / Wikimedia Commons</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a> · 크기 축소·WebP 변환',
 basis:'KTX 열차 사진과 문구를 4초마다 교대하는 경량 시안. 실제 집행 광고·실시간 방송 아님.'
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

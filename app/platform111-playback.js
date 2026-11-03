export const PLATFORM111_FILM=Object.freeze({poster:'/assets/seoul-platform111/city-demo-poster.webp',mp4:'/assets/seoul-platform111/city-demo-loop.mp4',webm:'/assets/seoul-platform111/city-demo-loop.webm',aspect:3,duration:24,basis:'참고 영상의 색감·도시 풍경을 재구성한 시연용 반복 영상. 원본 광고·실시간 방송 아님.'});
const shared=new WeakMap();
// Share one decoder across the 2F and 3F representations; retain approved photos
// as fallback. Nothing is written to the catalogue or the locked editor state.
export function acquirePlatformFilm(viewer,onFrame){
 let controller=shared.get(viewer);
 if(!controller){
  const video=document.createElement('video'),reduce=matchMedia('(prefers-reduced-motion: reduce)'),users=new Set();
  video.muted=true;video.loop=true;video.playsInline=true;video.preload='none';video.crossOrigin='anonymous';
  video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('aria-hidden','true');
  video.hidden=true;video.dataset.platform111Media='city-demo';document.body.append(video);
  let loaded=false,failed=false,blocked=false,playing=false,pending=false,destroyed=false;
  const enabled=()=>!reduce.matches&&!navigator.connection?.saveData&&!document.hidden&&[...users].some(u=>u.active);
  const announce=()=>{for(const u of users)u.notify(!failed&&video.readyState>=2?video:null);viewer.scene.requestRender();};
  const update=()=>{
   const run=enabled()&&!failed&&!blocked;
   if(!run){if(playing||!video.paused)video.pause();playing=false;return;}
   if(!loaded){loaded=true;video.src=video.canPlayType('video/webm; codecs="vp9"')?PLATFORM111_FILM.webm:PLATFORM111_FILM.mp4;video.load();}
   if(!playing&&!pending){pending=true;video.play().then(()=>{pending=false;if(destroyed||!enabled()){video.pause();playing=false;}else playing=true;}).catch(()=>{pending=false;blocked=true;playing=false;announce();});}
  };
  const error=()=>{failed=true;playing=false;announce();};
  const gesture=()=>{blocked=false;update();};
  const changed=()=>{update();announce();};
  video.addEventListener('loadeddata',announce);video.addEventListener('error',error);
  document.addEventListener('visibilitychange',changed);document.addEventListener('pointerdown',gesture,{passive:true});reduce.addEventListener('change',changed);
  controller={users,video,reduce,update,enabled,add(notify){const u={active:false,notify};users.add(u);return u;},remove(u){users.delete(u);update();if(!users.size){destroyed=true;video.pause();video.removeAttribute('src');video.load();video.remove();video.removeEventListener('loadeddata',announce);video.removeEventListener('error',error);document.removeEventListener('visibilitychange',changed);document.removeEventListener('pointerdown',gesture);reduce.removeEventListener('change',changed);shared.delete(viewer);}},frame:u=>{u.notify(!failed&&video.readyState>=2?video:null);}};
  shared.set(viewer,controller);
 }
 const user=controller.add(onFrame);controller.frame(user);
 return {setActive(value){if(user.active!==value){user.active=value;controller.update();}},get motionAllowed(){return !controller.reduce.matches&&!navigator.connection?.saveData;},destroy(){controller.remove(user);}};
}

// Play only while the film is visible. Browser autoplay refusal leaves native controls usable.
export function bindScrollVideo(video,source,{reducedMotion=false,doc=document,Observer=globalThis.IntersectionObserver}={}){
  if(!video)return;
  let visible=false,autoPaused=true,userPaused=false,pending=false;
  const load=()=>{if(!video.getAttribute('src')){video.src=source;video.load();}};
  const sync=()=>{
    if(!visible||doc.hidden){autoPaused=true;video.pause();return;}
    load();
    if(reducedMotion||userPaused||pending||!video.paused)return;
    autoPaused=false;pending=true;
    Promise.resolve(video.play()).catch(()=>{video.dataset.autoplay='blocked';}).finally(()=>{
      pending=false;
      if(!visible||doc.hidden){autoPaused=true;video.pause();}
    });
  };
  video.addEventListener('pause',()=>{if(!autoPaused&&visible&&!doc.hidden)userPaused=true;});
  video.addEventListener('play',()=>{
    userPaused=false;autoPaused=false;video.dataset.autoplay='playing';
    if(!visible||doc.hidden){autoPaused=true;video.pause();}
  });
  doc.addEventListener('visibilitychange',sync);
  if(Observer){
    const observer=new Observer(entries=>{
      for(const entry of entries){visible=entry.isIntersecting&&entry.intersectionRatio>=.35;video.dataset.visible=String(visible);sync();}
    },{threshold:[0,.35]});
    observer.observe(video);
  }else{
    // Older browsers can still play the film explicitly.
    visible=true;load();
  }
}

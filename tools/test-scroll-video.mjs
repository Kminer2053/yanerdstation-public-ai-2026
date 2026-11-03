import assert from 'node:assert/strict';
import {bindScrollVideo} from '../src/scroll-video.js';

function fixture(reducedMotion=false){
  const doc=new EventTarget();doc.hidden=false;
  const video=new EventTarget();Object.assign(video,{dataset:{},paused:true,plays:0,loads:0,
    getAttribute(){return this.src;},load(){this.loads++;},
    play(){this.plays++;if(this.reject)return Promise.reject(Error('autoplay blocked'));this.paused=false;this.dispatchEvent(new Event('play'));return Promise.resolve();},
    pause(){if(!this.paused){this.paused=true;this.dispatchEvent(new Event('pause'));}}
  });
  let callback;
  class Observer{constructor(cb){callback=cb;}observe(target){assert.equal(target,video);}}
  bindScrollVideo(video,'/api/media/intro/promo-720.mp4',{doc,Observer,reducedMotion});
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  const visible=async ratio=>{callback([{isIntersecting:ratio>0,intersectionRatio:ratio}]);await tick();};
  const hidden=async value=>{doc.hidden=value;doc.dispatchEvent(new Event('visibilitychange'));await tick();};
  return {doc,video,visible,hidden,tick};
}
const f=fixture();
await f.visible(0);assert.equal(f.video.loads,0,'no offscreen download');
await f.visible(.1);assert.equal(f.video.plays,0,'wait for meaningful visibility');
await f.visible(.5);assert.equal(f.video.paused,false,'scroll entry autoplays');
await f.visible(0);assert.equal(f.video.paused,true,'scroll exit pauses');
await f.visible(.8);assert.equal(f.video.paused,false,'scroll return resumes');
await f.hidden(true);assert.equal(f.video.paused,true,'hidden tab pauses');
await f.hidden(false);assert.equal(f.video.paused,false,'visible tab resumes');
f.video.pause();await f.hidden(true);await f.hidden(false);assert.equal(f.video.paused,true,'manual pause is respected');
await f.video.play();await f.visible(0);await f.visible(.8);assert.equal(f.video.paused,false,'manual playback releases pause');
assert.equal(f.video.loads,1,'same source loads only once');
const reduced=fixture(true);await reduced.visible(.8);assert.equal(reduced.video.plays,0,'reduced motion has no autoplay');
await reduced.video.play();assert.equal(reduced.video.paused,false,'reduced motion allows explicit playback');
await reduced.visible(0);assert.equal(reduced.video.paused,true);
const denied=fixture();denied.video.reject=true;await denied.visible(.8);assert.equal(denied.video.dataset.autoplay,'blocked','autoplay denial is handled');
console.log('PASS: 홍보영상 스크롤 진입·이탈, 탭 전환, 수동 일시정지, 모션 감소, 자동재생 거절 처리');

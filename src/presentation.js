import './presentation.css';
import {bindScrollVideo} from './scroll-video.js';
const query=new URLSearchParams(location.search);
if(import.meta.env.DEV&&['127.0.0.1','localhost'].includes(location.hostname))query.set('scene','local');
if(query.has('role'))location.replace('/seoul/'+location.search+location.hash);
if(query.get('scene')==='local')document.querySelectorAll('[data-seoul]').forEach(a=>{const u=new URL(a.href);u.searchParams.set('scene','local');a.href=u.href;});
const canonical=location.hostname.endsWith('yanerdstation.kr');
document.querySelector('#editorLink').href=location.hostname==='127.0.0.1'?'http://127.0.0.1:4197/?scene=local':canonical?'https://toolkit.yanerdstation.kr/':'https://ya-nerd-station.soalsebi.chatgpt.site/';
if(canonical)document.querySelectorAll('[data-seoul]').forEach(a=>{const u=new URL(a.href);u.hostname='seoul.yanerdstation.kr';a.href=u.href;});
const slides=[...document.querySelectorAll('.slide')];let index=0;
const move=n=>slides[Math.max(0,Math.min(slides.length-1,n))].scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
// Tall mobile slides cannot occupy 55% of their own area in the viewport.
// Track the reading position instead so the counter and previous/next buttons remain usable.
const updateSlideIndex=()=>{
  const headerBottom=document.querySelector('.deck-header').getBoundingClientRect().bottom;
  const readingY=headerBottom+Math.max(0,innerHeight-headerBottom)*.25;
  index=Math.max(0,slides.findLastIndex(slide=>slide.getBoundingClientRect().top<=readingY));
  document.querySelector('#slideCount').textContent=String(index+1).padStart(2,'0')+' / '+String(slides.length).padStart(2,'0');
  document.querySelector('#previousSlide').disabled=index===0;document.querySelector('#nextSlide').disabled=index===slides.length-1;
};
let slideFrame=0;
const scheduleSlideIndex=()=>{if(!slideFrame)slideFrame=requestAnimationFrame(()=>{slideFrame=0;updateSlideIndex();});};
addEventListener('scroll',scheduleSlideIndex,{passive:true});addEventListener('resize',scheduleSlideIndex);addEventListener('load',scheduleSlideIndex,{once:true});updateSlideIndex();
document.querySelector('#previousSlide').onclick=()=>move(index-1);document.querySelector('#nextSlide').onclick=()=>move(index+1);
document.querySelector('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{document.querySelector('#fullscreen').textContent='브라우저 전체화면 사용';}};
document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||document.querySelector('dialog[open]'))return;if(['ArrowRight','PageDown','ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();move(index+(['ArrowRight','PageDown'].includes(e.key)?1:-1));}});

// Preserve the manager's full diagram. The same vector asset stays sharp when enlarged.
const pipelineDialog=document.querySelector('#pipelineDialog'),pipelineZoom=document.querySelector('#pipelineZoom');
const setPipelineZoom=zoom=>{pipelineDialog.dataset.zoom=String(zoom);pipelineZoom.setAttribute('aria-pressed',String(zoom));pipelineZoom.textContent=zoom?'화면에 맞춤':'100% 확대';};
document.querySelector('#openPipeline').addEventListener('click',e=>{
  e.preventDefault();setPipelineZoom(matchMedia('(max-width:760px)').matches);pipelineDialog.showModal();
  const viewport=pipelineDialog.querySelector('.pipeline-viewport');viewport.scrollTop=0;viewport.scrollLeft=0;
});
pipelineZoom.onclick=()=>setPipelineZoom(pipelineDialog.dataset.zoom!=='true');
pipelineDialog.addEventListener('click',e=>{if(e.target===pipelineDialog)pipelineDialog.close();});

// Demo videos recorded from the running service. Served by the worker in byte ranges (Safari/iOS need 206 responses);
// phones and data-saver get the 720px cut. A video loads when its slide comes near and plays only while on screen.
const MEDIA_VERSION='20260927';
const small=matchMedia('(max-width:900px)').matches||navigator.connection?.saveData===true;
const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
const src=(key,size=small?'720':'1280')=>'/api/media/intro/'+key+'-'+size+'.mp4?v='+MEDIA_VERSION;
const DEMOS={
  visitor:'3D내비 · 출발점 선택 → 시설 찾기 → 경로 미리보기 → 1인칭 따라걷기',
  business:'역내상권분석 · 구역 조망 → 시간 흐름 → 매장 포커스(매장 앞 통행·이용·매출)',
  manager:'운영관리 의사결정 지원 · 전 층 유동 → 상황 카드 → 조치 지시 → 시간 흐름',
};
// The complete promotional film keeps its own native controls; do not turn control taps into a zoom dialog.
bindScrollVideo(document.querySelector('video[data-promo]'),src('promo'),{reducedMotion:still});
const videos=[...document.querySelectorAll('video[data-demo]:not([data-promo])')];
const load=v=>{if(v.dataset.loaded===v.dataset.demo)return;v.dataset.loaded=v.dataset.demo;v.src=src(v.dataset.demo);v.load();};
const play=v=>{if(still||document.hidden||v.dataset.visible!=='true')return;load(v);v.play().catch(()=>{});};
for(const v of videos)if(v.hasAttribute('data-autoload')&&!still)load(v);
const near=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting&&!still)load(e.target);},{rootMargin:'80% 0px'});
const seen=new IntersectionObserver(entries=>{for(const e of entries){const v=e.target;v.dataset.visible=String(e.isIntersecting);if(e.isIntersecting)play(v);else v.pause();}},{threshold:.35});
for(const v of videos){near.observe(v);seen.observe(v);}
document.addEventListener('visibilitychange',()=>{for(const v of videos){if(document.hidden)v.pause();else play(v);}});
// Reduced motion: nothing moves until asked; every figure gets a play button.
if(still)for(const v of videos){const b=document.createElement('button');b.type='button';b.className='demo-play';b.textContent='▶ 영상 재생';v.parentElement.append(b);b.onclick=e=>{e.stopPropagation();load(v);v.play().then(()=>b.remove()).catch(()=>{});};}

// 03 / CONCEPT: the layer list follows the clip (the recording switches a layer at each cue).
for(const v of videos.filter(v=>v.dataset.sync)){
  const items=[...document.getElementById(v.dataset.sync).querySelectorAll('[data-cue]')];
  const mark=()=>{let k=0;items.forEach((a,i)=>{if(v.currentTime>=Number(a.dataset.cue))k=i;});items.forEach((a,i)=>a.classList.toggle('active',i===k&&!v.paused));};
  v.addEventListener('timeupdate',mark);v.addEventListener('pause',mark);v.addEventListener('play',mark);
  items.forEach(a=>a.addEventListener('click',()=>{v.currentTime=Number(a.dataset.cue)+.05;load(v);v.play().catch(()=>{});}));
}

// 04 / THREE PERSPECTIVES: one large player; each perspective plays in turn, or the one picked.
const player=document.querySelector('#showcasePlayer video'),picks=[...document.querySelectorAll('.audience')];
const bar=document.querySelector('#showcasePlayer .demo-progress i'),caption=document.querySelector('#showcaseCaption');
function show(key,{autoplay=true}={}){
  picks.forEach(p=>p.querySelector('.audience-pick').setAttribute('aria-pressed',String(p.dataset.key===key)));
  caption.textContent=DEMOS[key];player.poster='/media/intro/'+key+'.jpg';player.dataset.demo=key;bar.style.width='0';
  if(player.dataset.loaded){load(player);if(autoplay)play(player);}
}
// A pick is a request to watch: bring the player into view (on phones it sits below the list) and start it.
for(const p of picks){const pick=p.querySelector('.audience-pick'),go=()=>{show(p.dataset.key,{autoplay:false});load(player);if(!still)player.play().catch(()=>{});
  const r=player.getBoundingClientRect();if(r.top<0||r.bottom>innerHeight)player.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});};
  pick.addEventListener('click',go);pick.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});}
player.addEventListener('timeupdate',()=>{if(player.duration)bar.style.width=(player.currentTime/player.duration*100).toFixed(1)+'%';});
player.addEventListener('ended',()=>{const i=picks.findIndex(p=>p.dataset.key===player.dataset.demo);show(picks[(i+1)%picks.length].dataset.key);});
show('visitor',{autoplay:false});

// Click a video to watch it large with controls (full-size cut, same moment).
const dialog=document.querySelector('#demoDialog'),big=dialog.querySelector('video');
for(const v of videos){v.parentElement.classList.add('zoomable');v.parentElement.title='크게 보기';v.addEventListener('click',()=>{
  big.src=src(v.dataset.demo,'1280');big.poster=v.poster;const t=v.currentTime;v.pause();
  dialog.querySelector('#demoDialogCaption').textContent=v.parentElement.querySelector('figcaption')?.textContent.replace(/^실제 화면/,'실제 화면 · ')||'';
  dialog.showModal();big.addEventListener('loadedmetadata',()=>{big.currentTime=t;big.play().catch(()=>{});},{once:true});});}
const closeDialog=()=>{big.pause();big.removeAttribute('src');big.load();dialog.close();for(const v of videos)play(v);};
dialog.querySelector('#demoDialogClose').onclick=closeDialog;dialog.addEventListener('click',e=>{if(e.target===dialog)closeDialog();});dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});

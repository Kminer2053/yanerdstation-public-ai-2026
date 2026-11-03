// Reuse the real controls, not mobile copies: selected places and routes survive resizing.
export function createMobileNavigation({onExplore}={}){
 const $=s=>document.querySelector(s),body=document.body,workspace=$('#workspace');
 const media=matchMedia('(max-width:650px)'),finder=$('.finder'),map=$('.map-column'),nav=$('.mobile-jumps');
 const originalNav=nav.innerHTML,originalClick=nav.onclick;
 const destination=document.createElement('section');destination.id='mobileDestination';destination.className='mobile-screen';destination.setAttribute('aria-label','목적지 선택');
 destination.innerHTML='<header class="mobile-screen-title"><small>01 · 목적지 선택</small><h2>어디로 갈까요?</h2><p>출발 위치와 목적지를 고른 뒤 경로를 확인하세요.</p></header>';
 const explore=document.createElement('button');explore.type='button';explore.textContent='경로 없이 자유탐색';explore.onclick=()=>{onExplore?.();go(2);};
 const title=document.createElement('h2');title.className='mobile-screen-title';title.textContent='02 · 시설 목록';
 const quiet=document.createElement('button');quiet.id='mobileMapQuiet';quiet.type='button';quiet.setAttribute('aria-controls','walkControls');
 $('.map-stage').append(quiet);
 const settings=document.createElement('button');settings.id='mobileWalkSettings';settings.type='button';settings.textContent='세부 조작';settings.setAttribute('aria-expanded','false');$('#walkControls').append(settings);
 let mounted=false,moved=[],lastMode='',lastCamera=false;
 function move(el,parent){const anchor=document.createComment('mobile-original-position');el.before(anchor);moved.push([el,anchor]);parent.append(el);}
 function go(index){if(!mounted)return;const panel=[destination,finder,map][index];workspace.scrollTo({top:workspace.scrollTop+panel.getBoundingClientRect().top-workspace.getBoundingClientRect().top,behavior:'instant'});mark(index);}
 function mark(index){nav.querySelectorAll('button').forEach((b,i)=>{if(i===index)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});}
 function setQuiet(on){body.classList.toggle('mobile-map-quiet',on);quiet.textContent=on?'☰ 안내 표시':'✕ 화면 정리';quiet.setAttribute('aria-expanded',String(!on));}
 quiet.onclick=()=>setQuiet(!body.classList.contains('mobile-map-quiet'));
 settings.onclick=()=>{const on=!$('#walkControls').classList.contains('expanded');$('#walkControls').classList.toggle('expanded',on);settings.setAttribute('aria-expanded',String(on));settings.textContent=on?'접기':'세부 조작';};
 function measure(){if(mounted){body.style.setProperty('--mobile-head',Math.ceil($('.masthead').getBoundingClientRect().height)+'px');body.style.setProperty('--mobile-nav',Math.ceil(nav.getBoundingClientRect().height)+'px');$('.map-stage').style.setProperty('--walk-controls-h',Math.ceil($('#walkControls').getBoundingClientRect().height)+'px');}}
 function sync(){
  const enabled=media.matches&&body.dataset.role==='visitor';
  if(enabled&&!mounted){
   mounted=true;body.classList.add('mobile-journey');workspace.prepend(destination);finder.prepend(title);
   move($('.departure-first'),destination);move($('.route-picker'),destination);destination.append(explore);move($('#detail'),finder);$('#facilityList').before($('#detail'));
   finder.classList.add('mobile-screen');map.classList.add('mobile-screen');
   nav.innerHTML=['목적지 선택','시설 목록','지도 안내'].map((t,i)=>'<button type="button" data-screen="'+i+'" aria-controls="'+['mobileDestination','mobileFacilities','mobileMap'][i]+'">'+(i+1)+'. '+t+'</button>').join('');
   finder.id='mobileFacilities';map.id='mobileMap';
   nav.onclick=e=>{const b=e.target.closest('[data-screen]');if(b)go(+b.dataset.screen);};setQuiet(['walk','explore'].includes(body.dataset.mapMode)||!$('#cameraPanel').hidden);measure();go(0);
  }else if(!enabled&&mounted){
   mounted=false;for(const [el,anchor]of moved){anchor.replaceWith(el);}moved=[];destination.remove();title.remove();
   finder.classList.remove('mobile-screen');map.classList.remove('mobile-screen');finder.removeAttribute('id');map.removeAttribute('id');
   body.classList.remove('mobile-journey','mobile-map-quiet');nav.innerHTML=originalNav;nav.onclick=originalClick;workspace.scrollTop=0;
  }
  const mode=body.dataset.mapMode,camera=!$('#cameraPanel').hidden;
  if(mounted&&((['walk','explore'].includes(mode)&&mode!==lastMode)||(camera&&!lastCamera))){setQuiet(true);go(2);}
  else if(mounted&&!['walk','explore'].includes(mode)&&!camera&&(['walk','explore'].includes(lastMode)||lastCamera))setQuiet(false);
  lastMode=mode;lastCamera=camera;
 }
 workspace.addEventListener('scroll',()=>{if(mounted)mark(Math.max(0,Math.min(2,Math.round(workspace.scrollTop/workspace.clientHeight))));},{passive:true});
 new ResizeObserver(measure).observe($('.masthead'));new ResizeObserver(measure).observe(nav);
 new ResizeObserver(measure).observe($('#walkControls'));
 new MutationObserver(sync).observe(body,{attributes:true,attributeFilter:['data-role','data-map-mode']});
 new MutationObserver(sync).observe($('#cameraPanel'),{attributes:true,attributeFilter:['hidden']});
 media.addEventListener('change',sync);sync();
 return {goMap:()=>go(2),goDestination:()=>go(0),showFacility(){if(mounted)$('#detail').scrollIntoView({block:'nearest'});}};
}

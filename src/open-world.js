import {esc,int,group} from './experience-core.js';
import {POSES} from './exploration-play.js';
import {CENTRAL_HALL_POINT} from './exploration-entry.js';

const FLOORS=['B7','B6','B3','B2','B1','1F','2F','3F'];
const HELP={
  bird:'조망: 마우스 드래그·휠 또는 방향키(WASD)로 지도를 움직이고 Q/E로 돌립니다. +/- 확대, Shift 빠르게.',
  first:'1인칭: ↑↓ 걷기 · ←→ 돌기 · A/D 옆걸음 · 화면 드래그로 둘러보기 · Shift 빠르게 · 계단 앞에서 Enter · Esc 조망.',
  third:'3인칭: WASD 이동 · 드래그/←→ 시점 · Space 점프 · 1 손 흔들기 · 2 인사 · 3 만세 · 4 사진 포즈. 사진 포즈는 이동/점프할 때까지 유지됩니다. Enter 층간 이동 · Esc 조망.',
};

// Open-world exploring, separate from wayfinding: pick a place, choose bird view or first person, inspect facilities, take photos.
export function createOpenWorld({getContext,post,notify,getCamera,onRoute}){
  const $=s=>document.querySelector(s);
  let view='bird',sceneMode='overview',place=null,inTab=false,floor=null;
  const viewButtons='<button data-explore-view="bird" aria-pressed="true"><b>조망</b><small>지도 둘러보기</small></button><button data-explore-view="first" aria-pressed="false"><b>1인칭</b><small>내 눈으로 걷기</small></button><button data-explore-view="third" aria-pressed="false"><b>3인칭</b><small>아바타 · 점프 · 포즈</small></button>';
  $('.finder').insertAdjacentHTML('beforeend','<section class="explore-panel" aria-labelledby="exploreTitle"><span class="eyebrow">OPEN WORLD</span><h2 id="exploreTitle">서울역 자유탐색</h2><p>길안내와 별개로 역 안을 마음대로 둘러봅니다. 화면에 보이는 시설의 원형점을 누르면 정보가 열립니다.</p>'
    +'<div class="explore-step"><span>보기 방식</span><div class="explore-views" role="group" aria-label="보기 방식">'+viewButtons+'</div></div>'
    +'<div class="explore-step"><span>위치</span><select id="explorePlace" aria-label="탐험 위치"></select><button id="exploreGo" class="primary">이 위치로 이동</button></div>'
    +'<div class="explore-step"><span>층 바꾸기</span><div class="explore-floors" id="exploreFloors">'+FLOORS.map(f=>'<button data-explore-floor="'+f+'" aria-pressed="false">'+f+'</button>').join('')+'</div></div>'
    +'<div class="explore-step"><span>도구</span><div class="explore-tools"><button id="explorePhoto">사진 촬영 · PNG 저장</button><label><input id="exploreMarkers" type="checkbox" checked> 시설 원형점 표시</label></div></div>'
    +'<p class="explore-help" id="exploreHelp">'+HELP.bird+'</p><a class="text-button" href="/commons/">가벼운 중앙홀 · 함께 산책하기 ↗</a></section>');
  $('.map-stage').insertAdjacentHTML('beforeend','<div id="exploreHud" hidden><div class="hud-views" role="group" aria-label="보기 전환"><button data-explore-view="bird" aria-pressed="true">조망</button><button data-explore-view="first" aria-pressed="false">1인칭</button></div><button id="hudPhoto" title="지금 보이는 화면을 PNG로 저장">사진</button><button id="hudCamera" hidden>카메라 비교</button></div><div id="photoFlash" hidden></div>');
  $('.hud-views').insertAdjacentHTML('beforeend','<button data-explore-view="third" aria-pressed="false">3인칭</button>');
  $('.map-stage').insertAdjacentHTML('beforeend','<div id="explorePlay" hidden aria-label="아바타 놀이"><button id="exploreJump" title="Space · 짧게 점프">↑ 점프</button><div id="explorePoses"><button id="poseToggle" aria-expanded="false" aria-controls="poseChoices">☺ 포즈</button><div id="poseChoices" hidden>'+Object.entries(POSES).map(([id,label],i)=>'<button data-play-pose="'+id+'" title="단축키 '+(i+1)+'">'+label+'</button>').join('')+'</div></div></div>');
  document.body.insertAdjacentHTML('beforeend','<dialog id="exploreDialog" aria-labelledby="exploreDialogTitle"><span class="eyebrow">OPEN WORLD</span><h2 id="exploreDialogTitle">어디에서 탐험을 시작할까요?</h2><p>보기 방식을 고른 뒤 시작 장소를 누르세요. 길안내 경로와는 따로 움직입니다.</p><div class="explore-views" role="group" aria-label="보기 방식">'+viewButtons+'</div><h3>출도착 지점</h3><div class="explore-grid" id="exploreEndpoints"></div><h3>층 둘러보기</h3><div class="explore-grid floors" id="exploreFloorStarts"></div><button id="exploreDialogClose">닫기</button></dialog>'
    +'<dialog id="facilityDialog" aria-labelledby="facilityDialogName"><div class="dialog-heading"><span>시설 정보</span><button id="facilityDialogX" aria-label="닫기">×</button></div><div id="facilityDialogBody"></div><div class="facility-actions"><button id="facilityRoute" class="primary">여기로 길안내</button><button id="facilityDialogClose">닫기</button></div></dialog>');

  const centre=e=>{const g=e.geometry;if(g?.type==='Point')return g.coordinates;const ring=g?.coordinates?.[0];if(!ring?.length)return null;const pts=ring.length>3?ring.slice(0,-1):ring;return [0,1,2].map(k=>pts.reduce((s,p)=>s+(p[k]??0),0)/pts.length);};
  function target(key){
    const {catalog}=getContext();if(!catalog||!key)return null;
    if(key==='hall-center')return {floor:'2F',point:[...CENTRAL_HALL_POINT]};
    if(key.startsWith('ep:')){const e=catalog.endpoints.find(e=>e.id===key.slice(3));return e?{floor:e.floor,point:centre(e)}:null;}
    if(key.startsWith('floor:'))return {floor:key.slice(6)};
    const f=catalog.facilities.find(f=>f.id===key.slice(4));if(!f)return null;
    return {floor:f.floor,point:Array.isArray(f.access)?f.access:f.reference?[f.reference.lon,f.reference.lat,f.reference.height-1.8]:undefined};
  }
  function markView(){document.body.dataset.exploreView=view;for(const b of document.querySelectorAll('button[data-explore-view]'))b.setAttribute('aria-pressed',String(b.dataset.exploreView===view));$('#exploreHelp').textContent=HELP[view];}
  function go(key){
    if(!getContext().sceneReady){notify('3D 지도가 준비된 뒤 탐험을 시작할 수 있습니다.');return;}
    const t=target(key);if(!t){notify('탐험할 위치를 찾을 수 없습니다.');return;}
    place=key;$('#explorePlace').value=key;$('#exploreDialog').close();
    post({action:view==='bird'?'bird':'teleport',perspective:view,floor:t.floor,point:t.point,whole:!t.point});
  }
  function setView(next){
    if(!['bird','first','third'].includes(next))return;view=next;markView();if(view!=='first')getCamera()?.stop();
    if((sceneMode==='bird'||sceneMode==='explore')&&view!=='bird')post({action:'explore-view',view});
    else if(sceneMode==='explore'&&view==='bird')post({action:'bird'});
    else if(sceneMode!=='bird'&&sceneMode!=='explore'&&place)go(place);
    refreshHud();
  }
  function refreshHud(){
    const on=inTab&&(sceneMode==='bird'||sceneMode==='explore');$('#exploreHud').hidden=!on;
    $('#hudCamera').hidden=sceneMode!=='explore'||view!=='first';
    $('#explorePlay').hidden=!on||sceneMode!=='explore'||view!=='third';if($('#explorePlay').hidden)togglePoses(false);
  }
  function togglePoses(on){$('#poseChoices').hidden=!on;$('#poseToggle').setAttribute('aria-expanded',String(on));}
  function flash(){const el=$('#photoFlash');el.hidden=false;el.classList.remove('go');void el.offsetWidth;el.classList.add('go');setTimeout(()=>{el.hidden=true;},450);}

  document.addEventListener('click',e=>{const b=e.target.closest('button[data-explore-view]');if(b)setView(b.dataset.exploreView);});
  $('#exploreEndpoints').onclick=$('#exploreFloorStarts').onclick=e=>{const b=e.target.closest('[data-place]');if(b)go(b.dataset.place);};
  $('#exploreGo').onclick=()=>go($('#explorePlace').value);
  $('#poseToggle').onclick=()=>togglePoses($('#poseChoices').hidden);
  $('#poseChoices').onclick=e=>{const b=e.target.closest('[data-play-pose]');if(b){post({action:'play-action',value:b.dataset.playPose});togglePoses(false);}};
  $('#exploreFloors').onclick=e=>{
    const b=e.target.closest('[data-explore-floor]');if(!b)return;const f=b.dataset.exploreFloor;
    if(sceneMode==='bird')post({action:'bird',floor:f});else if(sceneMode==='explore')post({action:'teleport',floor:f});else go('floor:'+f);
  };
  $('#explorePhoto').onclick=$('#hudPhoto').onclick=()=>{if(sceneMode!=='bird'&&sceneMode!=='explore'){notify('자유탐색을 시작한 뒤 촬영할 수 있습니다.');return;}post({action:'photo'});};
  $('#exploreMarkers').onchange=e=>post({action:'markers',enabled:e.target.checked});
  $('#exploreDialogClose').onclick=()=>$('#exploreDialog').close();
  $('#facilityDialogX').onclick=$('#facilityDialogClose').onclick=()=>$('#facilityDialog').close();

  return {
    initialize(){
      const {catalog}=getContext(),points=catalog.facilities.filter(f=>Array.isArray(f.access)||f.reference);
      $('#explorePlace').innerHTML='<optgroup label="주요 공간"><option value="hall-center">2층 중앙홀 · 2F</option></optgroup><optgroup label="출도착 지점">'+catalog.endpoints.map(e=>'<option value="ep:'+esc(e.id)+'">'+esc(e.name)+' · '+esc(e.floor)+'</option>').join('')+'</optgroup><optgroup label="층 둘러보기">'+FLOORS.map(f=>'<option value="floor:'+f+'">'+f+' 전체</option>').join('')+'</optgroup><optgroup label="시설 앞">'+points.map(f=>'<option value="fac:'+esc(f.id)+'">'+esc(f.name)+' · '+esc(f.floor)+'</option>').join('')+'</optgroup>';
      $('#exploreEndpoints').innerHTML=catalog.endpoints.map(e=>'<button data-place="ep:'+esc(e.id)+'"><b>'+esc(e.name)+'</b><small>'+esc(e.floor)+'</small></button>').join('');
      $('#exploreFloorStarts').innerHTML=FLOORS.map(f=>'<button data-place="floor:'+f+'"><b>'+f+'</b></button>').join('');
      return points.map(f=>({id:f.id,name:f.name,floor:f.floor,group:group(f),access:Array.isArray(f.access)?f.access:null,reference:f.reference?{lon:f.reference.lon,lat:f.reference.lat,height:f.reference.height,focus:{cameraHeading:f.reference.focus?.cameraHeading}}:null}));
    },
    prepareEntry(entry){if(!entry||!['bird','first','third'].includes(entry.view)||!target(entry.place))return false;view=entry.view;place=entry.place;return true;},
    open(){inTab=true;markView();if(sceneMode==='bird'||sceneMode==='explore'){refreshHud();return;}if(place)go(place);else $('#exploreDialog').showModal();},
    leave(){inTab=false;if(sceneMode==='bird'||sceneMode==='explore')post({action:'overview'});getCamera()?.stop();refreshHud();},
    setMode(mode,perspective){const prev=sceneMode;sceneMode=mode;if(prev==='explore'&&mode!=='explore')getCamera()?.stop();if(mode==='bird'||mode==='explore'){view=mode==='bird'?'bird':perspective==='third'?'third':'first';markView();}refreshHud();},
    setFloor(f){floor=f;for(const b of document.querySelectorAll('[data-explore-floor]'))b.setAttribute('aria-pressed',String(b.dataset.exploreFloor===floor));},
    showFacility(id){
      const {catalog}=getContext(),f=catalog?.facilities.find(f=>f.id===id);if(!f)return;
      const products=(f.products||[]).slice().sort((a,b)=>a.rank-b.rank).slice(0,5);
      $('#facilityDialogBody').innerHTML='<span class="eyebrow">'+esc(f.floor)+' · '+esc(group(f))+'</span><h2 id="facilityDialogName">'+esc(f.name)+'</h2>'+(f.notes?'<p>'+esc(f.notes)+'</p>':'')
        +'<dl class="facility-facts"><div><dt>운영시간</dt><dd>'+esc(f.hours||'확인 필요')+'</dd></div><div><dt>연락처</dt><dd>'+esc(f.contact||'등록된 연락처 없음')+'</dd></div><div><dt>분류</dt><dd>'+esc(f.category||group(f))+'</dd></div></dl>'
        +(products.length?'<div class="products"><h3>인기 상품</h3><ul>'+products.map(p=>'<li><span>'+esc(p.name)+'</span><b>'+(p.price===null?esc(p.price_text||'가격 확인 필요'):int(p.price)+'원'+(p.price_kind==='from'?'부터':''))+'</b></li>').join('')+'</ul><small>제공 자료 기준 · 순위 기간·현재 가격은 매장 확인</small></div>':'');
      $('#facilityRoute').hidden=!f.access_id;$('#facilityRoute').onclick=()=>{$('#facilityDialog').close();onRoute(f.id);};
      $('#facilityDialog').showModal();
    },
    savePhoto({photo,photoMode,photoView,photoFloor}){
      const d=new Date(),p=n=>String(n).padStart(2,'0'),name=['서울역',photoFloor,photoMode==='bird'?'조망':photoView==='third'?'3인칭':'1인칭'].filter(Boolean).join('_')+'_'+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'-'+p(d.getHours())+p(d.getMinutes())+p(d.getSeconds())+'.png';
      const url=URL.createObjectURL(photo),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
      flash();notify('사진을 저장했습니다 · '+name);
    },
  };
}

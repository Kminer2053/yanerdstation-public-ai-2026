import './experience.css';
import './experience-expanded.css';
import {esc,int,group,sum,routeInstructions,skyForHour} from './experience-core.js';
import {analyticsHTML,updateBreakEven,bars} from './experience-analytics.js';
import {createCameraComparison,cameraPipSize} from './camera-comparison.js';
import {bindPeopleToggle} from './people-toggle.js';
import {bindExplorationPointers} from './exploration-input.js';
import {createAudienceWorkspaces} from './audience-workspaces.js';
import {inside} from './spatial-analysis.js';
import './audience-workspaces.css';
import './feedback.css';
import './manager-workbench.css';
import {createVisitorJourney} from './visitor-journey.js';
import {createOpenWorld} from './open-world.js';
import {createExplorationEntry} from './exploration-entry.js';
import {maskUsage,maskSales} from './data-quality.js';
import {MIN_PASSAGES} from './store-focus.js';
import {createMobileNavigation} from './mobile-navigation.js';
import './mobile-navigation.css';
import './exploration-play.css';
import {PLATFORM111_SLIDES} from '../app/platform111-slides.js';
const $=s=>document.querySelector(s),q=new URLSearchParams(location.search);
const linkedExploration=createExplorationEntry(q);let explorationInitialized=false;
// Public source uses external VWorld by default; local private tile caches are not distributed.
let catalog,network,usage,timeline,session,selected=null,route=null,ready=false,sceneReady=false,role=['visitor','business','manager'].includes(q.get('role'))?q.get('role'):'visitor',date='2026-07-18',hour=12,compared=[],edgeValues=[],sales=null,facilityRoutes=null,requestVersion=0,toastTimer,timeTimer=null,mode='overview',showFlow=false;
let mapSource='live',facilityItems=null,managerFloor='all',clockT=12,mobileNavigation=null,touchInput=null;
// Playback speed of the time bar: one data hour per this many seconds; values between hours are interpolated.
const HOUR_SECONDS=10;
const ALL_FLOORS=['B7','B6','B3','B2','B1','1F','2F','3F','4F'];
const cache=new Map(),controller={from:null,to:null};
const load=async url=>{const response=await fetch(url,{cache:url.startsWith('/api/')?'no-store':'default'});const data=await response.json();if(!response.ok)throw Error(data.error||'자료 연결 실패');return data};
function notify(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4500)}
function post(data){const target=$('#scene')?.contentWindow;if(sceneReady&&target)target.postMessage({type:'station-one:experience',...data},location.origin)}
$('.finder').insertAdjacentHTML('beforeend','<section class="route-picker"><button id="routeToggle" aria-expanded="true">경로 미리보기 <span>출발 → 도착</span></button><div id="routeForm"><label>출발<select id="from"></select></label><label>도착<select id="to"></select></label><button id="findRoute" class="primary">경로 확인</button><p class="muted">위치를 직접 선택합니다. 실시간 측위·운행 통제는 반영하지 않습니다.</p><div id="routeSummary"></div></div></section>');
$('.map-column').insertAdjacentHTML('afterbegin','<div class="experience-toolbar"><div class="mode-switch" aria-label="지도 표현"><button data-mode="overview" aria-pressed="true">공간 조망</button><button data-mode="flow" aria-pressed="false">유동 흐름</button><button data-mode="walk" aria-pressed="false">따라 걷기</button><button data-mode="explore" aria-pressed="false">자유 탐색</button></div><div class="map-options"><label><input id="people" type="checkbox" checked> 사람</label><select id="flowStyle" aria-label="흐름 표현"><option value="arrows">화살표</option><option value="dots">점</option><option value="mist">안개</option></select><select id="environment" aria-label="조명 환경"><option value="auto">실내·야외 자동</option><option value="indoor">실내 조명</option><option value="outdoor">야외 하늘</option></select><button id="cameraToggle" aria-pressed="false">카메라 비교</button></div></div>');
$('.map-stage').insertAdjacentHTML('beforeend','<section id="cameraPanel" class="camera-panel" hidden><div class="camera-title">실제 카메라 <button id="cameraClose" aria-label="카메라 끄기">×</button></div><video id="cameraVideo" autoplay muted playsinline></video><p id="cameraStatus">카메라는 직접 켜야 합니다. 영상은 저장하지 않습니다.</p></section><button id="walkCta" class="walk-cta" hidden>▶ 1인칭 따라걷기</button><div id="walkControls" hidden><button id="playWalk">일시정지</button><label>진행<input id="walkProgress" type="range" min="0" max="1" step=".001" value="0"></label><select id="walkSpeed" aria-label="보행 속도"><option value=".8">천천히</option><option value="1.2">천천히 걷기</option><option value="2.4" selected>기본 · 빠른 걷기</option><option value="3.6">빠른 미리보기</option></select><span id="walkState"></span><button id="walkCamera">카메라 비교</button><button id="exitWalk">조망으로</button></div><div id="touchControls" hidden><span>화면 끌어 둘러보기 · 버튼으로 걷기</span><div><button data-key="ArrowLeft" aria-label="왼쪽 보기">↶</button><button data-key="KeyW" aria-label="앞으로">↑</button><button data-key="ArrowRight" aria-label="오른쪽 보기">↷</button></div><div><button data-key="KeyA" aria-label="왼쪽 이동">←</button><button data-key="KeyS" aria-label="뒤로">↓</button><button data-key="KeyD" aria-label="오른쪽 이동">→</button></div><div id="rideChoices"></div></div>');
$('#detail').insertAdjacentHTML('beforebegin','<section class="timebar" aria-label="데이터 날짜와 시간"><label>기준일<input id="date" type="date" min="2026-07-01" max="2026-07-31" value="'+date+'"></label><button id="timePlay" aria-label="시간대 자동 재생">▶</button><label class="hour-input"><span id="hourLabel">12:00 — 13:00</span><input id="hour" type="range" min="0" max="23" value="12"></label><strong id="hourCount">—</strong><button id="methodButton">자료·추정 기준</button></section>');
$('#detail').insertAdjacentHTML('afterend','<section id="analytics" hidden></section>');
$('.timebar').insertAdjacentHTML('beforeend','<button id="detailToggle" type="button" aria-expanded="true" aria-controls="detail">안내 접기</button>');
function setDetailCollapsed(collapsed){
  $('#detail').classList.toggle('detail-collapsed',collapsed);
  $('#detailToggle').setAttribute('aria-expanded',String(!collapsed));
  $('#detailToggle').textContent=collapsed?'안내 펼치기':'안내 접기';
}
$('#detailToggle').onclick=()=>setDetailCollapsed(!$('#detail').classList.contains('detail-collapsed'));
document.body.insertAdjacentHTML('beforeend','<dialog id="methodDialog"><div class="dialog-heading"><h2>자료를 읽는 기준</h2><button id="methodClose" aria-label="닫기">×</button></div><div id="methods"></div></dialog>');
document.body.insertAdjacentHTML('beforeend','<nav class="mobile-jumps" aria-label="화면 바로가기"><button data-jump=".finder">메뉴</button><button data-jump=".map-column">3D 지도</button><button data-jump="#detail">정보</button></nav>');
document.querySelector('.mobile-jumps').onclick=e=>{const b=e.target.closest('[data-jump]');if(b)document.querySelector(b.dataset.jump)?.scrollIntoView({behavior:'auto',block:'start'})};
const openWorld=createOpenWorld({getContext:()=>({catalog,role,sceneReady}),post,notify,getCamera:()=>camera,onRoute:id=>{controller.to=id;$('#to').value=id;journey.setTab('route');findRoute();}});
$('#walkCamera').insertAdjacentHTML('beforebegin','<button id="walkPeople" type="button" aria-pressed="true">사람 켜짐</button>');
const camera=createCameraComparison({video:$('#cameraVideo'),status:$('#cameraStatus'),container:$('#cameraPanel'),button:$('#cameraToggle'),buttons:[$('#walkCamera'),$('#hudCamera')]});
const journey=createVisitorJourney({getContext:()=>({catalog,controller,selected,role}),post,notify,onStart:()=>{controller.from=$('#from').value;},onExplore:()=>openWorld.open(),onLeaveExplore:()=>openWorld.leave()});
function enterLinkedExploration(){
  return linkedExploration.apply({ready:explorationInitialized&&sceneReady,role,start:entry=>{
    if(!openWorld.prepareEntry(entry))return;
    $('#departureDialog').close();journey.setTab('explore');setDetailCollapsed(true);mobileNavigation?.goMap();
  }});
}
// A person choosing another feature while the map loads takes precedence over the initial link.
document.addEventListener('click',e=>{if(e.target.closest('.visitor-tabs button,button[data-role],#chooseDeparture'))linkedExploration.cancel();});
const sendFacilities=()=>{if(sceneReady&&facilityItems)post({action:'facilities',items:facilityItems});};
const audiences=createAudienceWorkspaces({getContext:()=>({catalog,network,usage,timeline,session,selected,role,date,hour,clock:clockT,edgeValues,sales,sceneReady,flowsByHour:cache.get(date),managerFloor}),post,notify,select,onZoneChange:()=>sendFlow(),onTab:managerTab,
  setHour:h=>{setClock(h);},playback:{get:()=>Boolean(timeTimer),set:on=>setPlaying(on)},showPlace:p=>{if(p?.floor&&managerFloor!==p.floor)setManagerFloor(p.floor,{fit:false});}});
// Manager overview shows the footfall like the 3D map (people and far dots); flow lines and floors are optional.
$('.map-stage').insertAdjacentHTML('beforeend','<div id="managerMapBar"><div class="floor-chips" role="group" aria-label="표시 층">'+['all','3F','2F','1F','B1','B2','B3','B6','B7'].map(f=>'<button type="button" data-manager-floor="'+f+'" aria-pressed="'+(f===managerFloor)+'">'+(f==='all'?'전체':f)+'</button>').join('')+'</div><label><input type="checkbox" id="managerPeople" checked> 사람</label><label><input type="checkbox" id="managerLines"> 흐름선</label></div>');
const managerFloors=()=>managerFloor==='all'?ALL_FLOORS:[managerFloor];
function setManagerFloor(f,{fit=true}={}){managerFloor=f;document.querySelectorAll('[data-manager-floor]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.managerFloor===f)));post({action:'floors',floors:managerFloors(),fit});sendFlow();audiences.feedMarkers();}
function managerOverview(fit=true){showFlow=$('#managerLines').checked;post({action:'people',enabled:$('#managerPeople').checked});setManagerFloor(managerFloor,{fit});}
const peopleOn=()=>role==='manager'?audiences.tab==='overview'&&$('#managerPeople').checked:$('#people').checked;
$('#managerMapBar').onclick=e=>{const b=e.target.closest('[data-manager-floor]');if(!b)return;if(!sceneReady){notify('3D 지도가 준비된 뒤 사용할 수 있습니다.');return;}setManagerFloor(b.dataset.managerFloor);};
$('#managerPeople').onchange=()=>post({action:'people',enabled:peopleOn()});
$('#managerLines').onchange=()=>{showFlow=$('#managerLines').checked;sendFlow();};
// Manager edit tabs own the map: people and flows step aside while facades, access points and routes are checked.
function managerTab(next){post({action:'manager-overlay-clear'});post({action:'clear-route'});setModeUI('overview');if(next==='overview')managerOverview(true);else{showFlow=false;post({action:'people',enabled:false});}}
$('#reconnect').insertAdjacentHTML('afterend','<button id="simpleMap" hidden>간략 경로도로 보기</button>');
$('.map-stage').insertAdjacentHTML('beforeend','<div id="sceneQuality" hidden role="status">간략 경로도 · 등록 좌표만 표시<br>브이월드 건축 모델·사진 파사드는 연결되지 않았습니다.</div>');
$('.map-stage').insertAdjacentHTML('beforeend','<nav class="easy-map-controls" aria-label="지도 시점과 이동"><div class="view-buttons"><button data-camera="home" title="선택 공간 전체 보기">⌂ 전체</button><button data-camera="top">▱ 위에서</button><button data-camera="oblique">◩ 비스듬히</button></div><div class="turn-buttons" role="group" aria-label="보는 방향 돌리기"><button data-camera="rotate-left" data-step="90" aria-label="왼쪽으로 90도">↶ 90°</button><button data-camera="rotate-left" data-step="30" aria-label="왼쪽으로 30도">↶ 30°</button><button data-camera="front" title="매장 정면이 보이는 방향">정면</button><button data-camera="rotate-right" data-step="30" aria-label="오른쪽으로 30도">30° ↷</button><button data-camera="rotate-right" data-step="90" aria-label="오른쪽으로 90도">90° ↷</button></div><details><summary>이동·확대</summary><div class="camera-pad"><button data-camera="left" aria-label="지도 왼쪽 이동">←</button><button data-camera="up" aria-label="지도 앞쪽 이동">↑</button><button data-camera="right" aria-label="지도 오른쪽 이동">→</button><button data-camera="rotate-left" aria-label="왼쪽으로 시점 회전">↶</button><button data-camera="down" aria-label="지도 뒤쪽 이동">↓</button><button data-camera="rotate-right" aria-label="오른쪽으로 시점 회전">↷</button><button data-camera="zoom-in" aria-label="확대">＋</button><span>확대·축소</span><button data-camera="zoom-out" aria-label="축소">−</button></div></details></nav>');
$('.easy-map-controls').onclick=e=>{const b=e.target.closest('[data-camera]');if(!b)return;if(!sceneReady){notify('지도 연결이 필요합니다. 아래 간략 경로도를 사용할 수도 있습니다.');return}if(b.dataset.camera==='home'&&role==='manager'&&audiences.tab==='overview'){managerOverview(true);return}if(b.dataset.camera==='home'&&role==='business'){audiences.leaveStore();post({action:'overview'});setModeUI('overview');showFlow=true;sendFlow(true);audiences.refresh(true)}else if(b.dataset.camera==='front')audiences.front();else post({action:'camera',command:b.dataset.camera,...(b.dataset.step?{step:+b.dataset.step}:{})})};
$('#cameraClose').onclick=()=>camera.stop();
// Desktop comparison stays side-by-side. Mobile keeps the full map with a small lower-right PIP.
const fitCamera=()=>{
 const stage=$('.map-stage'),panel=$('#cameraPanel'),v=$('#cameraVideo');
 if(v.videoWidth&&v.videoHeight)stage.style.setProperty('--camera-aspect',String(v.videoWidth/v.videoHeight));
 const size=cameraPipSize({videoWidth:v.videoWidth,videoHeight:v.videoHeight,stageWidth:stage.clientWidth,stageHeight:stage.clientHeight,controlsHeight:$('#walkControls').getBoundingClientRect().height});
 stage.style.setProperty('--camera-pip-width',size.width+'px');stage.style.setProperty('--camera-pip-height',size.height+'px');
 stage.style.setProperty('--camera-h',panel.hidden?'0px':panel.offsetHeight+'px');
};
['loadedmetadata','resize'].forEach(t=>$('#cameraVideo').addEventListener(t,fitCamera));
const cameraSizeObserver=new ResizeObserver(fitCamera);for(const element of [$('.map-stage'),$('#cameraPanel'),$('#walkControls')])cameraSizeObserver.observe(element);
new MutationObserver(()=>{const on=!$('#cameraPanel').hidden;$('.map-stage').classList.toggle('comparing',on);fitCamera();if(on&&matchMedia('(max-width:650px)').matches)$('.map-stage').scrollIntoView({block:'start'})}).observe($('#cameraPanel'),{attributes:true,attributeFilter:['hidden']});
function renderList(){
  if(!catalog)return;const query=$('#search').value.trim().toLowerCase(),floor=$('#floor').value,category=$('#category').value;
  const rows=catalog.facilities.filter(f=>(!floor||f.floor===floor)&&(!category||group(f)===category)&&(!query||(f.name+f.category+f.products.map(p=>p.name).join(' ')).toLowerCase().includes(query)));
  $('#listCount').textContent=rows.length+'곳 · '+(role==='visitor'?'방문할 곳을 선택하세요':'비교할 매장을 선택하세요');
  $('#facilityList').innerHTML=rows.length?rows.map(f=>'<div class="facility-row"><button class="facility" data-id="'+esc(f.id)+'" aria-pressed="'+(selected?.id===f.id)+'"><span class="floor-chip">'+esc(f.floor||'—')+'</span><span><strong>'+esc(f.name)+'</strong><small>'+esc(group(f))+' · '+esc(f.hours||'운영시간 확인 필요')+'</small></span><span class="arrow" aria-hidden="true">↗</span></button>'+(role!=='visitor'&&f.store?'<label class="compare-toggle"><input type="checkbox" data-compare="'+esc(f.id)+'" '+(compared.includes(f.id)?'checked':'')+' aria-label="'+esc(f.name)+' 비교"> 비교</label>':'')+'</div>').join(''):'<p class="muted">조건에 맞는 시설이 없습니다. 검색어나 층을 바꿔보세요.</p>';
}
function select(id){
  selected=catalog.facilities.find(f=>f.id===id);if(!selected)return;const f=selected;
  setDetailCollapsed(false);
  // Business: one store in focus — its facade, the corridor in front and the day's figures on the clock.
  if(role==='business'&&sceneReady)audiences.focusStore(f.id);
  renderList();detail();renderAnalytics();mobileNavigation?.showFacility();
  if(role==='visitor'){if(route){route=null;post({action:'clear-route'});$('#routeSummary').innerHTML='';$('#walkCta').hidden=true;}$('#mapTitle').textContent=f.floor+' · '+f.name;focus(f);}
}
function detail(){
  if(!selected){$('#detail').innerHTML='<div><span class="eyebrow">EXPLORE</span><h2>처음 와도, 익숙한 서울역</h2><p>매장과 편의시설을 검색해 보세요. 출발·도착을 정하면 층을 오가는 경로를 미리 걸어볼 수 있습니다.</p></div><div class="welcome-facts"><strong>'+catalog.facilities.length+'<small>등록 시설</small></strong><strong>8<small>출도착 지점</small></strong><strong>9<small>연결 층</small></strong></div>';return;}
  const f=selected,products=f.products||[],day=catalog.dates.indexOf(date),u=usage.stores[f.id];
  $('#detail').innerHTML='<div class="facility-copy"><span class="eyebrow">'+esc(f.floor)+' · '+esc(group(f))+'</span><h2>'+esc(f.name)+'</h2><p>'+esc(f.notes||'현재화한 서울역 실내 지도에서 위치를 확인하세요.')+'</p><div class="detail-actions"><button id="visitHere" class="primary" '+(!f.access_id?'disabled':'')+'>여기로 가기</button><button id="refocus">지도 위치</button>'+(role==='manager'&&session.manager?'<button id="noteOpen">운영 메모</button>':'')+'</div><p class="muted">'+(f.access_id?'보행 출입점 지정됨 · 안내 경로 현장 검토 필요':'보행 출입점 미지정 · 위치 안내만 제공')+'</p></div><div class="facts"><div class="fact"><small>운영시간</small><strong>'+esc(f.hours||'확인 필요')+'</strong></div><div class="fact"><small>연락처</small><strong>'+esc(f.contact||'등록된 연락처 없음')+'</strong></div></div><div class="products"><h3>인기 상품</h3>'+(products.length?'<ul>'+products.sort((a,b)=>a.rank-b.rank).slice(0,5).map(p=>'<li><span>'+esc(p.name)+'</span><b>'+(p.price===null?esc(p.price_text||'가격 확인 필요'):int(p.price)+'원'+(p.price_kind==='from'?'부터':''))+'</b></li>').join('')+'</ul><small>제공 자료 기준 · 순위 기간·현재 가격은 매장 확인</small>':'<p class="muted">등록된 상품 정보가 없습니다.</p>')+'</div>'+(role!=='visitor'&&u?'<section class="store-profile"><h3>선택 매장 시간대별 이용 패턴</h3>'+bars(u.hourly[day]||Array(24).fill(null),{selected:hour,label:'매장 이용인원 시간별 추정',unit:'건'})+'<p class="muted">결제건수 기반 가공·추정. 실제 매출이 발생한 영업시간 외 시간대도 포함합니다.</p></section>':'');
  $('#visitHere').onclick=()=>{controller.to=f.id;$('#to').value=f.id;journey.setTab('route');findRoute();};$('#refocus').onclick=()=>{focus(f);mobileNavigation?.goMap();};if($('#noteOpen'))$('#noteOpen').onclick=()=>openNote(f);
}
function focus(f){
  const p=f.reference;if(!p||!Number.isFinite(p.lon)||!Number.isFinite(p.height)){notify('정확한 지도 좌표가 아직 등록되지 않았습니다.');return}
  if(!ready){$('#mapStatus').textContent='지도 준비 후 선택 위치로 이동';return}
  if(mapSource==='schematic'){post({action:'focus',point:[p.lon,p.lat,p.height],floor:f.floor});return;}
  post({action:'overview'});setModeUI('overview');$('#scene')?.contentWindow?.postMessage({type:'station-one:catalog-focus',requestId:Date.now(),focus:{floor:f.floor,longitude:p.lon,latitude:p.lat,height:p.height,label:f.name,imageId:f.source_id,...p.focus,sourceKind:p.focus?.sourceKind||'catalog'}},location.origin);
}
function roleView(){
  journey.roleChanged(role);
  document.body.dataset.role=role;document.querySelectorAll('[data-role]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.role===role)));
  $('#viewTitle').textContent=role==='visitor'?'서울역, 어디로 가세요?':role==='business'?'공간을 보고, 기회를 찾다':'현장과 운영을 한눈에';
  $('#viewIntro').textContent=role==='visitor'?'시설을 찾고, 경로를 안내받고, 공간을 미리 걸어보세요.':role==='business'?'시간대별 흐름과 매장 이용 패턴을 비교하세요.':'시설 상태와 운영 데이터를 함께 확인하세요.';
  $('.section-title .eyebrow').textContent=role==='visitor'?'PLAN YOUR VISIT':role==='business'?'FIND YOUR OPPORTUNITY':'MANAGE YOUR STATION';
  $('#analytics').hidden=true;$('.route-picker').hidden=role!=='visitor';camera.stop();post({action:'overview'});setModeUI('overview');showFlow=role==='business'||role==='manager'&&$('#managerLines').checked;renderList();detail();sendFlow(showFlow);renderAnalytics();post({action:'people',enabled:peopleOn()});if(role==='manager'&&audiences.tab==='overview')setManagerFloor(managerFloor);const url=new URL(location.href);url.searchParams.set('role',role);history.replaceState(null,'',url);updateTime();loadVisibleScene();
}
function renderAnalytics(){if(!catalog)return;audiences.refresh();}
function endpointOptions(){return catalog.endpoints.map(e=>'<option value="'+esc(e.id)+'">'+esc(e.name)+' · '+esc(e.floor)+'</option>').join('')}
async function findRoute(){
  controller.from=$('#from').value;controller.to=$('#to').value;
  if(!controller.from){journey.openStart();notify('현재 위치 또는 출발점을 먼저 선택하세요.');return;}
  if(controller.from===controller.to){notify('서로 다른 출발점과 도착점을 선택하세요.');return}
  $('#findRoute').disabled=true;
  try{
    if(controller.to.startsWith('DEST-')){facilityRoutes??=await load('/data/experience/facility-routes.json');route=facilityRoutes.find(r=>r.from_endpoint===controller.from&&r.to_facility===controller.to);}
    else route=network.routes.find(r=>r.from_endpoint===controller.from&&r.to_endpoint===controller.to);
    if(!route){$('#routeSummary').innerHTML='<p class="notice">연속된 보행 경로가 아직 없습니다. 다른 출발점을 선택하거나 관리 화면에서 출입점·연결을 확인하세요.</p>';return}
    const from=catalog.endpoints.find(e=>e.id===controller.from),to=catalog.endpoints.find(e=>e.id===controller.to)||catalog.facilities.find(f=>f.id===controller.to);
    $('#mapTitle').textContent=from.name+' → '+to.name;
    $('#routeSummary').innerHTML='<div class="route-result"><strong>약 '+Math.ceil(route.distance_m/72+route.connections*.3)+'분 <span>'+int(route.distance_m)+'m</span></strong><small>모델 기반 미리보기 · 실제 통제/대기시간 확인</small><button id="startWalk" class="primary">▶ 1인칭 따라걷기</button><ol>'+routeInstructions(route).map((s,i)=>'<li><button data-instruction="'+i+'">'+(s.kind==='walk'?esc(s.floor)+'에서 약 '+int(s.metres)+'m 이동':esc(s.from)+' → '+esc(s.to)+' 층간 이동')+'</button></li>').join('')+'</ol></div>';
    $('#startWalk').onclick=()=>switchMode('walk');showFlow=false;setModeUI('overview');post({action:'route',route});mobileNavigation?.goMap();
  }catch(error){notify(error.message)}finally{$('#findRoute').disabled=false}
}
function setModeUI(next,exploreView){touchInput?.reset();mode=next;document.body.dataset.mapMode=next;document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===next)));$('#walkControls').hidden=next!=='walk';$('#walkCta').hidden=!(role==='visitor'&&route&&next==='overview');$('#touchControls').hidden=next!=='explore';$('.map-footnote').textContent=next==='explore'?'자유탐색 · 보행 가능 구간만 이동 · 원형점 선택 시 시설 정보':next==='bird'?'조망 · 원형점 선택 시 시설 정보 · 경로·흐름은 추정':'현재화 시설 모델 · 경로 및 흐름은 추정 · 실시간 측위 아님';openWorld.setMode(next,exploreView);}
async function switchMode(next){
  if(!sceneReady){notify('3D 지도가 준비된 뒤 사용할 수 있습니다.');return}
  if(next==='explore'&&!$('#from').value){journey.openStart();notify('자유탐색을 시작할 위치를 먼저 선택하세요.');return;}
  if(next==='walk'&&!route){await findRoute();if(!route)return}
  if(next==='flow'){showFlow=true;setModeUI('flow');post({action:'overview'});sendFlow(true);return}
  showFlow=false;setModeUI(next);post({action:next});post({action:'people',enabled:$('#people').checked});
}
function sendFlow(fit=false){
  if(!timeline||!network)return;const values=timeline[date].routes[hour],max=Math.max(1,...Object.values(timeline).flatMap(t=>t.routes.map(sum)));
  let shownValues=edgeValues,lineValues=null;
  if(role==='business'){shownValues=[];for(let i=0;i<edgeValues.length;i+=2){const e=network.edges[edgeValues[i]];if(e?.coordinates.some((p,k)=>inside(p,audiences.zone,k?e.to_floor:e.from_floor)))shownValues.push(edgeValues[i],edgeValues[i+1]);}}
  const epGeo={};for(const e of catalog.endpoints){const hd=network.headwayDwell?.endpoints?.[e.id];const hdd=hd?.dates?.[date];epGeo[e.id]={geo:e.geometry,floor:e.floor,mode:hd?.mode||'entrance',dwell:hd?.dwell_seconds?.[hour]??180,ambient:hdd?.ambient_hourly?.[hour]??hd?.ambient_hourly?.[hour]??0,ambientSplit:hd?.ambient_split||null};}
  // Manager: lines follow the chosen floors, the crowd keeps the whole station's flows.
  if(role==='manager'){const fl=new Set(managerFloors());lineValues=[];for(let i=0;i<edgeValues.length;i+=2){const e=network.edges[edgeValues[i]];if(e&&fl.has(e.from_floor)&&fl.has(e.to_floor))lineValues.push(edgeValues[i],edgeValues[i+1]);}}
  post({action:'flow',render:showFlow&&!(role==='manager'&&audiences.tab!=='overview')&&!(role==='business'&&audiences.storeFocused),fit:fit&&role==='visitor',edgeMax:network.max_edge_passages,routes:network.routes,values,max,edges:network.edges,edgeValues:shownValues,...(lineValues?{lineValues,keepFloors:true,clearLines:!showFlow}:{}),...(role==='business'&&audiences.storeFocused?{clearLines:true}:{}),style:$('#flowStyle').value,endpointGeo:epGeo,hour});
  if(showFlow)$('.map-footnote').textContent='7월 공통 척도 · 청록(적음) → 주황(많음) · 시간당 추정 통과량 · 다층 반투명';
}
async function updateTime(){
  if(!catalog)return;const version=++requestVersion;clockLabel();$('#hourCount').innerHTML=int(timeline[date].entries[hour].arrivals)+'<small>진입 후보 건/시간 · 추정</small>';
  post({action:'lighting',hour,environment:$('#environment').value});
  try{if(!cache.has(date))cache.set(date,await load('/data/experience/flows/'+date+'.json'));if(version!==requestVersion)return;edgeValues=cache.get(date)[hour];sendFlow();if(role!=='visitor'){const response=await load('/api/demo/sales?date='+date);if(version!==requestVersion)return;sales=maskSales(response,usage,catalog.dates);}renderAnalytics();detail();}catch(error){sales=null;renderAnalytics();notify(error.message)}
}
async function methods(){
  const m=await load('/data/experience/methodology.json'),p=m.parameters;
  $('#methods').innerHTML='<p>표시 기간: <b>2026년 7월</b>. 현황 모델은 이후에 확인한 시설을 반영합니다. 실시간 유동인구·혼잡 감지가 아닙니다.</p><h3>유동인구의 뜻</h3><p>원점별 승하차·도착 이벤트에 역사 참여율을 적용하고, 시간 확장 중력모형(IPF)으로 출도착 간 이동을 배분했습니다. 같은 사람의 여러 이동이 포함될 수 있으므로 고유 방문자로 읽지 않습니다.</p><h3>GTX</h3><p>일별 역사적 대리지표를 보존하고 경의선 시간대 패턴을 평일·주말 및 승하차 방향별로 적용했습니다. 05~23시는 추정 가동 구간이며 실제 시간표가 아닙니다.</p><h3>주차장</h3><p>규모 × 회전율 × 차량당 인원 × 역사 방문 비율에 시간대 유입과 체류시간 분포를 적용했습니다. 전월 말 유입과 다음 달 출차를 보존합니다.</p><div class="table-scroll"><table><tr><th>유형</th><th>회전율</th><th>차량당 인원</th><th>역사 비율</th></tr>'+['station_adjacent','building','small_general'].map((k,i)=>'<tr><td>'+['역 인접','건물 부설','소규모 일반'][i]+'</td><td>'+p.parking[k].turnover+'</td><td>'+p.parking[k].persons_per_vehicle+'</td><td>'+int(p.parking[k].station_share*100)+'%</td></tr>').join('')+'</table></div><h3>매장 이용과 매출</h3><p>화면에서 ‘시간당’(해당 시간대의 시간당 값, 시각 사이는 이어서 표시)과 ‘당일 누적’(00시부터 현재 시각까지의 합) 중 선택해 볼 수 있습니다. 이용인원은 결제건수 기준 가공값입니다. 29개 승인 매장만 포함하며, 시간대별 수치는 월별 매출 구성비를 각 일별 합계에 적용한 추정치입니다. 영업시간 밖 실제 매출 시간대도 보존합니다. 원금액·원본 파일·가공 복원 키는 제공하지 않습니다.</p><h3>매장 포커스</h3><p>역내상권분석에서 매장을 누르면 그 매장 정면과 매장 앞 통로(인근 통과와 같은 구간)를 지도에 띄우고 시간 흐름에 따라 수치를 보여줍니다. 통행 대비 이용은 이용 ÷ 매장 앞 통행이며, 통행이 시간당 '+MIN_PASSAGES+'건 미만이면 표시하지 않고 100%를 넘으면 모형 밖 유입(승강장·열차 이용객 등)으로 표시합니다. 상관은 하루 24시간 통행과 이용의 피어슨 상관계수로, 함께 움직이는 정도일 뿐 인과를 뜻하지 않습니다. 객단가는 가공 매출 ÷ 이용입니다.</p><h3>인근 통과</h3><p>매장 앞 통로를 우선합니다. 매장 보행 출입점에서 보행 격자를 따라 걸어서 15m 안에 닿는 유동 모형 이동 경로 가운데 가장 붐비는 구간의 시간당 통과 건수(양방향 합)입니다. 15m 안에 없을 때만 가장 가까운 경로(30m 안)를 씁니다. 벽 너머 통로는 걸어서 닿지 않으므로 제외하며, 30m 안에 모형 경로가 없으면 ‘경로 밖’으로 표시합니다. 유동 모형은 8개 출도착점 사이 이동만 배분하므로 승강장·선상 동측 부스 앞 통행은 담지 못합니다. 매장 입장객 수가 아닙니다.</p><h3>지도·사람 표현</h3><p>화살표·점·안개는 시간당 추정 통과 건수의 상대 크기를 보여줍니다. 제곱미터당 밀도가 아닙니다. 가상 보행자는 경로 통과량·출도착 체류·경로 미배정 하차(상주)로 추정한 동시 체류 인원을 모의합니다. 보행자는 경로 폭 안에서, 체류·상주 인원은 출도착 지점과 경로 주변에서 움직이며 2m 보행 격자 밖(벽·빈 공간·다른 층)으로 나가지 않습니다. 화면에서 가까운 인원부터 사람 모델로 표시하고, 기기 성능을 넘는 나머지는 같은 옷 색의 점으로 표시합니다. 실제 사람 위치·외모·동시 인원의 관측값이 아닙니다.</p><h3>경로와 카메라</h3><p>격자와 현재 모델을 기준으로 연결한 검토용 경로입니다. 계단·에스컬레이터 실제 운행 방향, 개찰 통제, 엘리베이터 대기시간은 현장 확인이 필요합니다. 카메라는 녹화·업로드하지 않고 3D 화면과 직접 비교만 제공합니다. AR 자동 정렬과 실내 측위는 포함하지 않습니다.</p><h3>범위와 민감도</h3><p>GTX·주차 ±30% 등 낮음/기준/높음 가정의 전체 월 경로 이동량: '+m.summary.allocation_sensitivity.map(s=>esc(s.scenario)+' '+int(s.mapped_route_trips)+'건').join(' / ')+'. 통계적 신뢰구간이 아닙니다. 상세 지도는 기준 시나리오입니다. 택시·미관측 도보량은 미확보이며 잔차를 실측 원점으로 만들지 않습니다.</p><h3>출처</h3><p>사용자 확정 원점별 일자·시간대 풀, 서울역 시설 등록부 리비전 334, 승인 매장별 자료 및 인기상품 목록. 모델 버전 '+esc(p.version)+'.</p>';
  $('#methods').insertAdjacentHTML('beforeend','<h3>구역 조명·플랫폼111</h3><p>2층은 3층 바닥이 덮는 범위에 사각 LED 천장을, 나머지 높은 실내에는 시간대별 자연채광을 표현했습니다. 천장 마감 높이·조명 간격·밝기는 사진과 모델에 기반한 시각화 추정이며 실측 조도가 아닙니다. 조망에서는 천장을 숨겨 지도를 가리지 않습니다.</p><p>'+PLATFORM111_SLIDES.basis+' 열차안내는 기존 사진의 글자·시간을 그대로 유지하며 실시간 열차 정보가 아닙니다. 화면 밖·숨긴 탭에서는 교대를 멈추고, 기기의 동작 줄이기 설정에서는 정지 사진을 사용합니다.</p><p>'+PLATFORM111_SLIDES.creditHtml+'</p>');
  $('#methodDialog').showModal();
}
async function openNote(f){
  try{const saved=await load('/api/management/note?facility='+encodeURIComponent(f.id));$('#methods').innerHTML='<h3>'+esc(f.name)+' · 운영 메모</h3><p>관리기업 권한 사용자에게만 표시됩니다.</p><textarea id="operationNote" maxlength="5000" rows="9">'+esc(saved.body)+'</textarea><button id="saveNote" class="primary">메모 저장</button><p id="noteStatus" role="status"></p>';$('#methodDialog').showModal();$('#saveNote').onclick=async()=>{const b=$('#saveNote');b.disabled=true;try{const r=await fetch('/api/management/note?facility='+encodeURIComponent(f.id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({body:$('#operationNote').value})});const out=await r.json();if(!r.ok)throw Error(out.error);$('#noteStatus').textContent='저장했습니다. 다른 기기에서도 확인할 수 있습니다.';}catch(e){$('#noteStatus').textContent=e.message}finally{b.disabled=false}};}catch(e){notify(e.message)}
}
$('#facilityList').addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(b)select(b.dataset.id)});
$('#facilityList').addEventListener('change',e=>{const id=e.target.dataset.compare;if(!id)return;if(e.target.checked){if(compared.length===3){e.target.checked=false;notify('비교는 최대 3곳까지 가능합니다.');return}compared.push(id)}else compared=compared.filter(x=>x!==id);renderAnalytics()});
for(const s of ['#search','#floor','#category'])$(s).addEventListener('input',renderList);
$('#audiences').addEventListener('click',e=>{const b=e.target.closest('[data-role]');if(b&&catalog){role=b.dataset.role;roleView()}});
$('.experience-toolbar').addEventListener('click',e=>{const b=e.target.closest('[data-mode]');if(b)switchMode(b.dataset.mode)});
$('#reconnect').onclick=()=>{ready=sceneReady=false;mapSource='live';camera.stop();const u=new URL($('#scene').src);u.searchParams.delete('map');$('#scene').src=u.href;$('#sceneQuality').hidden=true;$('#simpleMap').hidden=true;$('#mapStatus').textContent='원본 지도 다시 연결 중'};
$('#simpleMap').onclick=()=>{ready=sceneReady=false;camera.stop();mapSource='schematic';const u=new URL($('#scene').src);u.searchParams.set('map','schematic');$('#scene').src=u.href;$('#sceneQuality').hidden=false;$('#simpleMap').hidden=true;$('#mapStatus').textContent='간략 경로도 연결 중'};
$('#routeToggle').onclick=()=>{$('#routeForm').hidden=!$('#routeForm').hidden;$('#routeToggle').setAttribute('aria-expanded',String(!$('#routeForm').hidden))};
$('#findRoute').onclick=findRoute;
$('#routeSummary').onclick=e=>{const b=e.target.closest('[data-instruction]');if(!b||!route)return;const instruction=routeInstructions(route)[+b.dataset.instruction];post({action:'focus',point:instruction.point,floor:instruction.floor||instruction.from})};
// Continuous time: the slider and ▶ move in minutes; hourly data reload only when the hour changes.
$('#hour').step='0.05';$('#hour').max='23.95';
function clockLabel(){const m=Math.floor((clockT-Math.floor(clockT))*60);$('#hourLabel').textContent=String(hour).padStart(2,'0')+':'+String(m).padStart(2,'0')+' · '+String(hour).padStart(2,'0')+'시대 자료';}
function setClock(t){
  clockT=Math.max(0,Math.min(23.99,t));$('#hour').value=clockT.toFixed(2);const h=Math.floor(clockT);
  if(h!==hour){hour=h;updateTime();}else clockLabel();
  audiences.tick(clockT);
}
$('#hour').oninput=e=>setClock(+e.target.value);
$('#date').onchange=e=>{if(!catalog.dates.includes(e.target.value)){e.target.value=date;notify('2026년 7월 날짜를 선택하세요.');return}date=e.target.value;updateTime()};
function setPlaying(on){
  if(Boolean(on)===Boolean(timeTimer))return;
  if(!on){clearInterval(timeTimer);timeTimer=null;$('#timePlay').textContent='▶';audiences.tick(clockT);return;}
  audiences.pauseFeed();let lastTick=performance.now();timeTimer=setInterval(()=>{const now=performance.now(),next=clockT+(now-lastTick)/1000/HOUR_SECONDS;lastTick=now;setClock(next>=23.99?0:next)},100);$('#timePlay').textContent='Ⅱ';audiences.tick(clockT);
}
$('#timePlay').onclick=()=>setPlaying(!timeTimer);
bindPeopleToggle({checkbox:$('#people'),button:$('#walkPeople'),onChange:enabled=>post({action:'people',enabled})});
$('#flowStyle').onchange=()=>{showFlow=true;setModeUI('flow');post({action:'overview'});sendFlow();audiences.refresh()};
$('#environment').onchange=()=>updateTime();
$('#playWalk').onclick=()=>post({action:'play'});
$('#walkCta').onclick=()=>switchMode('walk');
$('#exitWalk').onclick=()=>switchMode('overview');
$('#walkProgress').oninput=e=>post({action:'seek',value:+e.target.value});
$('#walkSpeed').onchange=e=>post({action:'speed',value:+e.target.value});
touchInput=bindExplorationPointers({movement:$('#touchControls'),jump:$('#exploreJump'),enabled:()=>mode==='explore',onKeys:keys=>post({action:'touch-keys',keys}),onJump:()=>post({action:'play-action',value:'jump'})});
$('#touchControls>span').textContent='버튼을 함께 눌러 이동·회전 · 3인칭에서 점프';
$('#rideChoices').onclick=e=>{const b=e.target.closest('[data-ride]');if(b)post({action:'ride',to:+b.dataset.ride})};
const moveKeys=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','ShiftLeft','ShiftRight','Equal','Minus','NumpadAdd','NumpadSubtract','PageUp','PageDown']);
document.addEventListener('keydown',e=>{
  if(mode==='walk'&&e.code==='Escape'){switchMode('overview');return}
  if((mode!=='explore'&&mode!=='bird')||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable||document.querySelector('dialog[open]'))return;
  if(e.code==='Escape'){if(mode==='explore')post({action:'bird'});return}
  if(mode==='explore'&&e.code==='Enter'&&!e.target.closest('button,summary,a')){e.preventDefault();if(!e.repeat)post({action:'ride-nearest'});return}
  // Exploration buttons retain focus after a click. Keep game keys active there,
  // while preserving Space activation on unrelated buttons, links and forms.
  const playFocus=!e.target.closest('button,summary,a')||e.target.closest('[data-explore-view],[data-place],[data-explore-floor],#exploreGo,#exploreJump,[data-play-pose],#touchControls [data-key]');
  if(mode==='explore'&&document.body.dataset.exploreView==='third'&&playFocus&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&['Space','Digit1','Digit2','Digit3','Digit4'].includes(e.code)){e.preventDefault();if(!e.repeat)post({action:'play-action',value:({Space:'jump',Digit1:'wave',Digit2:'bow',Digit3:'cheer',Digit4:'photo'})[e.code]});return;}
  if(moveKeys.has(e.code)){e.preventDefault();post({action:'key',key:e.code,down:true})}
});
document.addEventListener('keyup',e=>post({action:'key',key:e.code,down:false}));
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInterval(timeTimer);timeTimer=null;$('#timePlay').textContent='▶';for(const key of ['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight'])post({action:'key',key,down:false})}});
$('#methodButton').onclick=()=>methods().catch(e=>notify(e.message));$('#methodClose').onclick=()=>$('#methodDialog').close();
document.addEventListener('click',e=>{const b=e.target.closest('[data-hour]');if(b)setClock(+b.dataset.hour);const s=e.target.closest('[data-select]');if(s)select(s.dataset.select)});
document.addEventListener('click',e=>{const b=e.target.closest('[data-day]');if(b&&catalog.dates[+b.dataset.day]){date=catalog.dates[+b.dataset.day];$('#date').value=date;updateTime()}});
$('#analytics').addEventListener('input',e=>{if(['fixedCost','variableCost'].includes(e.target.id))updateBreakEven($('#analytics'))});
window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==$('#scene')?.contentWindow)return;const d=e.data;
  if(d?.type==='station-one:catalog-map-ready'&&d.vworldReady){ready=true;mapSource=d.source||mapSource;$('#mapStatus').textContent=mapSource==='schematic'?'간략 경로도 · 건축 모델 미연결':'3D 지도 연결됨';$('.map-footnote').hidden=mapSource==='schematic';}
  if(d?.type==='station-one:catalog-map-error'){$('#mapStatus').textContent='원본 지도 연결 실패 · '+(d.stage==='metadata'?'서버 응답 없음':d.stage);$('#simpleMap').hidden=false;}
  if(d?.type==='station-one:catalog-focus-applied')$('#mapStatus').textContent='시설 정면 보기';
  if(d?.type==='station-one:route-review-applied')$('#mapStatus').textContent=d.ok?'선택 위치 표시됨':'좌표 확인 필요';
  if(d?.type==='station-one:experience-state'){
    if(d.ready){sceneReady=true;sendFacilities();post({action:'people',enabled:peopleOn()});post({action:'speed',value:+$('#walkSpeed').value});updateTime();if(role==='visitor'){if(route)post({action:'route',route});if(selected)focus(selected);}else{sendFlow(true);audiences.refresh(true);if(role==='manager'){audiences.managerRedraw();if(audiences.tab==='overview')managerOverview(true);}}}
    if(d.view&&d.viewKey)audiences.saveView(d.viewKey,d.view);
    if(d.error)notify(d.error);if(d.notice)notify(d.notice);
    if(d.activeFloor&&role==='visitor')$('#mapTitle').textContent='서울역 · '+d.activeFloor;
    if(d.activeFloor||d.birdFloor)openWorld.setFloor(d.birdFloor||d.activeFloor);
    if(d.facility)openWorld.showFacility(d.facility);
    if(d.photo)openWorld.savePhoto(d);
    if(d.progress!==undefined){$('#walkProgress').value=d.progress;$('#walkState').textContent=int(d.metres)+'m · '+d.floor;}
    if(d.playing!==undefined)$('#playWalk').textContent=d.playing?'일시정지':d.arrived?'다시 걷기':'계속 걷기';
    if(d.mode)setModeUI(d.mode,d.exploreView);
    if(d.playAction)notify(({jump:'점프',wave:'손 흔들기',bow:'인사',cheer:'만세',photo:'사진 포즈 · [사진]을 눌러 저장 · 이동하면 해제'})[d.playAction]||'');
    if(d.avatarState)$('#explorePlay').setAttribute('aria-label','아바타 · '+({idle:'서 있음',walking:'걷는 중',jump:'점프 중',wave:'손 흔들기',bow:'인사',cheer:'만세',photo:'사진 포즈'})[d.avatarState]);
    if(d.nearby)$('#rideChoices').innerHTML=d.nearby.map(e=>'<button data-ride="'+e.to+'">'+esc(e.name)+'</button>').join('');
    if(d.avatars!==undefined)journey.crowdStatus(d);
    if(d.managerPick&&role==='manager')audiences.managerPick(d.managerPick);
    if(d.managerGround&&role==='manager')audiences.managerGround(d.managerGround);
    if(d.ready)enterLinkedExploration();
  }
});
async function start(){
  try{[catalog,network,usage,timeline,session]=await Promise.all([load('/api/catalog'),load('/data/experience/network.json'),load('/data/experience/usage.json'),load('/data/experience/timeline.json'),load('/api/session')]);
    maskUsage(usage,catalog.dates);
    try{network.headwayDwell=await load('/data/experience/headway-dwell.json');}catch(e){}
    try{network.frontage=(await load('/data/experience/store-frontage.json')).stores;}catch(e){}
    const floors=['B7','B6','B3','B2','B1','1F','2F','3F','4F'];$('#floor').innerHTML='<option value="">전체 층</option>'+floors.map(f=>'<option>'+f+'</option>').join('');$('#floor').value='2F';$('#category').value='매장';
    $('#from').innerHTML='<option value="">현재 위치 / 출발점 선택</option>'+endpointOptions();$('#to').innerHTML='<optgroup label="출도착 지점">'+endpointOptions()+'</optgroup><optgroup label="보행 출입점이 있는 시설">'+catalog.facilities.filter(f=>f.access_id).map(f=>'<option value="'+esc(f.id)+'">'+esc(f.name)+' · '+esc(f.floor)+'</option>').join('')+'</optgroup>';
    $('#from').value='';$('#to').value=catalog.endpoints.find(e=>e.name.includes('서쪽'))?.id||catalog.endpoints.at(-1).id;
    if(catalog.analysis_stale)notify('시설 수정 이력과 분석 기준 버전이 다릅니다. 유동 분석은 리비전 '+catalog.analysis_revision+' 기준입니다.');
    journey.initialize({skipDeparturePrompt:linkedExploration.pending});facilityItems=openWorld.initialize();sendFacilities();roleView();mobileNavigation=createMobileNavigation({onExplore:()=>journey.setTab('explore')});updateTime();explorationInitialized=true;enterLinkedExploration();
  }catch(e){$('#listCount').innerHTML=esc(e.message)+' <button id="retryData">자료 다시 연결</button>';$('#retryData').onclick=start;}
}
function loadVisibleScene(){if(role!=='visitor'&&matchMedia('(max-width:1023px)').matches)return;const frame=$('#scene');if(frame.dataset.started)return;frame.dataset.started='true';frame.src='/app/?site=S202103&embed=catalog&floor=2F&pointReview=1&experience=1'+(q.get('scene')==='local'?'&scene=local':'');}
matchMedia('(max-width:1023px)').addEventListener('change',loadVisibleScene);
loadVisibleScene();
start();

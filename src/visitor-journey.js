import {esc,int} from './experience-core.js';
export function createVisitorJourney({getContext,post,notify,onStart,onExplore,onLeaveExplore}){
 const $=s=>document.querySelector(s);let floor='2F',activeTab='facility',departureChosen=false;
 const names={visitor:'3D내비',business:'역내상권분석',manager:'운영관리 의사결정 지원'};
 for(const b of document.querySelectorAll('[data-role]'))b.textContent=names[b.dataset.role];
 $('.brand small').textContent='야!너두 스테이션 · 검증 프로토타입';
 $('.finder').insertAdjacentHTML('afterbegin','<nav class="visitor-tabs" aria-label="기능 선택"><button data-tab="facility" aria-pressed="true">시설안내</button><button data-tab="route" aria-pressed="false">경로안내</button><button data-tab="explore" aria-pressed="false">자유탐색</button></nav><section class="departure-first"><span>출발 위치</span><button id="chooseDeparture">현재 위치 / 출발점 선택</button><small>GPS가 아닌 직접 선택 방식입니다.</small></section>');
 $('.map-options').insertAdjacentHTML('beforeend','<label class="bob-choice"><input id="walkBob" type="checkbox" checked> 보행효과</label>');
 $('.map-stage').insertAdjacentHTML('beforeend','<output id="crowdStatus" hidden></output>');
 document.body.insertAdjacentHTML('beforeend','<dialog id="departureDialog"><span class="eyebrow">START HERE</span><h2>지금 어디에 계세요?</h2><p>가까운 출입구·환승 지점을 출발점으로 선택하세요.<br>실시간 실내 측위는 아닙니다.</p><div id="departureOptions"></div><button id="departureClose">닫기</button></dialog><section id="desktopGate" hidden><span>DESKTOP WORKSPACE</span><h1>넓은 화면에서 확인해 주세요.</h1><p>상권분석과 운영관리는 공간과 지표를 함께 보는 데스크톱 전용 화면입니다.<br>가로 1,024px 이상 화면에서 이용할 수 있습니다.</p><button id="goVisitor">모바일 3D내비로 이동</button><a href="/">프로젝트 소개</a></section>');
 function endpointPoint(e){return e.geometry?.type==='Point'?e.geometry.coordinates:e.geometry?.coordinates?.[0]?.[0];}
 function openStart(){if(!getContext().catalog)return;$('#departureDialog').showModal();}
 function setStart(id){$('#from').value=id;onStart();departureChosen=true;const e=getContext().catalog.endpoints.find(e=>e.id===id);$('#chooseDeparture').textContent=e?e.name+' · 변경':'현재 위치 / 출발점 선택';if(e){floor=e.floor;post({action:'set-start',floor:e.floor,point:endpointPoint(e)});post({action:'focus',floor:e.floor,point:endpointPoint(e)});}$('#departureDialog').close();}
 function setTab(tab){
  const previous=activeTab;activeTab=tab;document.body.dataset.visitorTab=tab;
  if(previous==='explore'&&tab!=='explore')onLeaveExplore?.();
  document.querySelectorAll('.visitor-tabs button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)));
  if(tab==='explore')onExplore?.();
  else if(tab==='route'){
   if(!departureChosen)openStart();
  }
 }
 $('#chooseDeparture').onclick=openStart;$('#departureClose').onclick=()=>$('#departureDialog').close();
 $('#from').addEventListener('change',()=>setStart($('#from').value));
 $('#departureOptions').onclick=e=>{const b=e.target.closest('[data-start]');if(b)setStart(b.dataset.start);};
 $('.visitor-tabs').onclick=e=>{const b=e.target.closest('[data-tab]');if(b)setTab(b.dataset.tab);};
 $('#walkBob').onchange=e=>post({action:'bob',enabled:e.target.checked});
 $('#goVisitor').onclick=()=>document.querySelector('[data-role=visitor]').click();
 function roleChanged(role){const narrow=matchMedia('(max-width:1023px)').matches;$('#desktopGate').hidden=role==='visitor'||!narrow;post({action:'people',enabled:(role==='visitor'||role==='business')&&$('#people').checked});if(role==='visitor')setTab(activeTab);else document.body.dataset.visitorTab='';}
 matchMedia('(max-width:1023px)').addEventListener('change',()=>roleChanged(getContext().role));
 return {openStart,roleChanged,setTab,initialize({skipDeparturePrompt=false}={}){const ctx=getContext();$('#departureOptions').innerHTML=ctx.catalog.endpoints.map(e=>'<button data-start="'+esc(e.id)+'"><b>'+esc(e.name)+'</b><small>'+esc(e.floor)+'</small></button>').join('');$('.finder').insertBefore($('.route-picker'),$('.facility-list'));setTab('facility');if(!skipDeparturePrompt)setTimeout(()=>{if(!departureChosen&&ctx.role==='visitor'&&activeTab!=='explore')openStart();},800);},crowdStatus(d){const r=getContext().role,manager=r==='manager'&&document.body.dataset.managementTab==='overview';$('#crowdStatus').hidden=!(manager||(r==='visitor'||r==='business')&&$('#people').checked)||d.crowdEnabled===false;$('#crowdStatus').textContent='동시체류 추정 '+int(d.expected)+'명'+(d.simulated<d.expected?' 중 '+int(d.simulated)+'명 모의':' 전원 모의')+' · 이 화면('+(d.floors||'전 층')+') 사람 '+int(d.avatars)+' · 점 '+int(d.farAvatars||0)+(d.upper>0?' · 3층 순환 '+int(d.upper)+'명':'')+' · 실측 아님';}};
}

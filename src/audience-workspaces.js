import {ZONES,spatialRows,zonePassages,performanceTable,position,zoneSeries,zoneTotals,frontHeading,seriesAt,valueAt,clockText,nearbyText} from './spatial-analysis.js';
import {esc,int,sum,breakEven} from './experience-core.js';
import {bars} from './experience-analytics.js';
import {retailScenario} from './feedback-core.js';
import {createConfirmedManager} from './confirmed-manager.js';
import {createOperationsFeed} from './operations-feed.js';
import {occupancyAt} from './operations-core.js';
import {createStoreFocus} from './store-focus.js';

export function createAudienceWorkspaces({getContext,post,notify,select,onZoneChange,onTab,setHour,showPlace,playback}){
  const $=s=>document.querySelector(s);let zone=ZONES[1],tab='overview',loadedEditor='',lastRole=null,zoneHeading=325,zoneSig='',live=null;
  // Store usage and sales: rate per hour (시간당) or the day's running total (당일 누적). Remembered on this device.
  let valueMode=(()=>{try{return localStorage.getItem('station:value-mode')==='cumulative'?'cumulative':'hourly';}catch{return 'hourly';}})();
  const cumulative=()=>valueMode==='cumulative',rangeText=t=>cumulative()?'00:00~'+clockText(t)+' 누적':clockText(t);
  const withUnit=(v,unit)=>v===null||v===undefined?'미확보':int(v)+unit;
  const modeToggle=()=>'<div class="value-mode" role="group" aria-label="이용·매출 집계 방식"><button type="button" data-value-mode="hourly" aria-pressed="'+!cumulative()+'">시간당</button><button type="button" data-value-mode="cumulative" aria-pressed="'+cumulative()+'">당일 누적</button></div>';
  document.addEventListener('click',e=>{const b=e.target.closest('[data-value-mode]');if(!b||b.dataset.valueMode===valueMode)return;valueMode=b.dataset.valueMode==='cumulative'?'cumulative':'hourly';try{localStorage.setItem('station:value-mode',valueMode);}catch{}refresh(false);});
  $('.finder').insertAdjacentHTML('beforebegin','<aside id="zonePanel" hidden><span class="eyebrow">RETAIL AT A GLANCE</span><h1>구역 상권 조망</h1><p>공간 위에서 이용·매출·흐름을 비교합니다.</p><label>분석 구역<select id="zoneSelect">'+ZONES.map(z=>'<option value="'+z.id+'">'+z.name+'</option>').join('')+'</select></label><label>표시 지표<select id="zoneMetric"><option value="both">이용인원 + 가공 매출</option><option value="usage">이용인원</option><option value="sales">가공 매출</option><option value="flow">인근 통과량</option></select></label><div class="zone-mode"><span>이용·매출 집계</span><div id="zoneValueMode"></div></div><div class="zone-view-buttons"><button id="fitZone">구역 한눈에 · 매장 정면</button></div><label class="zone-people"><input type="checkbox" id="zonePeople" checked> 가상 보행자 표시</label><div class="zone-view-buttons"><button id="saveZoneView">현재 시점 저장</button><button id="restoreZoneView">저장 시점 보기</button></div><small>시점은 이 기기에 저장됩니다.</small><details><summary>선택 매장 주변으로 구역 지정</summary><p>아래 목록에서 매장을 고른 뒤 반경을 선택하세요.</p><label>반경<select id="zoneRadius"><option value="20">20m</option><option value="35" selected>35m</option><option value="50">50m</option></select></label><button id="customZone">선택 매장 중심 적용</button></details><div id="zoneSummary"></div><div id="zoneStores" aria-label="구역 내 매장"></div></aside>');
  $('.map-column').insertAdjacentHTML('beforebegin','<nav id="managementTabs" aria-label="시설·운영 관리 업무" hidden>'+[['overview','총괄'],['facilities','시설'],['routes','경로'],['data','데이터']].map(([id,n])=>'<button data-management-tab="'+id+'" aria-pressed="'+(id==='overview')+'">'+n+'</button>').join('')+'</nav>');
  $('#analytics').insertAdjacentHTML('beforebegin','<section id="spatialReport" hidden></section>');
  document.body.insertAdjacentHTML('beforeend','<dialog id="editorSwitchDialog"><h2>작업판을 바꿀까요?</h2><p>현재 작업판에서 저장을 마친 뒤 이동하세요. 저장하지 않은 입력은 사라질 수 있습니다.</p><button id="editorStay">계속 편집</button> <button id="editorSwitch">저장 완료 · 이동</button></dialog>');
  $('.map-column').insertAdjacentHTML('afterend','<section id="managementEditor" hidden><div id="editorLinks"></div><div id="editorAccess"></div><iframe id="editorFrame" title="관리 작업판" src="about:blank" hidden></iframe></section>');
  $('.map-stage').insertAdjacentHTML('beforeend','<div id="spatialLegend" hidden><b>공간 분석</b><span class="legend-usage">● 이용인원</span><span class="legend-sales">● 가공 매출</span><span>선: 추정 통과량</span><small>막대: 이 구역 하루 최대 대비 (정면 30°는 높이, 위에서 90°는 길이) · 가려진 부분은 옅게 · 구역 간 직접 비교 불가</small></div>');
  const managerUI=createConfirmedManager({getContext,notify,post});
  // Manager overview: situations of the chosen hour with map locations and demo action records.
  const feed=createOperationsFeed({getContext,post,notify,setHour,showPlace,
    openFacility:id=>{managerUI.focusRecord('facilities',id);$('[data-management-tab=facilities]').click();}});
  // One store in focus (business): facade, store-front corridor and the day's figures following the clock.
  const storeFocus=createStoreFocus({getContext:()=>({...getContext(),valueMode}),post,playback,setClock:t=>setHour(t),
    sceneWindow:()=>getContext().sceneReady?document.querySelector('#scene')?.contentWindow:null,zoneHeading:()=>zoneHeading,onEnter:()=>onZoneChange(),onExit:()=>{zoneSig='';onZoneChange();refresh(true);}});
  $('#zoneSelect').value=zone.id;
  $('#zoneSelect').onchange=()=>{storeFocus.close({silent:true});zone=ZONES.find(z=>z.id===$('#zoneSelect').value)||zone;onZoneChange();zoneSig='';refresh(true)};
  $('#zoneMetric').onchange=()=>refresh(false);
  // Fit faces the most storefronts (facade photo directions); the map's ↶/↷ buttons turn the view by 30° or 90°.
  $('#fitZone').onclick=()=>{if(storeFocus.active)storeFocus.close();else refresh(true);};
  $('#zonePeople').onchange=()=>{const p=document.querySelector('#people');if(p){p.checked=$('#zonePeople').checked;p.dispatchEvent(new Event('change',{bubbles:true}));}};
  $('#saveZoneView').onclick=()=>post({action:'capture-view',key:zone.id});
  $('#restoreZoneView').onclick=()=>{try{const view=JSON.parse(localStorage.getItem('station:zone-view:'+zone.id)||'null');if(view)post({action:'camera',command:'restore',view});else notify('이 구역에 저장한 시점이 없습니다.')}catch{notify('저장된 시점을 읽을 수 없습니다.')}};
  $('#customZone').onclick=()=>{const f=getContext().selected;if(!f?.reference){notify('구역 목록에서 매장을 먼저 선택하세요.');return}const pos=position(f),parent=ZONES.find(z=>z.floor===f.floor&&z.bounds&&pos[0]>=z.bounds[0]&&pos[0]<=z.bounds[2]&&pos[1]>=z.bounds[1]&&pos[1]<=z.bounds[3]);zone={id:'around-'+f.id,name:f.name+' 주변',floor:f.floor,center:pos,radius:+$('#zoneRadius').value,heading:parent?.heading||325,pitch:-18};storeFocus.close({silent:true});onZoneChange();zoneSig='';refresh(true)};
  $('#zoneStores').onclick=e=>{const b=e.target.closest('[data-zone-store]');if(b)select(b.dataset.zoneStore)};
  $('#managementTabs').addEventListener('click',e=>{const b=e.target.closest('[data-management-tab]');if(!b)return;const changed=b.dataset.managementTab!==tab;tab=b.dataset.managementTab;if(changed)onTab?.(tab);renderEditor();refresh(tab==='overview');});
  $('#spatialReport').oninput=e=>{if(e.target.closest('#retailCalculator'))calculateScenario();};
  function calculateScenario(){const v=Object.fromEntries([...document.querySelectorAll('#retailCalculator [data-scenario]')].map(i=>[i.dataset.scenario,i.value===''?NaN:Number(i.value)])),r=retailScenario(v);$('#zoneBreakEven').innerHTML=r?'월 예상매출 <b>'+int(r.revenue)+'원</b> · 영업이익 <b>'+int(r.profit)+'원</b><br>손익분기 월매출 '+int(r.breakEven)+'원 · 일평균 약 '+Math.ceil(r.transactionsPerDay)+'건 필요':'객단가·마진·비용·영업일·예상 결제건수를 모두 입력하세요. 수수료율은 매출총이익률보다 작아야 합니다.';}
  function renderEditor(){
    const active=getContext().role==='manager';document.body.dataset.managementTab=active?tab:'overview';
    $('#managementTabs').hidden=!active;$('#managementEditor').hidden=!active||tab==='overview';
    $('#managementTabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.managementTab===tab)));
    if(active)managerUI.show(tab);else managerUI.leave();
    feed.setActive(active&&tab==='overview');
  }
  function auth(session){return '<div class="auth-panel"><h3>관리 권한이 필요합니다</h3><p>매출·등록·수정은 승인 계정만 이용할 수 있습니다.</p><a href="/signin-with-chatgpt?return_to=%2F%3Frole%3Dmanager" target="_top">ChatGPT로 로그인</a>'+(session.authenticated?'<p>접근 ID: '+esc(session.user_id)+'</p>':'')+'</div>'}
  function refresh(fit=false){
    const ctx=getContext();if(!ctx.catalog)return;
    const business=ctx.role==='business',manager=ctx.role==='manager';
    $('#zonePanel').hidden=!business;$('#spatialReport').hidden=!business&&!manager;$('#spatialLegend').hidden=!business;
    if(lastRole!==ctx.role){lastRole=ctx.role;renderEditor();fit=true;if(!business)storeFocus.close({silent:true});}
    if(manager)$('.workspace').append($('#spatialReport'));else $('.map-column').append($('#spatialReport'));
    if(!manager)$('#reviewAttention')?.remove();
    if(!business&&!manager){post({action:'analysis-clear'});return;}
    if(manager&&tab!=='overview')return;
    const rows=spatialRows(ctx,business?zone:null),available=rows.filter(r=>r.approved),authorized=true,t=ctx.clock??ctx.hour,cum=cumulative();
    // One day of hourly series per table row; figures are read at the smooth clock t (rate or running total).
    const tableRows=business?rows:available,series=zoneSeries(ctx,tableRows);
    const totals=business?zoneTotals(ctx,zone,series):{...zoneTotals(ctx,zone,series),passages:Array.from({length:24},(_,h)=>sum(ctx.timeline[ctx.date].routes[h]))};
    live={series,totals,business};
    const coveredUsage=available.filter(r=>r.usage!==null),coveredSales=available.filter(r=>r.sales!==null),unit=cum?'':'/시';
    const kpis='<div class="spatial-kpis"><div><small>'+(business?'구역 경유 이동':'출도착 간 이동')+' / <i data-live-clock>'+clockText(t)+'</i></small><strong><i data-live-kpi="passages">'+int(seriesAt(totals.passages,t))+'</i><em>건/시</em></strong></div>'+
      '<div><small>매장 이용인원 / <i data-live-clock-range>'+rangeText(t)+'</i></small><strong><i data-live-kpi="usage">'+int(valueAt(totals.usage,t,valueMode))+'</i><em>건'+unit+'</em></strong><small>'+coveredUsage.length+'/'+available.length+'개 승인 매장 자료 확보</small></div>'+
      '<div><small>가공 매출 / <i data-live-clock-range>'+rangeText(t)+'</i></small><strong>'+(authorized?'<i data-live-kpi="sales">'+int(valueAt(totals.sales,t,valueMode))+'</i>':'권한 필요')+'<em>'+(authorized?'원'+unit:'')+'</em></strong><small>'+(authorized?coveredSales.length+'/'+available.length+'곳 자료 확보':'승인 계정 전용')+'</small></div></div>';
    const table=performanceTable(tableRows,{hour:ctx.hour,authorized,manager,mode:valueMode,t,series});
    if(business){
      $('#zoneValueMode').innerHTML=modeToggle();$('#fitZone').textContent=storeFocus.active?'← 구역 전체로 돌아가기':'구역 한눈에 · 매장 정면';
      $('#zoneSummary').innerHTML='<h2>'+esc(zone.name)+'</h2><p>'+rows.length+'개 매장 · 영업자료 '+available.length+'곳 매칭</p>';
      $('#zoneStores').innerHTML=rows.map((r,i)=>'<button data-zone-store="'+esc(r.id)+'" aria-pressed="'+(ctx.selected?.id===r.id)+'"><span class="store-number">'+(i+1)+'</span><span><b>'+esc(r.name)+'</b><small>'+(cum?'누적 이용 ':'이용 ')+'<i data-live-usage="'+i+'" data-unit="건'+unit+'">'+withUnit(valueAt(series[i].usage,t,valueMode),'건'+unit)+'</i> · 통과 <i data-live-flow="'+i+'">'+nearbyText(r.nearby)+'</i>'+(r.nearby?.offRoute?'':'건/시')+'</small></span></button>').join('')||'<p>이 구역에 등록된 매장이 없습니다.</p>';
      // The map gets the whole day once per zone/date/metric/mode and then only the time; values glide between hours.
      const peak=k=>Math.max(1,...series.flatMap(s=>(s[k]||[]).filter(Number.isFinite))),dayTotal=k=>Math.max(1,...series.map(s=>(s[k]||[]).reduce((a,v)=>a+(Number.isFinite(v)?v:0),0)));
      const sig=[zone.id,ctx.date,$('#zoneMetric').value,valueMode,Boolean(ctx.sales),ctx.flowsByHour?1:0].join('|');
      if(fit)zoneHeading=frontHeading(ctx.catalog,rows,zone.heading||325);
      if(storeFocus.active){if(sig!==zoneSig){zoneSig=sig;storeFocus.refresh();}}
      else if(fit||sig!==zoneSig){zoneSig=sig;const boundary=zone.radius?null:zone.bounds;
        post({action:'analysis',rows:rows.map((r,i)=>({id:r.id,name:r.name,point:r.point,approved:r.approved,series:series[i],offRoute:series[i].offRoute})),zone:{...zone,bounds:boundary},metric:$('#zoneMetric').value,fit,t,valueMode,
          maxima:{usage:cum?dayTotal('usage'):peak('usage'),sales:cum?dayTotal('sales'):peak('sales'),flow:peak('flow')},barMax:Math.min(16,Math.max(7,rows.length*1.4)),authorized,...(fit?{view:{heading:zoneHeading,pitch:-30}}:{})});}
      $('#mapTitle').textContent=storeFocus.active?zone.name+' · 매장 포커스':zone.name+' · 구역 조망';
      $('#spatialReport').innerHTML='<div class="spatial-report-heading"><div><span class="eyebrow">ZONE COMPARISON</span><h2>'+esc(zone.name)+'</h2></div>'+modeToggle()+'<span>'+ctx.date+'</span></div>'+kpis+table+'<p class="muted">'+(cum?'당일 누적은 00시부터 현재 시각까지의 합계입니다(현재 시간대는 지난 분만큼 반영). ':'시간당 값은 해당 시간대의 시간당 이용·매출이며 시각 사이를 이어서 보여줍니다. ')+'구역 경유 이동은 구역을 지나는 경로별 이동을 한 번씩 집계합니다. 매장별 인근 통과량의 합계가 아니며, 고유 방문자·매장 입장객 수가 아닙니다. 분석 구역은 공간 비교용이며 실제 임대 경계가 아닙니다.</p>';
    }else{
      post({action:'analysis-clear'});
      $('#mapTitle').textContent='서울역 유동인구 · 운영 총괄';
      const occ=occupancyAt(ctx,ctx.hour,ctx.edgeValues);
      $('#spatialReport').innerHTML='<div class="operations-overview"><section class="operating-results"><div class="spatial-report-heading"><div><span class="eyebrow">STORE PERFORMANCE</span><h2>매장별 영업실적</h2></div>'+modeToggle()+'<span>'+ctx.date+'</span></div>'+kpis.replace('<div class="spatial-kpis">','<div class="spatial-kpis"><div class="kpi-occupancy"><small>동시체류 추정 / '+ctx.hour+'시</small><strong>'+int(occ.expected)+'<em>명</em></strong><small>보행 '+int(occ.walking)+' · 대기 '+int(occ.dwell)+' · 비환승 '+int(occ.ambient)+'</small></div>')+table+'</section>'+(!authorized?'<aside class="operations-messages">'+auth(ctx.session)+'</aside>':'')+'</div>';
    }
    if(manager){if(feed.element.parentElement!==$('.workspace'))$('.workspace').append(feed.element);feed.update();}
    const f=ctx.selected,u=f&&ctx.usage.stores[f.id],s=f&&ctx.sales?.stores[f.id],day=ctx.catalog.dates.indexOf(ctx.date);
    if(business&&f&&u){$('#spatialReport').insertAdjacentHTML('beforeend','<section class="selected-performance"><span class="eyebrow">SELECTED STORE</span><h2>'+esc(f.name)+' · 이용·매출 추이</h2><div class="analysis-grid"><section><h3>시간대별 이용인원 · 건</h3>'+bars(u.hourly[day]||Array(24).fill(null),{selected:ctx.hour})+'</section><section><h3>일자별 이용인원 · 건</h3>'+bars(u.daily,{selected:day,action:'day'})+'</section>'+(authorized&&s?'<section><h3>시간대별 가공 매출 · 원</h3>'+bars(s.hourly||Array(24).fill(null),{selected:ctx.hour,unit:'원'})+'</section><section><h3>일자별 가공 매출 · 원</h3>'+bars(s.trend,{selected:day,action:'day',unit:'원'})+'</section>':'')+'</div><p class="muted">영업시간 밖 관측 구성비도 포함합니다. 시간대 수치는 일별 합계를 구성비로 배분한 추정입니다.</p></section>');}
    if(business){
      const fields=[['ticket','객단가 (원)'],['margin','매출총이익률 (%)'],['fees','카드·플랫폼 수수료율 (%)'],['rent','월 임대료 (원)'],['labor','월 인건비 (원)'],['utilities','월 관리비·공과금 (원)'],['other','월 기타 고정비 (원)'],['days','월 영업일수'],['customers','예상 일 결제건수']];
      $('#spatialReport').insertAdjacentHTML('beforeend','<details class="calculator"><summary>입점 검토 · 객단가 / 마진 / 비용 시나리오</summary><p>매출총이익률은 원가 차감 후 비율입니다. 카드·플랫폼 수수료는 별도로 차감합니다. 임대료·매출 전망을 보장하지 않으며 세금·보증금·초기투자는 포함하지 않습니다.</p><div id="retailCalculator">'+fields.map(([key,label])=>'<label>'+label+'<input type="number" data-scenario="'+key+'" min="0" step="any"></label>').join('')+'</div><output id="zoneBreakEven">가정을 모두 입력하세요. 불필요한 비용은 0으로 입력합니다.</output></details>');
      const cum=cumulative(),t=ctx.clock??ctx.hour,unit=cum?'':'/시',series=live?.series||[];
      const cards='<section class="retail-cards" aria-label="구역 매장별 영업실적">'+rows.map((r,i)=>'<button data-select="'+esc(r.id)+'" aria-pressed="'+(storeFocus.id===r.id)+'" title="매장 포커스 · 정면과 시간대 변화"><span class="store-number">'+(i+1)+'</span><h3>'+esc(r.name)+'</h3><dl><dt>'+(cum?'누적 이용':'이용인원')+'</dt><dd><i data-live-card="usage" data-row="'+i+'" data-unit="건'+unit+'">'+withUnit(valueAt(series[i]?.usage,t,valueMode),'건'+unit)+'</i></dd><dt>'+(cum?'누적 매출':'가공 매출')+'</dt><dd><i data-live-card="sales" data-row="'+i+'" data-unit="원'+unit+'">'+withUnit(valueAt(series[i]?.sales,t,valueMode),'원'+unit)+'</i></dd><dt>인근 통과</dt><dd>'+nearbyText(r.nearby)+(r.nearby?.offRoute?'':'건/시')+'</dd></dl><small>'+esc(r.floor)+' · <i data-live-clock-range>'+rangeText(t)+'</i> · '+(r.approved?'자료 매칭':'영업자료 미매칭')+'</small></button>').join('')+'</section>';
      $('#spatialReport').insertAdjacentHTML('afterbegin',cards);
    }
  }
  // Smooth playback: between hourly reloads the map (business) and every figure on the report follow the clock t.
  function tick(t){
    const ctx=getContext();if(!live||!(ctx.role==='business'||ctx.role==='manager'&&tab==='overview'))return;
    if(ctx.role==='business'){if(storeFocus.active)storeFocus.tick(t);else post({action:'analysis-time',t});}
    const series=live.series,v=(x,k)=>valueAt(x?.[k],t,valueMode);
    for(const el of document.querySelectorAll('[data-live-clock]'))el.textContent=clockText(t);
    for(const el of document.querySelectorAll('[data-live-clock-range]'))el.textContent=rangeText(t);
    for(const el of document.querySelectorAll('[data-live-kpi]')){const k=el.dataset.liveKpi;el.textContent=int(k==='passages'?seriesAt(live.totals.passages,t):valueAt(live.totals[k],t,valueMode));}
    for(const el of document.querySelectorAll('[data-live-cell]'))el.textContent=int(v(series[+el.dataset.row],el.dataset.liveCell));
    for(const el of document.querySelectorAll('[data-live-card]'))el.textContent=withUnit(v(series[+el.dataset.row],el.dataset.liveCard),el.dataset.unit||'');
    for(const el of document.querySelectorAll('[data-live-usage]'))el.textContent=withUnit(v(series[+el.dataset.liveUsage],'usage'),el.dataset.unit||'');
    for(const el of document.querySelectorAll('[data-live-flow]')){const x=series[+el.dataset.liveFlow];if(x?.offRoute)continue;const f=seriesAt(x?.flow,t);el.textContent=f===null?'미확보':int(f);}
  }
  function focusStore(id){const ctx=getContext();if(ctx.role!=='business')return;const f=ctx.catalog.facilities.find(f=>f.id===id);if(!f)return;if(storeFocus.id===id)return;if(!storeFocus.open(f))notify('이 매장은 지도 좌표가 없어 포커스할 수 없습니다.');}
  return {refresh,tick,focusStore,get storeFocused(){return storeFocus.active},get zone(){return zone},get tab(){return tab},get frontHeading(){return zoneHeading},
    // Map 정면 / ⌂ 전체 while one store is in focus: its storefront again / back to the whole zone.
    front(){if(storeFocus.active)storeFocus.front();else post({action:'camera',command:'view',heading:zoneHeading});},leaveStore:()=>storeFocus.close({silent:true}),managerPick:id=>tab==='overview'?feed.pick(id):managerUI.pick(id),feedMarkers:()=>feed.markers(),pauseFeed:()=>feed.pause(),managerGround:p=>managerUI.ground(p),managerRedraw:()=>managerUI.redraw(),saveView(key,view){try{localStorage.setItem('station:zone-view:'+key,JSON.stringify(view));notify('현재 시점을 이 기기에 저장했습니다.')}catch{notify('이 브라우저에서 시점을 저장할 수 없습니다.')}}};
}

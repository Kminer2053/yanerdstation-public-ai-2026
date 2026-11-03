import { escapeHtml as esc, locationPoint, makeFocus, pointUrl, mentionedNodes, filterDestinations, REVIEW_FLOORS, initialReviewTab } from './route-review-core.js';
import {preserveScene} from './local-scene-mode.js';

const $ = s => document.querySelector(s);
const frame = $('#stationMap');
let data, register, matching, nodes, locators, groups;
let tab = 'routes', selected = null, ready = false, requestId = 0, pending = null, timeout, readinessTimeout;
let destinationData=null, destinationError='', destinations=new Map();
const searches={routes:'',destinations:''};
const familyModes = {RAIL:['RAIL'],METRO:['M1','M4'],AREX:['AREX','AREXX'],GYEONGUI:['GYEONGUI'],GTX:['GTX'],BUS:['BUSE','BUSW'],TAXI:['TAXIE','TAXIW'],PARK:['PARK'],WALK:['WALKE','WALKW']};
const families = {RAIL:'철도',METRO:'지하철 1·4호선',AREX:'공항철도',GYEONGUI:'경의선',GTX:'GTX-A',BUS:'버스',TAXI:'택시',PARK:'주차',WALK:'도보'};
const category = mode => /버스|BUS/.test(mode) ? 'BUS' : /택시|TAXI/.test(mode) ? 'TAXI' : /주차|PARK/.test(mode) ? 'PARK' : /경의|GYEONGUI/.test(mode) ? 'GYEONGUI' : /GTX/.test(mode) ? 'GTX' : /공항|AREX/.test(mode) ? 'AREX' : /지하철|METRO/.test(mode) ? 'METRO' : /철도|RAIL/.test(mode) ? 'RAIL' : 'WALK';
const modeLabel = key => matching.modes[key]?.label || key;
const modeFits = key => !$('#mode').value || (familyModes[$('#mode').value] || []).includes(key);
const searchFits = row => !$('#search').value.trim() || JSON.stringify(row).toLowerCase().includes($('#search').value.trim().toLowerCase());

function pointButton(id, text) {
  const point = nodes.get(id) || locators.get(id) || destinations.get(id);
  if (!point) return `<span class="missing">${esc(text || id)} · 위치 미지정</span>`;
  const available = makeFocus(point);
  return `<button class="point ${selected?.review_id === id ? 'active' : ''}" data-point="${esc(id)}" ${available ? '' : 'disabled'}><span>${esc(text || point.label)}</span><small>${esc(id)} · ${esc(point.floor || '층 미확인')}</small></button>`;
}

function groupContent(id) {
  const group = groups.get(id);
  if (!group) return '<p class="missing">접속점 미지정</p>';
  return `<strong>${esc(group.label)}</strong><div class="point-list">${group.candidate_node_ids.map(id=>pointButton(id)).join('') || '<span class="missing">진입 문턱 후보 미지정</span>'}</div>
    <p class="check">${esc(group.check)}</p><details class="secondary"><summary>발생장소·대표위치 참고</summary><div class="point-list">${group.source_locator_ids.map(id=>pointButton(id)).join('')}</div></details>`;
}

function externalFor(mode, family) {
  if (!['BUSE','BUSW','TAXIE','TAXIW','PARK'].includes(mode)) return '';
  const wanted = category(mode.startsWith('BUS') ? 'BUS' : mode.startsWith('TAXI') ? 'TAXI' : 'PARK');
  const sideGroup = {BUSE:'GW-KTX-E',BUSW:'GW-KTX-W',TAXIE:'GW-KTX-E',TAXIW:'GW-KTX-W'}[mode];
  const list = matching.external_location_matching.filter(x=>x.route_families.includes(family) && category(x.mode)===wanted && (!sideGroup||x.candidate_building_groups.includes(sideGroup)));
  return `<details class="secondary"><summary>개별 ${wanted==='BUS'?'정류장':wanted==='TAXI'?'승하차 장소':'주차장'} 선택·위치 참고 (${list.length})</summary><div class="point-list">${list.map(x=>pointButton(x.locator_id,x.label)).join('')}</div><p class="check">승하차 보도점과 역사 진입 문턱은 별도 확인이 필요합니다.</p></details>`;
}

function renderRoutes() {
  const rows = matching.directional_route_reviews.filter(r=>(modeFits(r.origin_mode)||modeFits(r.destination_mode))&&searchFits({...r,origin:modeLabel(r.origin_mode),destination:modeLabel(r.destination_mode),entry:groups.get(r.entry_group),exit:groups.get(r.exit_group)}));
  $('#counts').textContent = `${rows.length} / 44 경로`;
  return `<p class="list-help">경로를 펼친 뒤 진입·진출 후보의 <b>지점 이름</b>을 누르세요.</p>${rows.map(r=>{
    const source = register.route_review_chains.find(x=>x.id===r.family);
    const refs = new Set(mentionedNodes(r.review_steps.join(' '),register.priority_nodes).map(x=>x.review_id));
    const edges = register.candidate_edges.filter(x=>source.dependencies.includes(x.review_edge_id));
    return `<details class="route" data-route="${esc(r.id)}"><summary><span class="route-id">${esc(r.id)}</span><strong>${esc(modeLabel(r.origin_mode))}<span class="arrow">→</span>${esc(modeLabel(r.destination_mode))}</strong><span class="unverified">미검토</span></summary>
      <div class="route-body"><div class="od"><div><small>출발 모드 · 하차(off)</small><b>${esc(modeLabel(r.origin_mode))}</b><p>${esc(matching.modes[r.origin_mode].endpoint)}</p>${externalFor(r.origin_mode,r.family)}</div><div><small>도착 모드 · 승차(on)</small><b>${esc(modeLabel(r.destination_mode))}</b><p>${esc(matching.modes[r.destination_mode].endpoint)}</p>${externalFor(r.destination_mode,r.family)}</div></div>
      <section class="stage"><h3>01 <span>진입 접속점 후보</span></h3>${groupContent(r.entry_group)}</section>
      <section class="stage"><h3>02 <span>중간 경로 확인</span></h3><ol>${r.review_steps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol><div class="point-list">${[...refs].map(id=>pointButton(id)).join('')}</div>
      <details class="secondary"><summary>관련 시나리오의 조사목록 · 대안 포함 (${edges.length})</summary><p class="check">원본 시나리오 전체의 조사 후보입니다. 이 방향 경로의 필수 경유점이 아니며, 버스→지하철 등에는 철도 승강장 후보가 적용되지 않을 수 있습니다. 실제 경유 순서는 위의 확인 항목을 기준으로 검토하세요.</p>${edges.map(e=>`<div class="edge"><b>${esc(e.review_edge_id)}</b><div class="point-list">${pointButton(e.from)}${pointButton(e.to)}</div><p>${esc(e.missing_points.join(' / '))}</p><small>${esc(e.notes)}</small></div>`).join('')}</details></section>
      <section class="stage"><h3>03 <span>진출 접속점 후보</span></h3>${groupContent(r.exit_group)}</section><p class="check">${esc(r.required_checks)}</p>
      <details class="secondary"><summary>연결할 유동인구 데이터 기준</summary><div data-data-modes="${esc(r.origin_mode)},${esc(r.destination_mode)}">일자·시간대 자료는 별도 기준표로 확인합니다. 아직 경로별 인원을 배분하지 않았습니다.</div></details></div></details>`;
  }).join('') || '<p>검색 결과가 없습니다.</p>'}`;
}

function renderLocations() {
  const rows = register.locator_register.filter(x=>(!$('#mode').value||category(x.mode_family)===$('#mode').value)&&searchFits(x));
  $('#counts').textContent = `${rows.length} / 100 장소`;
  return `<p class="list-help">원본 장소 목록입니다. 통계 발생단위·시설 중심·대표점은 실제 보행 진입점과 다릅니다.</p><div class="table-wrap"><table><thead><tr><th>발생장소 / 원본 모드</th><th>역사 진입점 후보</th></tr></thead><tbody>${rows.map(row=>{
    const ext=matching.external_location_matching.find(x=>x.locator_id===row.locator_id);
    const gs=ext?.candidate_building_groups || matching.gateway_groups.filter(g=>g.source_locator_ids.includes(row.locator_id)).map(g=>g.id);
    return `<tr><td>${pointButton(row.locator_id)}<p>${esc(row.mode)}</p><small>${esc(row.source_poi_basis || row.kind)}</small><div data-locator-series="${esc(row.locator_id)}"></div><details class="secondary"><summary>출처·확인사항</summary><p>${esc(row.notes.join(' / '))}</p><small>${esc(row.native_source_ids.join(', '))} · 원본 ${row.source_data_row}행</small></details></td><td>${gs.map(id=>groupContent(id)).join('<hr>')||'<span class="missing">진입점 미매칭</span>'}${ext?.nearby_osm_locator_ids?.length ? `<details class="secondary"><summary>주변 지상입구 참고 (${ext.nearby_osm_locator_ids.length})</summary><p class="check">250m 근접 목록이며 실제 통행 연결은 미확인입니다.</p><div class="point-list">${ext.nearby_osm_locator_ids.map(id=>pointButton(id)).join('')}</div></details>`:''}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function renderNodes() {
  const relevant=new Set();
  for(const r of matching.directional_route_reviews.filter(r=>modeFits(r.origin_mode)||modeFits(r.destination_mode))) {
    for(const g of [r.entry_group,r.exit_group]) for(const id of groups.get(g).candidate_node_ids)relevant.add(id);
    for(const n of mentionedNodes(r.review_steps.join(' '),register.priority_nodes))relevant.add(n.review_id);
    const source=register.route_review_chains.find(x=>x.id===r.family);
    for(const e of register.candidate_edges.filter(x=>source.dependencies.includes(x.review_edge_id))){relevant.add(e.from);relevant.add(e.to);}
  }
  const rows = register.priority_nodes.filter(n=>searchFits(n)&&(!$('#mode').value||relevant.has(n.review_id)));
  $('#counts').textContent = `${rows.length} / 59 시설`;
  return `<p class="list-help">정확한 문턱, 계단·에스컬레이터 위아래 랜딩은 아직 미확정입니다.</p><div class="table-wrap"><table><thead><tr><th>후보 지점</th><th>위치 기준 / 필수 확인</th></tr></thead><tbody>${rows.map(n=>`<tr><td>${pointButton(n.review_id)}<small>${esc(n.source_ids.join(', '))}</small></td><td><p>${esc(n.source_basis)}</p><p class="check">${esc(n.required_check)}</p></td></tr>`).join('')}</tbody></table></div>`;
}

function renderDestinations() {
  if(!destinationData){$('#counts').textContent='자료 연결 필요';return `<p class="check">매장·주요시설 자료를 열지 못했습니다. ${esc(destinationError)}</p><button id="retryDestinations">목록 다시 불러오기</button>`;}
  const rows=filterDestinations(destinationData.items,{query:$('#search').value,category:$('#destinationCategory').value,
    floor:$('#destinationFloor').value,kind:$('#destinationKind').value});
  $('#counts').textContent=`${rows.length} / ${destinationData.items.length} 장소`;
  return `<p class="list-help">매장명 또는 위치 확인 버튼을 누르면 왼쪽 3D 지도가 이동합니다. 같은 매장의 파사드는 묶었으며, 다른 층의 지점은 구분했습니다. <b>목록은 9월 15일까지 저장된 카탈로그 내역과 원본 시설 POI 기준</b>입니다.</p><div class="destination-list">${rows.map(d=>`<article class="destination-card" data-destination="${esc(d.id)}">
    <div class="destination-meta"><span>${esc(d.category)}</span><span>${esc(d.floor||'층 미등록')}</span><small>${esc(d.status)}</small></div>
    <h3>${d.primary_id?`<button data-point="${esc(d.primary_id)}">${esc(d.label)}</button>`:esc(d.label)}</h3>
    <div class="destination-id">${esc(d.points.flatMap(p=>p.source_ids).filter((v,i,a)=>a.indexOf(v)===i).join(' · ')||d.id)}</div>
    <p class="check">${esc(d.notes)}</p>
    ${d.primary_id?pointButton(d.primary_id,'지도에서 위치 확인 →'):'<span class="missing">좌표 확인 후 지도 연결 가능</span>'}
    ${d.points.length>1?`<details class="secondary"><summary>연결된 파사드 ${d.points.length}개 · 면별 위치 보기</summary><div class="point-list">${d.points.map(p=>pointButton(p.review_id)).join('')}</div><p class="check">면별 버튼은 파사드 위치이며 출입구를 의미하지 않습니다.</p></details>`:''}
    <details class="secondary"><summary>위치 출처</summary><p>${esc(d.basis==='catalog'?'저장된 카탈로그 개체·파사드 메타데이터':d.basis==='source_poi'?'VWorld 원본 시설 POI · 현재 존치 여부 미검수':'좌표 미확보')}</p><small>${[...new Set(d.points.map(p=>p.source_basis))].map(esc).join('<br>')}</small></details>
  </article>`).join('')||'<p>검색 결과가 없습니다. 이름·분류·층 조건을 확인하세요.</p>'}</div>`;
}

function render() {
  $('#content').innerHTML = tab==='destinations'?renderDestinations():tab==='routes' ? renderRoutes() : tab==='locations' ? renderLocations() : renderNodes();
  $('#content').scrollTop=0;
  decorateData();
}

function selectPoint(id) {
  const point=nodes.get(id)||locators.get(id)||destinations.get(id), focus=makeFocus(point);
  if(!focus) return;
  selected=point;
  document.querySelectorAll('[data-point]').forEach(b=>b.classList.toggle('active',b.dataset.point===id));
  $('#selection').innerHTML=`<small>${esc(id)} · ${esc(point.floor||'층 미확인')} · ${point.destination?'방문 목적지 위치 참고':'위치 미확정'}</small><h2>${esc(point.label)}</h2><p>${esc(point.required_check)}</p><div class="coordinate">${point.lon.toFixed(8)}, ${point.lat.toFixed(8)}<br>${focus.referenceOnly?'층·높이 미확인: 2F 주변 참고 화면 (보행점 아님)':`표시 높이 ${focus.height.toFixed(2)}m · 실제 문턱 높이는 별도 검수`}</div><button id="refocus">선택 위치로 다시 이동</button>`;
  $('#refocus').addEventListener('click',()=>sendFocus(focus));
  $('#mapLink').href=preserveScene(pointUrl(point,location.origin));
  const url=new URL(location.href);url.hash=id;history.replaceState(null,'',url);
  sendFocus(focus);
}

function sendFocus(focus) {
  pending=focus;
  if(!ready) { $('#mapStatus').textContent='3D 지도 준비 중 · 선택 위치 대기'; return; }
  requestId++;
  frame.contentWindow.postMessage({type:focus.catalog?'station-one:catalog-focus':'station-one:route-review-focus',requestId,focus},location.origin);
  $('#mapStatus').textContent=`${focus.floor} · 위치 이동 요청 중`;
  clearTimeout(timeout);
  timeout=setTimeout(()=>{ $('#mapStatus').textContent='지도 응답 지연 · 선택 위치로 다시 이동을 눌러주세요'; },15000);
}

window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame.contentWindow) return;
  if(event.data?.type==='station-one:catalog-map-ready'&&event.data.vworldReady) {
    clearTimeout(readinessTimeout);ready=true;$('#mapStatus').textContent='3D 지도 연결됨'; if(pending)sendFocus(pending);
  }
  if(event.data?.type==='station-one:route-review-applied'&&event.data.requestId===requestId) {
    clearTimeout(timeout);$('#mapStatus').textContent=event.data.ok ? `${event.data.floor} · 선택 위치 반영` : '위치 이동 불가 · 좌표·층을 확인하세요';
  }
  if(event.data?.type==='station-one:catalog-focus-applied'&&pending?.catalog&&event.data.requestId===requestId){
    clearTimeout(timeout);$('#mapStatus').textContent=`${event.data.floor} · 선택 시설 위치 반영`;
  }
});

function activateTab(value) {
  if(!['routes','locations','nodes','destinations'].includes(value))return;
  const wasDest=tab==='destinations',isDest=value==='destinations';
  if(wasDest!==isDest){searches[wasDest?'destinations':'routes']=$('#search').value;$('#search').value=searches[isDest?'destinations':'routes'];}
  tab=value;
  $('#tabs').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.tab===tab)));
  $('#modeFilter').hidden=isDest;$('#destinationFilters').hidden=!isDest;
  $('#search').placeholder=isDest?'매장·시설명, 파사드 ID, 시설 ID':'노드 ID, 출입구, 교통수단';
  $('#listTitle').textContent=isDest?'방문할 매장과 역내 주요시설':'발생장소에서 역사 진입점까지';
  $('#listNotice').textContent=isDest?'시설 위치와 실제 보행 출입구는 다릅니다. 먼저 지도에서 위치를 확인한 뒤 경로 접속점을 정합니다.':'후보 위치를 확인하는 단계입니다. 출입구 후보들은 대안이며, 아직 연결된 보행경로가 아닙니다.';
  const u=new URL(location.href);u.searchParams.set('view',tab);history.replaceState(null,'',u);
  render();
}

async function loadDestinations() {
  try {
    const response=await fetch('/data/route-review/destinations.json');if(!response.ok)throw Error(`응답 ${response.status}`);
    const d=await response.json();if(!Array.isArray(d.items)||d.site!=='S202103')throw Error('서울역 자료 형식 불일치');
    destinationData=d;destinations=new Map(d.items.flatMap(item=>item.points.map(p=>[p.review_id,p])));
    $('#destinationCount').textContent=d.items.length;
    $('#destinationCategory').innerHTML='<option value="">분류 전체</option>'+[...new Set(d.items.map(x=>x.category))].sort().map(c=>`<option>${esc(c)}</option>`).join('');
    $('#destinationFloor').innerHTML='<option value="">층 전체</option>'+['2F',...REVIEW_FLOORS.filter(f=>f!=='2F')].filter(f=>d.items.some(x=>x.floor===f)).map(f=>`<option>${esc(f)}</option>`).join('');
  }catch(e){destinationError=e.message;$('#destinationCount').textContent='!';}
}

function loadMap() {
  ready=false;requestId++;clearTimeout(timeout);clearTimeout(readinessTimeout);
  $('#mapStatus').textContent='3D 지도를 준비하고 있습니다';
  frame.src=preserveScene('/app/?site=S202103&embed=catalog&floor=2F');
  readinessTimeout=setTimeout(()=>{
    if(!ready)$('#mapStatus').textContent='지도 연결 지연 · 지도 재연결을 눌러주세요';
  },30000);
}

let sourceSummary=null;
function decorateData() {
  if(!sourceSummary) return;
  document.querySelectorAll('[data-locator-series]').forEach(el=>{
    const ext=matching.external_location_matching.find(x=>x.locator_id===el.dataset.locatorSeries);
    if(!ext?.source_stop_id) return;
    const entries=sourceSummary.series.filter(x=>x.location_id===`BUS-ARS-${ext.source_stop_id}`);
    el.innerHTML=`<div class="data-note"><small>7월 기준 ARS ${esc(ext.source_stop_id)}</small><p>${entries.length?entries.map(s=>`${esc(s.id)} · ${s.value_class==='ESTIMATED'?'일자별 추정':s.value_class==='SUBSTITUTED'?'전년 자료':'산출값'}<br><small>원천 ${esc(s.source_period)} · ${esc(s.first_date)} ~ ${esc(s.last_date)}</small>`).join('<br>'):'일자·시간대 계열 없음 (0명 아님)'}</p></div>`;
  });
  document.querySelectorAll('[data-data-modes]').forEach(el=>{
    el.innerHTML=[...new Set(el.dataset.dataModes.split(','))].map(mode=>{
      const profile=sourceSummary.modes[mode];
      return `<div class="data-note"><b>${esc(modeLabel(mode))}</b><p>${esc(profile?.summary||'일자·시간대 값 미확보')}</p>${profile?.series?.length?`<small>${profile.series.map(esc).join(', ')}</small>`:''}</div>`;
    }).join('');
  });
}

if(new URL(location.href).searchParams.get('view')==='points') {
  if(new URL(location.href).searchParams.get('scene')==='local'||new URL(location.href).searchParams.get('workbench')==='1'){
    const {startLocationWorkbench}=await import('./location-workbench.js');await startLocationWorkbench();
  }else{const { startPointReview }=await import('./point-review.js');await startPointReview();}
} else try {
  const response=await fetch('/data/route-review/register.json');
  if(!response.ok)throw new Error(`자료 응답 ${response.status}`);
  data=await response.json();({register,matching}=data);
  nodes=new Map(register.priority_nodes.map(n=>[n.review_id,n]));
  locators=new Map(register.locator_register.map(r=>[r.locator_id,locationPoint(r)]));
  groups=new Map(matching.gateway_groups.map(g=>[g.id,g]));
  await loadDestinations();
  $('#mode').innerHTML+='<option disabled>────────</option>'+Object.entries(families).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
  $('#tabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)activateTab(b.dataset.tab);});
  $('#search').addEventListener('input',render);$('#mode').addEventListener('change',render);
  for(const id of ['#destinationKind','#destinationCategory','#destinationFloor'])$(id).addEventListener('change',render);
  $('#content').addEventListener('click',async e=>{const b=e.target.closest('[data-point]');if(b)selectPoint(b.dataset.point);else if(e.target.closest('#retryDestinations')){await loadDestinations();render();}});
  $('#sourceButton').addEventListener('click',()=>$('#sources').showModal());
  $('#reloadMap').addEventListener('click',loadMap);
  loadMap();
  const initial=decodeURIComponent(location.hash.slice(1));
  activateTab(initialReviewTab(new URL(location.href).searchParams.get('view'),destinations.has(initial)));
  selectPoint(nodes.has(initial)||locators.has(initial)||destinations.has(initial)?initial:tab==='destinations'?destinationData?.items.find(d=>d.primary_id)?.primary_id:'G1');
  fetch('/data/route-review/current-data.json').then(r=>r.ok?r.json():null).then(d=>{sourceSummary=d;decorateData();}).catch(()=>{});
} catch(error) {$('#content').textContent=`검토표를 열지 못했습니다. ${error.message}`;}

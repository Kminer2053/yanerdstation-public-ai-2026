import {esc,int} from './experience-core.js';
import {mountConfirmedDetails} from './confirmed-details.js';
import {mountFacilityPanel} from './manager-facility-panel.js';
import {mountRouteEditor} from './manager-route-editor.js';
import {indexPoints,approvedIndex,facadeInfo,connectionPreview,dataFlowValues,walkGraphIndex} from './manager-core.js';
import {dataDiagramSVG,DIAGRAM_TYPES} from './manager-data-diagram.js';
import {maskSales} from './data-quality.js';

// Facilities and routes tabs edit beside the live map; the data tab explains how the applied values relate.
export function createConfirmedManager({getContext,notify,post}){
 const $=s=>document.querySelector(s);let unlocked=false,register=null,revision=0,overrides={},tab='overview',kind='facilities',selected=null,dirty=false,loading=false,points=[],index=null,approved=new Map(),extra=null,previewRequest=0,diagramVersion=0;
 const flows=new Map(),salesByDate=new Map();let walkPromise=null;
 // Reviewed walking graph for map-drawn routes (snapping, wall checks, detours); loaded on first use.
 const walkGraph=()=>walkPromise??=fetch('/data/experience/walk-graph.json').then(r=>{if(!r.ok)throw Error('보행 격자 연결 실패');return r.json();}).then(walkGraphIndex).catch(e=>{walkPromise=null;throw e;});
 const api=async(path,options={})=>{const r=await fetch('/api/demo/'+path,{...options,cache:'no-store'}),v=await r.json();if(!r.ok)throw Error(v.error||'시연 저장소 연결 실패');return v;};
 document.body.insertAdjacentHTML('beforeend','<dialog id="demoLogin"><span class="eyebrow">JURY DEMONSTRATION</span><h2>운영관리 의사결정 지원</h2><p>철도기관 담당자를 위한 관리 화면입니다.</p><div class="demo-password">시연 비밀번호 <b>station2026</b></div><p class="muted">비밀번호 입력 UX를 보여주는 공개 프로토타입입니다.<br>실제 보안 장치가 아니며, 가공 영업정보를 사용합니다.</p><form id="demoLoginForm"><label>비밀번호<input id="demoPassword" type="password" required autocomplete="off"></label><button class="primary">시연 시작</button><button type="button" id="demoCancel">길안내로 돌아가기</button><p id="demoLoginStatus" role="status"></p></form></dialog>');
 const close=()=>{$('#demoLogin').close();document.querySelector('[data-role=visitor]').click();};$('#demoCancel').onclick=close;$('#demoLogin').oncancel=e=>{e.preventDefault();close();};
 $('#demoLoginForm').onsubmit=async e=>{e.preventDefault();try{await api('login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('#demoPassword').value})});unlocked=true;document.body.dataset.demoLocked='false';$('#demoLogin').close();await load();render();}catch(err){$('#demoLoginStatus').textContent=err.message;}};
 async function load(){if(register)return;const [r,d,p,a]=await Promise.all([api('register'),api('records'),api('points'),fetch('/data/jury-frozen/approved-facades.json').then(r=>r.ok?r.json():null).catch(()=>null)]);register=r;points=p;index=indexPoints(p);approved=approvedIndex(a?.replacements);overrides=d.overrides;revision=d.revision;}
 function stash(){if(!selected||!$('#confirmedForm'))return;const values={...extra?.read()};for(const i of document.querySelectorAll('#confirmedForm [data-field]'))values[i.dataset.field]=i.value;overrides[kind+':'+selected.id]=values;}
 function fieldsFor(){return kind==='facilities'?[['name','시설명'],['hours','영업시간'],['contact','연락처'],['notes','방문·운영 안내']]:kind==='origins'?[['name','원점명'],['effective_date','적용 기준일'],['methodology','집계·추정 기준'],['review','검토 내용']]:[['name','등록명'],['notes','운영·통행 유의사항'],['review','연결·통행 검토 내용']];}

 // Map beside the editor. Scene messages go through the embedded 3D page only.
 const sceneWindow=()=>getContext().sceneReady?$('#scene')?.contentWindow:null;
 const setTitle=text=>{const el=$('#mapTitle');if(el)el.textContent=text;};
 const scene={
  focusFacade(f){const p=f?.reference;if(!p||!Number.isFinite(p.lon))return;post({action:'clear-route'});setTitle(f.floor+' · '+f.name+' 정면');
   sceneWindow()?.postMessage({type:'station-one:catalog-focus',requestId:Date.now(),focus:{floor:f.floor,longitude:p.lon,latitude:p.lat,height:p.height,label:f.name,imageId:f.source_id,...(p.focus||{}),sourceKind:p.focus?.sourceKind||'catalog'}},location.origin);},
  overlay(data){post({action:'manager-overlay',...data});},
  previewFacade(slotAlias,imageUrl){sceneWindow()?.postMessage({type:'station-one:facade-demo-preview',requestId:++previewRequest,slotAlias,imageUrl},location.origin);},
  route(route,fit=true){post({action:'route',fit,route});if(route.route_id==='demo-preview')setTitle('경로 · '+(selected?.name||''));},
  focusMark(id){post({action:'manager-overlay-focus',id});},
 };
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==$('#scene')?.contentWindow||e.data?.type!=='station-one:facade-demo-preview-applied'||e.data.requestId!==previewRequest)return;extra?.previewApplied?.(e.data);});
 function previewConnection(c){
  const v=connectionPreview(c,index.byId);if(v.error){notify(v.error);return;}
  post({action:'route',route:{route_id:'demo-connection',coordinates:v.coordinates,floors:v.floors}});
  scene.overlay({marks:v.ends.map((p,i)=>({id:'end:'+i,kind:'anchor',point:p.slice(2,5),label:(i?'B':'A')+' · '+p[1]}))});setTitle('층간연결 · '+c.name);
 }
 function previewEndpoint(e){
  const g=e.geometry,a=index.byId.get(e.access_id),lines=[],marks=[];
  if(g?.type==='Polygon')lines.push({coordinates:g.coordinates[0],color:'#43dc83',width:3});else if(g?.type==='Point')marks.push({id:'area',kind:'anchor',point:g.coordinates,label:e.name});
  if(a)marks.push({id:'access',kind:'access',point:a.slice(2,5),label:'보행 접속점'});
  post({action:'clear-route'});scene.overlay({floors:[e.floor],lines,marks,fit:true});setTitle('출도착점 · '+e.floor+' · '+e.name);
 }
 function leave(){extra?.destroy?.();extra=null;post({action:'manager-overlay-clear'});sceneWindow()?.postMessage({type:'station-one:catalog-focus-clear'},location.origin);}

 function heading(title,text){return '<div class="confirmed-heading"><div><span class="eyebrow">CONFIRMED REGISTER / DEMO COPY</span><h2>'+title+'</h2><p>'+text+'</p></div><button id="exportDemo">편집본 내보내기</button></div>';}
 function bindHeading(){$('#exportDemo').onclick=()=>{stash();const url=URL.createObjectURL(new Blob([JSON.stringify({basis:'demo-copy',revision,overrides},null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='station-one-demo-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};}
 function workspace(kinds,empty){return '<div class="confirmed-workspace"><aside><label>관리 구분<select id="registerKind">'+kinds.map(([k,n])=>'<option value="'+k+'">'+n+'</option>').join('')+'</select></label><input id="registerSearch" type="search" aria-label="등록부 검색" placeholder="이름 또는 ID 검색"><div id="confirmedList"></div></aside><section id="confirmedDetail"><h3>확정 등록부에서 대상을 선택하세요.</h3><p>'+empty+'</p></section></div>';}
 function bindWorkspace(rerender){
  $('#registerKind').value=kind;$('#registerKind').onchange=e=>{stash();leave();kind=e.target.value;selected=null;rerender();};$('#registerSearch').oninput=renderList;
  $('#confirmedList').onclick=e=>{const b=e.target.closest('[data-record]');if(!b)return;stash();selected=register[kind].find(r=>r.id===b.dataset.record);renderDetail();};renderList();
  selected=register[kind].find(r=>r.id===selected?.id)||(kind==='origins'?null:register[kind][0]||null);if(selected)renderDetail();
 }
 function render(){
  if(tab==='overview'||!unlocked||!register)return;
  if(tab==='data'){renderDataDashboard();return;}
  const kinds=tab==='facilities'?[['facilities','시설·파사드']]:[['routes','등록 경로'],['connections','층간연결'],['endpoints','출도착점']];
  if(!kinds.some(([k])=>k===kind))kind=kinds[0][0];
  $('#managementEditor').innerHTML=heading(tab==='facilities'?'시설 정보·파사드 관리':'확정 경로·연결 관리',tab==='facilities'?'시설을 고르면 오른쪽 지도가 정면을 보여줍니다. 파사드 이미지와 보행 출입점을 이 화면에서 확인·수정합니다. 확정 원본은 바뀌지 않습니다.':'경로를 고르면 오른쪽 지도에 경로와 순번 포인트를 그립니다. 순서를 바꾸면 지도가 바로 갱신됩니다. 확정 원본은 바뀌지 않습니다.')+workspace(kinds,'신규 시설·경로의 구축은 별도의 공개 편집기에서 진행합니다.');
  bindHeading();bindWorkspace(render);
 }
 function tags(r){
  if(kind==='facilities'){const f=getContext().catalog.facilities.find(f=>f.id===r.id)||r,o=overrides['facilities:'+r.id]||{},info=facadeInfo(f,approved),access=o.access_id??r.access_id;
   return '<span class="tag" data-kind="'+info.kind+'">'+({approved:'승인 정면',model:'전용 모델',unapproved:'정면 미승인',none:'사진 없음'})[info.kind]+'</span><span class="tag" data-kind="'+(access?'approved':'none')+'">'+(access?'출입점':'출입점 없음')+'</span>'+(o.facade_url?'<span class="tag" data-kind="demo">교체본</span>':'');}
  if(kind==='routes')return '<span class="tag">'+(overrides['routes:'+r.id]?.steps||r.steps||[]).length+'단계</span>';
  if(kind==='connections')return '<span class="tag">'+esc(({stairs:'계단',escalator:'에스컬레이터',elevator:'엘리베이터'})[r.kind]||r.kind||'연결')+'</span>';
  return '';
 }
 function renderList(){const q=$('#registerSearch').value.trim().toLowerCase();$('#confirmedList').innerHTML=(register[kind]||[]).filter(r=>((r.name||'')+' '+r.id).toLowerCase().includes(q)).map(r=>'<button data-record="'+esc(r.id)+'"'+(r.id===selected?.id?' aria-current="true"':'')+'><b>'+esc(overrides[kind+':'+r.id]?.name||r.name||r.id)+'</b><small>'+esc(r.floor||r.from_floor||'')+' · '+esc(r.id)+'</small>'+(kind==='origins'||kind==='endpoints'?'':'<span class="tags">'+tags(r)+'</span>')+'</button>').join('')||'<p>해당 등록 내역이 없습니다.</p>';}
 function renderDetail(){
  extra?.destroy?.();extra=null;
  const r=selected,o=overrides[kind+':'+r.id]||{},f=getContext().catalog.facilities.find(f=>f.id===r.id);
  for(const b of document.querySelectorAll('#confirmedList [data-record]')){if(b.dataset.record===r.id)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');}
  $('#confirmedDetail').innerHTML='<div class="detail-head"><h3>'+esc(o.name||r.name||r.id)+'</h3><p class="data-tag">'+esc([r.floor,r.category,r.id].filter(Boolean).join(' · '))+' · 확정 등록 대상</p></div>'+(kind==='facilities'?'<div class="map-actions" id="facilityMapActions"></div>':'')+
   '<form id="confirmedForm">'+fieldsFor().map(([k,n])=>'<label>'+n+(k==='notes'||k==='review'||k==='methodology'?'<textarea rows="4" maxlength="5000" data-field="'+k+'">'+esc(o[k]??r[k]??'')+'</textarea>':'<input maxlength="5000" data-field="'+k+'" value="'+esc(o[k]??r[k]??'')+'">')+'</label>').join('')+'<div class="confirmed-save"><button class="primary">시연 편집본 저장</button><output id="confirmedStatus" role="status">원본 유지 · 서버 편집본 리비전 '+revision+'</output></div></form>'+
   '<details class="record-source"><summary>연결·위치 기준 정보</summary><pre>'+esc(JSON.stringify({floor:r.floor,from:r.from||r.from_endpoint,to:r.to||r.to_endpoint,access_id:r.access_id,origin_ids:r.origin_ids,path:r.steps||r.path,geometry:r.geometry},null,2))+'</pre></details>';
  const form=$('#confirmedForm');
  if(kind==='facilities')extra=mountFacilityPanel({record:r,override:o,facility:f,approved,index,form,actions:$('#facilityMapActions'),notify,scene});
  else if(kind==='routes')extra=mountRouteEditor({record:r,override:o,register,index,form,notify,scene,walk:walkGraph()});
  else extra=mountConfirmedDetails({kind,record:r,override:o,form});
  if(kind==='connections')previewConnection(r);else if(kind==='endpoints')previewEndpoint(r);
  form.oninput=()=>{dirty=true;$('#confirmedStatus').textContent='저장하지 않은 수정';};
  form.onsubmit=async e=>{e.preventDefault();stash();const b=form.querySelector('button.primary');b.disabled=true;try{const saved=await api('records',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,overrides})});revision=saved.revision;dirty=false;$('#confirmedStatus').textContent='서버에 시연 편집본 저장 · 리비전 '+revision;renderList();}catch(err){$('#confirmedStatus').textContent=err.message;}finally{b.disabled=false;}};
 }

 function renderDataDashboard(){
  const ctx=getContext(),fac=ctx.catalog?.facilities||[],ep=ctx.catalog?.endpoints||[];
  const sources=[
   {name:'수도권 지하철 승하차',type:'관측',coverage:'1·4호선·공항철도·경의선',unit:'일자×시간대별 승하차',origin:'서울교통공사 CardSubwayTime + 코레일 광역 OA-12913'},
   {name:'KTX·일반열차 승하차',type:'관측',coverage:'KTX·ITX·새마을',unit:'일자×시간대별 하차',origin:'코레일 역별 승하차 공개자료'},
   {name:'GTX-A 수서~서울역',type:'추정',coverage:'GTX-A',unit:'평일/주말 일별 추정',origin:'국토부 사전타당성 + 경의선 시간대 프로파일 대리'},
   {name:'시내·경기 버스 정류장 하차',type:'관측',coverage:'서울역 반경 정류장',unit:'일자×시간대별 하차',origin:'서울시·경기도 버스 승하차 API'},
   {name:'주차장 유입 인원',type:'추정',coverage:'역사 인접·건물 부설·소규모',unit:'규모×회전율×인원×역사비율',origin:'주차장 규모 + 시간대 프로파일'},
   {name:'매장별 가공 매출',type:'가공',coverage:'29개 승인 매장',unit:'일자×시간대별 결제건수·매출',origin:'매장별 제출 자료 가공'},
   {name:'시설 등록부',type:'확정',coverage:fac.length+'개 시설',unit:'이름·층·좌표·파사드·출입점',origin:'현행화 확정 등록부 rev.'+ctx.catalog?.revision},
   {name:'보행 네트워크',type:'확정',coverage:ep.length+'개 출도착 + '+(ctx.network?.routes?.length||0)+'경로',unit:'격자 보행점·층간연결·경로',origin:'현행화 격자 모델'},
  ];
  const models=[
   {name:'시간 확장 중력모형 (IPF/RAS)',input:'출도착점별 시간대 진입·이탈',output:'경로별 이동량',note:'동일인 복수 이동 포함'},
   {name:'구간 통과량',input:'경로별 이동량',output:'구간별 시간당 통과 건수',note:'유동 흐름 선 두께·색'},
   {name:'비환승 체류(ambient)',input:'관측 하차 − 모형 출발 합',output:'원점 주변 체류 보행자 · 3층 맞이방 순환',note:'KTX는 동60%:1호선25%:서15% 3방향 분산 · 2층 출도착점 몫 중 3층 보행면적 비율만큼은 3층 맞이방 순환 경로로 표시(합계 불변 · 심야 0~4시 제외)'},
   {name:'동시체류 추정',input:'구간 통과량·경로 이동량·비환승',output:'보행 중 + 출도착 대기 + 비환승 체류',note:'가까운 인원은 사람 모델(데스크톱 최대 600·모바일 160), 나머지는 점'},
   {name:'매출 시간 배분',input:'일별 매출 합계 + 시간대 구성비',output:'시간대별 추정 매출',note:'영업시간 외 실제 매출도 보존'},
   {name:'인근 통과',input:'매장 보행 출입점 + 보행 격자 + 구간 통과량',output:'매장 앞 통로 우선: 걸어서 15m 안 가장 붐비는 경로(없으면 30m 안 가장 가까운 경로)의 시간당 통과',note:'30m 안 경로 없으면 경로 밖 · 매장 입장객 아님'},
  ];
  const legend=Object.entries(DIAGRAM_TYPES).map(([k,[fill,stroke]])=>'<span><i style="background:'+fill+';border-color:'+stroke+'"></i>'+k+'</span>').join('');
  $('#managementEditor').innerHTML='<div class="confirmed-heading"><div><span class="eyebrow">DATA PIPELINE</span><h2>연계 데이터 관리</h2><p>유동인구·매출·시설 모델에 쓰인 자료가 어떤 순서로 결합되어 화면의 숫자가 되는지 확인합니다.</p></div></div><div class="data-dashboard">'+
   '<section class="data-relations"><div class="diagram-head"><div><h3>데이터 관계도 · 적용 값</h3><p>상자에 마우스를 올리면 산출 근거가 보입니다. 날짜·시간을 바꾸면 모든 값이 함께 다시 계산됩니다.</p></div><div class="diagram-controls"><label>기준일<input id="diagramDate" type="date" min="2026-07-01" max="2026-07-31" value="'+esc(ctx.date)+'"></label><label>시간<input id="diagramHour" type="range" min="0" max="23" value="'+ctx.hour+'"><b id="diagramHourLabel">'+ctx.hour+'시</b></label></div></div><div class="diagram-legend">'+legend+'</div><div class="diagram-scroll"><div id="dataDiagram"><p>관계도 계산 중…</p></div></div><div id="diagramSummary" class="diagram-summary"></div></section>'+
   '<section class="data-sources"><h3>데이터 출처 · '+sources.length+'개 계열</h3><table class="performance-table"><thead><tr><th>데이터 계열</th><th>유형</th><th>대상 범위</th><th>단위</th><th>출처·산출 근거</th></tr></thead><tbody>'+sources.map(s=>'<tr><td><b>'+esc(s.name)+'</b></td><td><span class="data-type-badge data-type-'+s.type+'">'+esc(s.type)+'</span></td><td>'+esc(s.coverage)+'</td><td>'+esc(s.unit)+'</td><td>'+esc(s.origin)+'</td></tr>').join('')+'</tbody></table></section>'+
   '<section class="data-models"><h3>모델 구성 · 데이터 조합 방식</h3><table class="performance-table"><thead><tr><th>모델</th><th>입력</th><th>출력</th><th>비고</th></tr></thead><tbody>'+models.map(m=>'<tr><td><b>'+esc(m.name)+'</b></td><td>'+esc(m.input)+'</td><td>'+esc(m.output)+'</td><td>'+esc(m.note)+'</td></tr>').join('')+'</tbody></table></section>'+
   '<section class="data-endpoints"><h3 id="endpointTableTitle">출도착점별 데이터 현황</h3><div id="endpointTable"></div></section>'+
   '<section class="data-detail-nav"><h3>항목별 상세 데이터 관리</h3><p>원점별 시간대 진입·이탈량은 아래에서, 시설 정보는 시설 탭에서 수정합니다.</p><div class="data-detail-buttons"><button id="dataGoOrigins">유동인구 원점 관리</button><button id="dataGoFacilities">시설 탭으로 이동</button></div></section></div>';
  $('#dataGoOrigins').onclick=()=>{stash();kind='origins';selected=null;renderDataItemView();};
  $('#dataGoFacilities').onclick=()=>document.querySelector('[data-management-tab=facilities]')?.click();
  $('#diagramDate').onchange=drawDiagram;$('#diagramHour').oninput=()=>{$('#diagramHourLabel').textContent=$('#diagramHour').value+'시';drawDiagram();};drawDiagram();
 }
 async function diagramValues(date,hour){
  const ctx=getContext();
  if(!flows.has(date))flows.set(date,fetch('/data/experience/flows/'+date+'.json').then(r=>{if(!r.ok)throw Error('구간 통과량 자료를 불러오지 못했습니다.');return r.json();}));
  if(!salesByDate.has(date))salesByDate.set(date,ctx.sales?.date===date?Promise.resolve(ctx.sales):api('sales?date='+date).then(v=>maskSales(v,ctx.usage,ctx.catalog.dates)).catch(()=>null));
  const [edges,sales]=await Promise.all([flows.get(date),salesByDate.get(date)]);
  return dataFlowValues({catalog:ctx.catalog,network:ctx.network,timeline:ctx.timeline,usage:ctx.usage,sales,register,overrides,approved,points,date,hour,edgeValues:edges?.[hour]||[]});
 }
 async function drawDiagram(){
  const version=++diagramVersion,date=$('#diagramDate').value,hour=+$('#diagramHour').value;
  try{
   if(!getContext().timeline?.[date])throw Error('2026년 7월 날짜를 선택하세요.');
   const v=await diagramValues(date,hour);if(version!==diagramVersion||!$('#dataDiagram'))return;
   $('#dataDiagram').innerHTML=dataDiagramSVG(v);
   $('#diagramSummary').innerHTML='<p><b>'+esc(date)+' '+hour+'시</b> · 출도착점 진입 <b>'+int(v.arrivals)+'건</b> → 경로 배분 <b>'+int(v.routeFlow)+'건</b> → 동시체류 <b>'+int(v.expected)+'명</b> (보행 중 '+int(v.walking)+' + 출도착 대기 '+int(v.dwell)+' + 비환승 '+int(v.ambient)+')</p><p class="muted">보행 중 = 구간 통과량 × 구간 길이 ÷ 1.25m/s ÷ 3600 · 대기 = 경로 이동량 × 출발·도착 체류시간 ÷ 3600 · 비환승 체류는 원점 관측 하차 중 모형 경로로 설명되지 않은 시간당 인원을 그대로 더한 값입니다(체류시간 환산 미적용).</p>';
   $('#endpointTableTitle').textContent='출도착점별 데이터 현황 · '+date+' '+hour+'시';
   $('#endpointTable').innerHTML='<table class="performance-table"><thead><tr><th>출도착점</th><th>모드</th><th>진입</th><th>이탈</th><th>체류시간</th><th>비환승</th></tr></thead><tbody>'+v.perEndpoint.map(e=>'<tr><td><b>'+esc(e.name)+'</b></td><td>'+esc(e.mode)+'</td><td>'+int(e.arrivals)+'건</td><td>'+int(e.departures)+'건</td><td>'+int(e.dwell)+'초</td><td>'+int(e.ambient)+'명</td></tr>').join('')+'</tbody></table>';
  }catch(e){if(version===diagramVersion&&$('#dataDiagram'))$('#dataDiagram').innerHTML='<p class="warn">'+esc(e.message)+'</p>';}
 }
 function renderDataItemView(){
  kind='origins';
  $('#managementEditor').innerHTML=heading('연계 데이터 관리 · 유동인구 원점','확정 등록된 원점의 시간대별 진입·이탈량을 시연 편집합니다. 확정 원본·유동 분석은 덮어쓰지 않습니다.').replace('<button id="exportDemo">','<button id="dataBack">← 관계도</button><button id="exportDemo">')+workspace([['origins','유동인구 원점']],'원점을 선택하면 시간대별 값을 확인하고 시연 편집할 수 있습니다.');
  bindHeading();$('#dataBack').onclick=()=>{stash();selected=null;renderDataDashboard();};bindWorkspace(renderDataItemView);
 }
 return {
  async show(next){stash();if(next!==tab)leave();tab=next;if(loading)return;loading=true;try{if(!unlocked){const s=await api('session');unlocked=s.demo;}document.body.dataset.demoLocked=String(!unlocked);if(!unlocked){if(getContext().role==='manager'&&!$('#demoLogin').open)$('#demoLogin').showModal();return;}await load();render();}catch(e){notify(e.message);}finally{loading=false;}},
  leave(){stash();leave();},
  // Open a record when its tab renders next (e.g. from an operations feed action).
  focusRecord(k,id){stash();kind=k;selected={id};},
  pick(id){if(typeof id==='string')extra?.pick?.(id);},
  ground(p){if(Array.isArray(p)&&p.length===3&&p.every(Number.isFinite))extra?.ground?.(p);},
  redraw(){if(['facilities','routes'].includes(tab)&&selected&&register&&unlocked){stash();renderDetail();}},
 };
}

import './location-workbench.css';
import {escapeHtml as esc,REVIEW_FLOORS,makeFocus} from './route-review-core.js';
import {mapFeature,POINT_LAYERS,CONNECTOR_ROLES} from './point-review-core.js';
import {seedWorkbench,workbenchPoints,validateWorkbench,validateObservation,observationKey,endpointArea,connectionStops,connectionPairs,connectionPath,connectionPointRoles,connectionCode,routeConnectionMarkers,mergeFacilitySeeds} from './location-workbench-core.js';
import {routeSteps,routeStepsVia,routeStepPoints,routeInsertionPoint,routeSequenceIssues,updateRouteRecord} from './location-workbench-core.js';
import {renderRouteEditor} from './route-sequence-view.js';

const TABS={grid:'격자·이동점',connections:'층간 연결',origins:'원점 데이터',endpoints:'출발·도착',routes:'경로 설정',facilities:'시설 관리'};
const kinds={stairs:'계단',escalator:'에스컬레이터',elevator:'엘리베이터'};
const metrics={source_arrivals:'원점 도착·하차',source_departures:'원점 출발·승차',station_candidate_arrivals:'역사 진입 추정'};
const $=s=>document.querySelector(s),options=(rows,value)=>rows.map(([id,label])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(label)}</option>`).join('');
const button=(action,label,attrs='')=>`<button type="button" data-action="${action}" ${attrs}>${label}</button>`;
const input=(name,label,value='',type='text')=>`<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${type==='text'?'maxlength="240"':''}></label>`;
const selectInput=(name,label,rows,value)=>`<label>${label}<select name="${name}">${options(rows,value)}</select></label>`;
const statusInput=v=>selectInput('status','위치 검토 상태',[['draft','미검토'],['checked','위치 확인함']],v||'draft');
const note=(name,label,value='')=>`<label>${label}<textarea name="${name}" maxlength="2000">${esc(value)}</textarea></label>`;
const section=(title,html)=>`<section class="wb-section"><h3>${title}</h3>${html}</section>`;
const roleBadge=role=>`<span class="wb-role" style="--role-color:${CONNECTOR_ROLES[role].color}">${CONNECTOR_ROLES[role].label}</span>`;
const empty=text=>`<div class="wb-empty">${text}</div>`;

export async function startLocationWorkbench(){
  document.body.classList.add('workbench');document.title='서울역 위치·경로 작업판';$('.title h1').textContent='서울역 위치·경로 작업판';
  const frame=$('#stationMap'),params=new URLSearchParams(location.search);
  const localPreview=['localhost','127.0.0.1'].includes(location.hostname);
  const localScene=localPreview&&params.get('scene')==='local';
  const storageLabel=localPreview?'로컬 미리보기':'공유 서버';
  let tab=Object.hasOwn(TABS,params.get('tab'))?params.get('tab'):params.has('origins')?'endpoints':'grid';
  let floor=REVIEW_FLOORS.includes(params.get('floor'))?params.get('floor'):'2F',query='',ready=false,selected=null,state,source,grid,origins,destinations,points,pointMap,revision=0,dirty=false,saving=false,saveError=false;
  let request=0,saveTimer,waitingMap,changeNumber=0,sourceError='',loadError='';
  const ui={forms:{},observationDrafts:{},origin:null,facility:null,endpoint:null,connection:null,route:null,routeConnection:'',epAccess:null,epPointMode:false,area:[],areaMode:false,connectionFrom:null,connectionTo:null,connectionStops:[],limit:80,showInactive:false,allFacilityFloors:false,hourly:{},hourDay:''};
  const post=data=>frame.contentWindow?.postMessage(data,location.origin);
  ui.steps=[];ui.routeInsert=0;
  const routeDraft=()=>({...form(),steps:ui.steps});
  const insertionPoint=()=>routeInsertionPoint(routeDraft(),state,ui.routeInsert);
  function insertRouteStep(step){
    const cursor=getPoint(insertionPoint()),entry=walk(routeStepPoints(step)[0]);
    if(!form().from)throw Error('먼저 출발 위치를 선택하세요.');
    if(cursor&&cursor.floor!==entry.floor)throw Error(`현재 ${cursor.floor}에서 이어가는 순서입니다. ${entry.floor}로 이동하는 층간 연결을 먼저 넣거나 추가 위치를 바꾸세요.`);
    if(step.kind==='point'&&cursor?.review_id===entry.review_id)throw Error('바로 앞과 같은 격자입니다. 다음 점을 선택하세요.');
    ui.steps.splice(ui.routeInsert,0,step);ui.routeInsert++;
    if(step.kind==='connection')choose(step.to);
    else {render();sendMap();}
    notify(`이동 순서에 추가했습니다. 다음은 ${getPoint(routeStepPoints(step).at(-1))?.floor}에서 이어가세요.`);
  }
  const context=()=>({grid,points});
  const getPoint=id=>pointMap.get(id);
  const walk=id=>{const p=getPoint(id);if(p?.record_kind!=='walk_point'||state.excluded_points.includes(id))throw Error('지도에서 사용할 수 있는 흰 격자점을 선택하세요.');return p;};
  const selectedWalk=()=>walk(selected?.review_id);
  const notify=text=>{$('#wbMessage').textContent=text;};
  const match=record=>!query||JSON.stringify(record).toLowerCase().includes(query.toLowerCase());
  const form=()=>ui.forms[tab]||{};
  function remember(){const f=$('#wbForm');if(f){ui.forms[tab]=Object.fromEntries(new FormData(f));const multi=f.querySelector('[name=origin_ids]');if(multi)ui.forms[tab].origin_ids=[...multi.selectedOptions].map(o=>o.value);const active=f.querySelector('[name=active]');if(active)ui.forms[tab].active=active.checked;}const observation=$('#observationForm');if(observation&&ui.origin)ui.observationDrafts[ui.origin]=Object.fromEntries(new FormData(observation));}
  function updateUrl(){const u=new URL(location.href);u.searchParams.set('tab',tab);u.searchParams.set('floor',floor);u.searchParams.delete('origins');u.hash='';history.replaceState(null,'',u);}
  $('.review-head').innerHTML=`<div class="review-heading"><h2>위치·경로 설정</h2><span id="counts"></span></div><nav aria-label="작업 종류">${Object.entries(TABS).map(([id,title],i)=>`<button data-work-tab="${id}" aria-pressed="false">${i+1}. ${title}</button>`).join('')}</nav><div class="filters"><label><span>현재 목록 검색</span><input id="wbSearch" type="search" placeholder="이름 또는 ID"></label><label><span>지도 층</span><select id="wbFloor">${options(REVIEW_FLOORS.map(f=>[f,f]),floor)}</select></label></div><div id="wbMessage" role="status">자료를 불러오는 중입니다.</div>`;
  $('.review-pane footer').innerHTML='<span id="wbSaveState">관리 자료 연결 중</span><button id="wbSave">지금 저장</button><button id="wbExport">전체 백업 ↓</button><label class="wb-import">백업 불러오기<input id="wbImport" type="file" accept="application/json,.json"></label>';
  const tools=document.createElement('div');tools.className='wb-map-tools';tools.innerHTML='<label><input id="wbGrid" type="checkbox" checked> 흰 격자</label><label><input id="wbLabels" type="checkbox"> 이름</label><span>출도착 <b style="color:#43dc83">●</b> · 층간 <b style="color:#4299ff">●</b> · 시설 <b style="color:#ffd24a">●</b></span><button id="wbOverview">층 전체</button><span id="wbConnectorLegend" class="wb-connector-legend" hidden></span>';
  $('.map-pane').append(tools);
  const load=async url=>{const r=await fetch(url);const d=await r.json();if(!r.ok)throw Error(d.error||`자료 오류 ${r.status}`);return d;};
  try{
    const [r,g,o,d,s,pool]=await Promise.all([load('/data/route-review/register.json'),load('/data/route-review/grid-all.json'),load('/data/route-review/origin-entries.json'),load('/data/route-review/destinations.json'),load('/__location_workbench/state').catch(e=>{loadError=e.message;return null;}),load('/__location_workbench/source').catch(e=>{sourceError=e.message;return null;})]);
    grid=g;origins=o;destinations=d;source=pool;points=workbenchPoints(r.register,d,g,o);pointMap=new Map(points.map(p=>[p.review_id,p]));
    state=s?.data?validateWorkbench(s.data,context()):seedWorkbench({grid,origins,destinations});revision=s?.revision||0;
    const beforeFacilities=state.facilities.length;state=mergeFacilitySeeds(state,destinations);const addedFacilities=state.facilities.length-beforeFacilities;
    validateWorkbench(state,context());ui.origin=state.origins[0]?.id;ui.facility=state.facilities[0]?.id;$('#wbSaveState').textContent=s?.saved_at?`${storageLabel} 저장본 · ${new Date(s.saved_at).toLocaleTimeString('ko-KR')}`:'저장 준비';
    render();loadMap();notify(loadError?`기존 저장 자료를 읽지 못했습니다. 편집·저장을 중단했습니다: ${loadError}`:`탭을 고르고 지도에서 위치를 선택하세요. 저장한 항목은 ${storageLabel}에 변경 이력과 함께 보관됩니다.`);
    if(loadError)$('#content').inert=true;else if(!s.data||addedFacilities){dirty=true;await save();if(addedFacilities&&!saveError)notify(`관리대상 파사드 기준 누락 시설 ${addedFacilities}곳을 추가했습니다. 기존 입력·등록 해제 상태는 유지됩니다.`);}
  }catch(e){$('#content').innerHTML=empty(`작업판을 열지 못했습니다: ${esc(e.message)}. 기존 파일은 변경하지 않았습니다.`);notify('자료 연결 오류');return;}

  function pendingSave(){dirty=true;changeNumber++;saveError=false;$('#wbSaveState').textContent='변경 저장 대기…';clearTimeout(saveTimer);saveTimer=setTimeout(save,400);}
  async function save(){
    if(saving||!dirty||loadError)return;
    saving=true;const n=changeNumber;$('#wbSaveState').textContent=`${storageLabel}에 저장 중…`;
    try{const r=await fetch('/__location_workbench/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,data:state})});const saved=await r.json();if(!r.ok)throw Error(saved.error);revision=saved.revision;dirty=n!==changeNumber;$('#wbSaveState').textContent=`${storageLabel} 저장 완료 · ${new Date(saved.saved_at).toLocaleTimeString('ko-KR')}`;}
    catch(e){saveError=true;$('#wbSaveState').textContent='저장 실패 · 전체 백업 필요';notify(e.message);}
    finally{saving=false;if(dirty&&!saveError)saveTimer=setTimeout(save,100);}
  }
  function commit(change,message){if(loadError)throw Error('저장 자료를 다시 연결하세요.');const next=structuredClone(state);change(next);state=validateWorkbench(next,context());pendingSave();render();sendMap();notify(message);}
  const upsert=(list,record)=>{const i=list.findIndex(r=>r.id===record.id);if(i<0)list.push(record);else list[i]=record;};
  const newId=prefix=>`${prefix}-${crypto.randomUUID()}`;
  function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function renderSelection(){
    $('#selection').innerHTML=selected?`<small>${esc(selected.floor)} · ${esc(selected.review_id)}</small><h2>${esc(selected.label)}</h2><p>${selected.record_kind==='walk_point'?'선택한 격자점을 오른쪽 작업에 사용하세요.':'참고 위치입니다. 실제 보행 접속점은 흰 격자에서 선택하세요.'}</p>`:'<small>위치 선택</small><h2>지도 또는 목록의 점을 선택하세요</h2>';
  }
  function choose(id,move=true){
    remember();const p=getPoint(id)||endpointFeature(state.endpoints.find(e=>e.id===id));if(!p||!mapFeature(p))return notify('층·좌표가 확인되지 않은 참고 위치입니다.');
    selected=p;if(floor!==p.floor){floor=p.floor;$('#wbFloor').value=floor;updateUrl();}
    if(ui.areaMode&&tab==='endpoints'){const w=walk(id);if(ui.area.length&&getPoint(ui.area[0]).floor!==w.floor)return notify('영역 꼭짓점은 같은 층에서 선택하세요.');if(!ui.area.includes(id))ui.area.push(id);}
    render();sendMap();
    if(move&&ready){const c=p.geometry.type==='Point'?p.geometry.coordinates:p.geometry.coordinates[0][0];const f=makeFocus(p)||{floor:p.floor,longitude:c[0],latitude:c[1],height:c[2],label:p.label,sourceKind:'route_review',imageId:p.review_id};post({type:f.catalog?'station-one:catalog-focus':'station-one:route-review-focus',requestId:++request,focus:f});}
  }
  function endpointFeature(e){return e?{review_id:e.id,label:e.name,floor:e.floor,layer:'od',geometry:e.geometry}:null;}
  function connectionMarkers(){return routeConnectionMarkers(state.connections,pointMap,floor);}
  function chosenConnection(){return ui.routeConnection?state.connections.find(c=>c.id===JSON.parse(ui.routeConnection)[0]):null;}
  function selectRouteConnection(id,move=false){
    remember();const c=state.connections.find(c=>c.id===id);if(!c)return;
    const cursorFloor=getPoint(insertionPoint())?.floor||floor;
    const pair=connectionPairs(c).find(pair=>pair.some(id=>getPoint(id)?.floor===cursorFloor))||connectionPairs(c)[0];
    ui.routeConnection=JSON.stringify([c.id,...pair]);render();sendMap();
    if(move)choose(pair.find(id=>getPoint(id)?.floor===floor)||pair[0]);
    $('#routeConnectionDetails')?.scrollIntoView({block:'nearest'});
    notify(`${connectionCode(state.connections,c.id)} 선택. 이동 방향을 골라 순서에 추가하세요. 앞서 추가한 연결은 유지됩니다.`);
  }
  function sendMap(overview=false){
    if(!ready)return;
    const map=new Map(),put=p=>{if(p?.floor===floor&&mapFeature(p))map.set(p.review_id,p);};
    if($('#wbGrid').checked)for(const p of points)if(p.record_kind==='walk_point'&&!state.excluded_points.includes(p.review_id))put(p);
    if(tab==='connections')for(const p of points)if(p.layer==='connector')put(p);
    if(tab==='endpoints')for(const p of points)if(p.record_kind==='entry_candidate')put(p);
    for(const e of state.endpoints)put(endpointFeature(e));
    for(const c of state.connections)for(const id of connectionStops(c))put({...getPoint(id),layer:'connector',label:c.name});
    for(const f of state.facilities.filter(f=>f.active)){const p=getPoint(f.access_id||f.source_id);if(p)put({...p,layer:'facility',label:f.name});}
    for(const id of [ui.connectionFrom,ui.connectionTo,...ui.connectionStops])if(id&&tab==='connections')put({...getPoint(id),layer:'connector'});
    if(tab==='connections'){
      const editing={kind:form().kind||'stairs',from:ui.connectionFrom,to:ui.connectionTo,stops:ui.connectionStops};
      for(const [id,role] of connectionPointRoles(state.connections,editing)){
        const p=map.get(id)||getPoint(id);if(p)put({...p,layer:'connector',connector_role:role});
      }
    }
    if(selected&&selected.record_kind!=='walk_point')put(selected);
    if(tab==='routes')for(const p of connectionMarkers())put(p);
    const marker=tab==='routes'&&connectionMarkers().find(p=>p.connection_id===chosenConnection()?.id);
    post({type:'station-one:point-review-layer',floor,features:[...map.values()].map(mapFeature),selected:marker?.review_id||selected?.review_id,labels:$('#wbLabels').checked,overview,requestId:++request});
    const lines=[];const line=(a,b)=>{const p=getPoint(a),q=getPoint(b);if(p&&q&&(p.floor===floor||q.floor===floor))lines.push({coordinates:[p.geometry.coordinates,q.geometry.coordinates]});};
    const connectionLine=(c,a,b,style={})=>{const path=connectionPath(c,a,b)||[a,b];if(!path.some(id=>getPoint(id)?.floor===floor))return;for(let i=1;i<path.length;i++){const p=getPoint(path[i-1]),q=getPoint(path[i]);if(p&&q)lines.push({coordinates:[p.geometry.coordinates,q.geometry.coordinates],...style});}};
    if(tab==='connections'){for(const c of state.connections)for(const [a,b] of connectionPairs(c))connectionLine(c,a,b);if(form().kind==='elevator'){for(let i=1;i<ui.connectionStops.length;i++)line(ui.connectionStops[i-1],ui.connectionStops[i]);}else if(ui.connectionFrom&&ui.connectionTo)line(ui.connectionFrom,ui.connectionTo);}
    if(tab==='routes'){
      for(const c of state.connections)for(const [a,b] of connectionPairs(c))connectionLine(c,a,b,{kind:'interfloor',highlight:c.id===chosenConnection()?.id});
      // Invalid floor gaps stay visibly disconnected; never suggest an unregistered jump.
      const draft=routeDraft();let cursor=state.endpoints.find(e=>e.id===draft.from)?.access_id;
      const sameFloorLine=(a,b)=>{if(a&&b&&getPoint(a)?.floor===getPoint(b)?.floor&&a!==b)line(a,b);};
      for(const step of ui.steps){
        const ids=routeStepPoints(step);sameFloorLine(cursor,ids[0]);
        if(step.kind==='connection'){const c=state.connections.find(c=>c.id===step.connection_id);if(c&&connectionPath(c,...ids))connectionLine(c,...ids);}
        cursor=ids.at(-1);
      }
      sameFloorLine(cursor,state.endpoints.find(e=>e.id===draft.to)?.access_id);
    }
    if(tab==='endpoints'&&ui.area.length)for(let i=0;i<ui.area.length;i++)line(ui.area[i],ui.area[(i+1)%ui.area.length]);
    post({type:'station-one:route-draft-lines',floor,lines,kind:tab==='connections'?'interfloor':'route'});
  }
  function locationLabel(id){return id?`${getPoint(id)?.floor||''} · ${getPoint(id)?.label||id}`:'미지정';}
  function pickedBox(){return `<div class="wb-live">선택 위치: ${esc(selected?locationLabel(selected.review_id):'지도에서 점을 선택하세요')}</div>`;}
  function pointList(rows){return `<div class="wb-list">${rows.slice(0,ui.limit).map(p=>`<div class="wb-row">${button('pick',`<strong>${esc(p.label)}</strong><small>${esc(p.review_id)}</small>`,`data-id="${esc(p.review_id)}"`)}</div>`).join('')}</div>${rows.length>ui.limit?button('more',`더 보기 (${ui.limit}/${rows.length})`):''}`;}
  function gridPanel(){
    const stats=grid.floors[floor],rows=points.filter(p=>p.record_kind==='walk_point'&&p.floor===floor&&match(p));
    return section('전 층 보행 격자',`<div class="wb-stats"><span>전 층 ${grid.points.length.toLocaleString()}점</span><span>${floor} ${stats.points.toLocaleString()}점</span><span>평지 ${grid.spacing_m}m · 계단 ${grid.tread_spacing_m}m</span></div><p>철거·숨김 시설은 기존 장애물 검사에서 제외한 격자입니다. 격자 후보의 실제 통행 가능 여부는 확인해 주세요.</p>${pickedBox()}<div class="wb-buttons">${button('exclude','선택 격자 사용 제외')}${button('restore','선택 격자 사용 복원')}</div><p>제외 ${state.excluded_points.length}점. 출도착·연결·경로에 사용 중인 점은 제외할 수 없습니다.</p>${stats.points?pointList(rows):empty('이 층은 보행 바닥 자료가 없어 격자를 만들지 않았습니다.')}<details><summary>층별 점 수</summary>${REVIEW_FLOORS.map(f=>`<p>${f}: ${grid.floors[f]?.points||0}개</p>`).join('')}</details>`);
  }
  function connectionPanel(){
    const f=form(),isLift=f.kind==='elevator',record=state.connections.find(c=>c.id===ui.connection);
    const candidates=points.filter(p=>p.layer==='connector'&&p.floor===floor&&match(p));
    const liftStops=`<p>같은 엘리베이터의 각 층 접속점을 추가하세요. 등록된 모든 정차점 사이를 N:N 양방향으로 연결합니다.</p>${button('addLiftStop','선택점을 정차층 접속점에 추가')}<div class="wb-list">${ui.connectionStops.map((id,i)=>`<div class="wb-row">${button('pick',esc(locationLabel(id)),`data-id="${esc(id)}"`)}${button('removeLiftStop','빼기',`data-index="${i}"`)}</div>`).join('')||empty('정차층 접속점을 2개 이상 추가하세요.')}</div><small>${ui.connectionStops.length}개 정차점 · ${ui.connectionStops.length*(ui.connectionStops.length-1)}개 이동 방향</small>`;
    const pairStops=`<div class="wb-buttons">${button('setFrom',roleBadge('A')+' 선택점을 A로')}${button('setTo',roleBadge('B')+' 선택점을 B로')}</div><div class="wb-live">${roleBadge('A')} ${esc(locationLabel(ui.connectionFrom))}<br>${roleBadge('B')} ${esc(locationLabel(ui.connectionTo))}</div><p>A를 선택한 뒤 지도 층을 바꿔 B를 선택하세요. 서로 다른 층의 실제 접속점을 연결합니다.</p>`;
    const audit=state.connection_review;
    return section('층간 접속점 연결',`<form id="wbForm">${input('name','연결 이름',f.name||'')}${selectInput('kind','시설 종류',Object.entries(kinds),f.kind||'stairs')}<div class="wb-pair">${isLift?'<label>이동 방향<input name="direction" value="both" type="hidden"><span>N:N 양방향</span></label>':selectInput('direction','이동 방향',[['both','양방향'],['forward','A → B 단방향']],f.direction||'both')}${statusInput(f.status)}</div>${pickedBox()}${isLift?liftStops:pairStops}${record?.evidence?`<p class="wb-warning">${esc(record.evidence.notes)}${record.path?` 이동면 ${record.path.length}점 · ${record.evidence.length_m}m`:''}</p>`:''}<div class="wb-buttons">${button('saveConnection','층간 연결 저장','class="wb-primary"')}${button('newConnection','새 연결')}</div></form>`)
      +section(`저장된 연결 ${state.connections.length}개`,`<p>모델 연속성에 근거한 등록은 현장 미검토 상태로 구분합니다. 에스컬레이터 운행 방향은 별도 확인 대상입니다.</p><div class="wb-list">${state.connections.filter(match).map(c=>`<div class="wb-row">${button('editConnection',`<strong>${esc(c.name)}</strong><small>${connectionStops(c).map(id=>esc(getPoint(id).floor)).join(' ↔ ')} · ${c.kind==='elevator'?'N:N ':''}${kinds[c.kind]} · ${c.status==='checked'?'확인함':'미검토'}</small>`,`data-id="${esc(c.id)}"`)}${button('deleteConnection','삭제',`data-id="${esc(c.id)}"`)}</div>`).join('')||empty('아직 연결하지 않았습니다.')}</div>`)
      +(audit?section('연결 근거·보류 내역',`<p>이동면 연속 경로와 동일 승강로 좌표를 기준으로 등록했습니다. 다른 층 바닥이 없거나 연결 근거가 부족한 곳은 억지로 연결하지 않았습니다.</p><details><summary>미연결 사유 ${audit.unresolved.length}건</summary>${audit.unresolved.map(r=>`<p>${esc(r.id)} · ${esc(r.reason)}</p>`).join('')}</details>`):'')
      +section(`${floor} 층간 시설 참고 후보 ${candidates.length}개`,`<p>파란 참고점은 시설 중심이며 실제 접속점이 아닐 수 있습니다.</p>${pointList(candidates)}`);
  }
  function originLinks(o){
    const links=state.endpoints.filter(e=>e.origin_ids.includes(o?.id)),audit=state.origin_assignment_review?.assignments.find(a=>a.origin_id===o?.id);
    return links.map(e=>button('showEndpoint',esc(e.name+' · '+e.floor),`data-id="${esc(e.id)}"`)).join('')+(links.length?'':empty('아직 연결하지 않았습니다.'))+(audit?`<p>등록 당시 출입구 영역까지 직선거리: ${audit.distances.map(d=>esc(d.endpoint_name)+' '+d.distance_m+'m').join(' / ')}. 실제 도로 보행거리는 아닙니다.</p>${audit.warning?'<p class="wb-warning">'+esc(audit.warning)+'</p>':''}`:'');
  }
  function originPanel(){const o=state.origins.find(o=>o.id===ui.origin),f=form(),raw=origins.origins.find(r=>r.id===o?.id),days=source?.daily.filter(d=>d.origin_id===o?.id)||[],edits=state.observations.filter(r=>r.origin_id===o?.id);
    const value=(day,metric)=>{const override=edits.find(r=>r.date===day.target_date&&r.hour===null&&r.metric===metric);const n=override?override.value:day[metric];return n===null||n===undefined?'미확보':`${Number(n).toLocaleString()}${override?' *':''}`;};
    return section('유동인구 원점',`<label>원점 목록<select id="wbOrigin">${options(state.origins.filter(match).map(o=>[o.id,`${o.active?'':'[사용 안 함] '}${o.name}`]),ui.origin)}</select></label><form id="wbForm">${input('name','원점명',f.name??o?.name??'')}${input('mode','교통수단·모드',f.mode??o?.mode??'')}${note('notes','관리 메모',f.notes??o?.notes??'')}<label class="wb-inline"><input name="active" type="checkbox" ${(f.active??o?.active)?'checked':''}> 관리 사용</label><div class="wb-buttons">${button('saveOrigin','원점 정보 저장','class="wb-primary"')}${button('newOrigin','새 원점')}</div></form><small>${esc(o?.id||'새 원점')} · 외부 원점 좌표는 지도에 표시하지 않습니다.</small>`)+section('연결된 출발·도착 위치',originLinks(o))+section('인원 데이터 입력',`<form id="observationForm"><div class="wb-pair">${input('date','기준 날짜','2026-07-01','date')}${selectInput('hour','운행 시간',[['','일별'],...Array.from({length:48},(_,i)=>[String(i),`${i}시${i>=24?' (다음날)':''}`])],'')}</div>${selectInput('metric','수량 구분',Object.entries(metrics),'source_arrivals')}${input('value','인원 · 빈 값은 미확보','','number')}${selectInput('value_class','자료 구분',[['OBSERVED','관측'],['DERIVED','산출'],['ESTIMATED','추정'],['SUBSTITUTED','대체'],['UNKNOWN','미확보']],'ESTIMATED')}${note('source','출처·추정 기준')}<div class="wb-buttons">${button('saveObservation','입력값 저장','class="wb-primary"')}${button('clearObservation','입력값 취소')}</div></form><p>일별과 시간별은 별도 관리합니다. 빈 값과 0명을 구분하며 원천값은 지우지 않습니다.</p><div class="wb-buttons">${button('observationTemplate','일괄 입력 양식 ↓')}<label class="wb-file">인원 JSON 불러오기<input id="observationImport" type="file" accept="application/json,.json"></label></div>`)+section('2026년 7월 기존 데이터',sourceError?empty(`원천 데이터 연결 실패: ${esc(sourceError)}`):`<p>원점의 승하차·도착량이며 역사 진입 인원이나 순방문자 수가 아닙니다. *는 작업판 수정값입니다.</p><div class="wb-table"><table><thead><tr><th>운행일</th><th>도착·하차</th><th>출발·승차</th><th>진입 추정</th><th>구분</th></tr></thead><tbody>${days.map(d=>`<tr><td>${esc(d.target_date)}</td><td>${value(d,'source_arrivals')}</td><td>${value(d,'source_departures')}</td><td>${value(d,'station_candidate_arrivals')}</td><td>${esc(d.value_class)}</td></tr>`).join('')}</tbody></table></div><details><summary>기존 시간대 자료·출처</summary><p>${esc(raw?.hourly_note||'기존 시간대 자료 없음')}</p><p>${raw?.provenance?.map(p=>esc(`${p.series_id} · ${p.value_class} · ${p.source_period}`)).join('<br>')||'신규 원점'}</p></details>`)+section('기존 시간대 원천값',`${button('loadHourly','이 원점의 시간대 자료 열기')}${hourlyPanel()}`)+section(`작업판 입력 ${edits.length}건`,`<div class="wb-list">${edits.map(r=>`<div class="wb-row">${button('editObservation',`<strong>${esc(r.date)} ${r.hour===null?'일별':r.hour+'시'} · ${esc(metrics[r.metric])}</strong><small>${r.value===null?'미확보':r.value.toLocaleString()} · ${esc(r.value_class)}</small>`,`data-key="${esc(observationKey(r))}"`)}${button('deleteObservation','삭제',`data-key="${esc(observationKey(r))}"`)}</div>`).join('')||empty('추가 입력 없음')}</div>`);
  }
  function hourlyPanel(){const data=ui.hourly[ui.origin];if(!data)return '<p>원천 운행일과 자료 구분을 유지한 시간대 값입니다.</p>';const dates=[...new Set(data.rows.map(r=>r.service_date))].sort(),day=dates.includes(ui.hourDay)?ui.hourDay:dates[0];return `<p>${esc(data.note)} · ${data.rows.length.toLocaleString()}건</p>${dates.length?`<label>원천 운행일<select id="hourSourceDate">${options(dates.map(d=>[d,d]),day)}</select></label><div class="wb-table"><table><thead><tr><th>시간</th><th>계열·수량</th><th>인원</th><th>구분</th><th>기본합계 포함</th></tr></thead><tbody>${data.rows.filter(r=>r.service_date===day).map(r=>`<tr><td>${esc(r.source_hour)}시</td><td>${esc(r.series_id)}<br>${r.metric==='passenger_alightings'?'하차':r.metric==='passenger_boardings'?'승차':esc(r.metric)}</td><td>${esc(r.value)}</td><td>${esc(r.value_class)}</td><td>${esc(r.include_in_total)}</td></tr>`).join('')}</tbody></table></div>`:empty('이 원점의 기존 시간대 값은 없습니다. 일별 추정치를 시간별 실측처럼 표시하지 않습니다.')}`;}
  function endpointPanel(){const f=form(),e=state.endpoints.find(e=>e.id===ui.endpoint),rawOrigin=origins.origins.find(o=>o.id===(f.origin_ids||e?.origin_ids||[])[0]);
    return section('출발·도착 위치 편집',`<form id="wbForm">${input('name','출도착 위치 이름',f.name||'')}<div class="wb-pair">${selectInput('role','역할',[['both','출발·도착 겸용'],['start','출발 전용'],['end','도착 전용']],f.role||'both')}${statusInput(f.status)}</div><label>연결 원점 (여러 개 선택 가능)<select name="origin_ids" multiple>${state.origins.map(o=>`<option value="${esc(o.id)}" ${(f.origin_ids||[]).includes(o.id)?'selected':''}>${esc(o.name)}</option>`).join('')}</select></label><p>원점을 먼저 고른 뒤 아래 추천 후보나 지도에서 실제 진입 위치를 확인하세요.</p>${rawOrigin?`<div class="wb-buttons">${rawOrigin.entry_ids.map(id=>{const p=getPoint(id);return p?button('pick',esc(p.label),`data-id="${esc(id)}"`):'';}).join('')}</div>`:''}${pickedBox()}<div class="wb-buttons">${button('endpointPoint','선택 격자 한 점 사용')}${button('areaToggle',ui.areaMode?'영역 선택 종료':'영역 꼭짓점 선택 시작')}${button('areaUndo','꼭짓점 취소')}${button('areaClear','영역 비우기')}</div><div class="wb-live">${ui.area.length?`영역 꼭짓점 ${ui.area.length}개`:(e?.geometry.type==='Polygon'?'저장된 영역':'점 형태')}<br>보행 접속점: ${esc(locationLabel(ui.epAccess))}</div>${button('endpointAccess','선택 격자를 영역의 접속점으로')}<p>영역은 같은 층 격자 3개 이상을 둘레 순서대로 선택하세요. 경로 연결에 쓸 보행 접속점도 지정합니다.</p><div class="wb-buttons">${button('saveEndpoint','출도착 위치 저장','class="wb-primary"')}${button('newEndpoint','새 위치')}</div></form>`)+section(`등록 위치 ${state.endpoints.length}곳`,`<div class="wb-list">${state.endpoints.filter(match).map(e=>`<div class="wb-row">${button('editEndpoint',`<strong>${esc(e.name)}</strong><small>${e.floor} · ${e.geometry.type==='Polygon'?'영역':'점'} · 원점 ${e.origin_ids.length}개</small>`,`data-id="${esc(e.id)}"`)}${button('deleteEndpoint','삭제',`data-id="${esc(e.id)}"`)}</div>`).join('')||empty('등록된 출도착 위치가 없습니다.')}</div>`);
  }
  function routePanel(){return renderRouteEditor({f:form(),state,pointMap,steps:ui.steps,insert:ui.routeInsert,selected,connection:ui.routeConnection,editing:ui.route,match});}
  function facilityPanel(){const f=form(),record=state.facilities.find(x=>x.id===ui.facility),visible=state.facilities.filter(f=>(ui.allFacilityFloors||f.floor===floor)&&(ui.showInactive||f.active)&&match(f));return section(`시설 목록 · ${ui.allFacilityFloors?'전층':floor} ${visible.length}곳`,`<p>기존 관리대상 파사드·안내시설 기준입니다. 미검토 후보는 상호와 출입점을 확인하세요. 전체 등록 ${state.facilities.filter(f=>f.active).length}곳 · 해제 ${state.facilities.filter(f=>!f.active).length}곳. 기존 입력과 해제 상태는 유지됩니다.</p><label class="wb-inline"><input id="allFacilityFloors" type="checkbox" ${ui.allFacilityFloors?'checked':''}> 다른 층·층 미지정 시설도 보기</label><label class="wb-inline"><input id="showInactive" type="checkbox" ${ui.showInactive?'checked':''}> 등록 해제 시설도 보기</label><div class="wb-list">${visible.map(f=>`<div class="wb-row">${button('editFacility',`<strong>${esc(f.name)}${f.active?'':' (해제)'}</strong><small>${esc(f.floor||'층 미지정')} · ${esc(f.category)} · ${f.access_id?'출입점 지정됨':'출입점 미지정'} · ${f.status==='checked'?'확인함':'미검토'}</small>`,`data-id="${esc(f.id)}"`)}</div>`).join('')}</div>${button('newFacility','신규 시설 등록')}`)+section(record?'시설 정보 수정':'신규 시설',`<form id="wbForm">${input('name','시설·매장명',f.name??record?.name??'')}<div class="wb-pair">${input('category','분류',f.category??record?.category??'안내')}${selectInput('floor','시설 층',[['','층 미지정'],...REVIEW_FLOORS.map(f=>[f,f])],f.floor??record?.floor??floor)}</div>${input('hours','운영시간',f.hours??record?.hours??'')}${input('contact','연락처',f.contact??record?.contact??'')}${note('notes','안내 내용·메모',f.notes??record?.notes??'')}${statusInput(f.status??record?.status)}<div class="wb-live">보행 출입점: ${esc(locationLabel(f.access_id??record?.access_id))}</div>${pickedBox()}<div class="wb-buttons">${button('facilityAccess','선택 격자를 출입점으로')}${button('facilitySource','기존 참고 위치 보기')}${button('facilityClearAccess','출입점 지정 해제')}</div><input name="access_id" type="hidden" value="${esc(f.access_id??record?.access_id??'')}"><div class="wb-buttons">${button('saveFacility','시설 저장','class="wb-primary"')}${button('toggleFacility',record?.active?'등록 해제':'다시 등록',record?'':'disabled')}</div></form>`);}
  function render(){
    const active=document.activeElement?.id,scroll=$('#content').scrollTop;
    $('#wbConnectorLegend').hidden=!['connections','routes'].includes(tab);
    $('#wbConnectorLegend').innerHTML=tab==='routes'?'<b style="color:#4299ff">C번호 · 층간 연결</b> 라벨 클릭 → 연결 선택 <small>청록: 선택 연결 · 보라: 경로 초안</small>':`${roleBadge('A')} 청록 · ${roleBadge('B')} 분홍 <small>(공유점 A/B · 승강기 파랑)</small>`;
    $('[data-work-tab="'+tab+'"]').parentElement.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.workTab===tab)));
    $('#counts').textContent=`${floor} · ${TABS[tab]}`;
    $('#content').innerHTML=({grid:gridPanel,connections:connectionPanel,origins:originPanel,endpoints:endpointPanel,routes:routePanel,facilities:facilityPanel}[tab])();
    if(tab==='routes'){
      $('#routeConnection').value=ui.routeConnection;
      const c=chosenConnection(),details=document.createElement('div');details.id='routeConnectionDetails';details.className='wb-live';
      details.innerHTML=c?`<strong>${esc(connectionCode(state.connections,c.id)+' · '+c.name)}</strong><p>${esc(c.id)} · ${c.status==='checked'?'위치 확인함':'미검토'}</p><div class="wb-buttons">${JSON.parse(ui.routeConnection).slice(1).map((id,i)=>button('pick',roleBadge(i?'B':'A')+esc(locationLabel(id)),`data-id="${esc(id)}"`)).join('')}</div>`:'지도에 표시된 C번호 라벨을 클릭하세요. 같은 번호의 층간 연결이 선택됩니다.';
      $('#routeConnection').closest('label').after(details);
    }
    if(tab==='origins'){$('#wbOrigin').value=ui.origin||'';const observation=$('#observationForm');for(const [key,value] of Object.entries(ui.observationDrafts[ui.origin]||{}))if(observation.elements[key])observation.elements[key].value=value??'';}
    $('#content').scrollTop=scroll;renderSelection();if(active&&document.getElementById(active))document.getElementById(active).focus({preventScroll:true});
  }
  function resetEditor(kind){ui.forms[tab]={};if(kind==='connection'){ui.connection=null;ui.connectionFrom=null;ui.connectionTo=null;ui.connectionStops=[];ui.routeConnection='';}if(kind==='endpoint'){ui.endpoint=null;ui.epAccess=null;ui.epPointMode=false;ui.area=[];ui.areaMode=false;}if(kind==='route'){ui.route=null;ui.steps=[];ui.routeInsert=0;ui.routeConnection='';}if(kind==='facility')ui.facility=null;render();sendMap();}
  function takeForm(){remember();return form();}
  function perform(action,b){const f=takeForm(),id=b?.dataset.id,index=Number(b?.dataset.index);switch(action){
    case 'pick':choose(id);break;
    case 'more':ui.limit+=80;render();break;
    case 'exclude':{if(selected?.record_kind!=='walk_point')throw Error('격자를 선택하세요.');commit(s=>{if(!s.excluded_points.includes(selected.review_id))s.excluded_points.push(selected.review_id);},'격자를 사용 제외했습니다.');break;}
    case 'restore':commit(s=>s.excluded_points=s.excluded_points.filter(id=>id!==selected?.review_id),'격자를 복원했습니다.');break;
    case 'setFrom':ui.connectionFrom=selectedWalk().review_id;render();sendMap();break;
    case 'setTo':ui.connectionTo=selectedWalk().review_id;render();sendMap();break;
    case 'addLiftStop':{const id=selectedWalk().review_id;if(!ui.connectionStops.includes(id))ui.connectionStops.push(id);render();sendMap();break;}
    case 'removeLiftStop':ui.connectionStops.splice(index,1);render();sendMap();break;
    case 'newConnection':resetEditor('connection');break;
    case 'saveConnection':{
      const cid=ui.connection||newId('CON'),old=state.connections.find(c=>c.id===cid);
      const c={...old,id:cid,name:f.name,kind:f.kind,direction:f.kind==='elevator'?'both':f.direction,status:f.status};
      if(f.kind==='elevator'){c.stops=[...ui.connectionStops];delete c.from;delete c.to;delete c.path;if(old&&JSON.stringify(connectionStops(old))!==JSON.stringify(c.stops))delete c.evidence;}
      else {c.from=ui.connectionFrom;c.to=ui.connectionTo;delete c.stops;if(old&&(old.from!==c.from||old.to!==c.to)){delete c.path;delete c.evidence;}}
      commit(s=>upsert(s.connections,c),'층간 연결을 저장했습니다.');ui.connection=cid;break;
    }
    case 'editConnection':{const c=state.connections.find(c=>c.id===id);ui.connection=id;ui.connectionFrom=c.from||null;ui.connectionTo=c.to||null;ui.connectionStops=c.kind==='elevator'?connectionStops(c):[];ui.forms[tab]={...c};render();choose(connectionStops(c)[0]);$('#content').scrollTop=0;break;}
    case 'deleteConnection':commit(s=>s.connections=s.connections.filter(c=>c.id!==id),'층간 연결을 삭제했습니다.');resetEditor('connection');break;
    case 'showEndpoint':tab='endpoints';query='';$('#wbSearch').value='';updateUrl();render();perform('editEndpoint',b);break;
    case 'saveOrigin':{const oid=ui.origin||newId('ORIGIN');commit(s=>upsert(s.origins,{...s.origins.find(o=>o.id===oid),id:oid,name:f.name,mode:f.mode,notes:f.notes,active:Boolean(f.active)}),'원점 정보를 저장했습니다.');ui.origin=oid;render();break;}
    case 'newOrigin':ui.origin=null;ui.forms[tab]={};render();break;
    case 'saveObservation':{const values=Object.fromEntries(new FormData($('#observationForm')));const r=validateObservation({origin_id:ui.origin,date:values.date,hour:values.hour===''?null:Number(values.hour),metric:values.metric,value:values.value===''?null:Number(values.value),value_class:values.value_class,source:values.source},new Set(state.origins.map(o=>o.id)));commit(s=>{s.observations=s.observations.filter(o=>observationKey(o)!==observationKey(r));s.observations.push(r);},'입력값을 저장했습니다. 원천 데이터는 보존됩니다.');delete ui.observationDrafts[ui.origin];render();break;}
    case 'clearObservation':delete ui.observationDrafts[ui.origin];render();break;
    case 'editObservation':{const r=state.observations.find(r=>observationKey(r)===b.dataset.key);for(const [k,v] of Object.entries(r))if($('#observationForm').elements[k])$('#observationForm').elements[k].value=v??'';$('#observationForm').scrollIntoView({block:'nearest'});break;}
    case 'deleteObservation':commit(s=>s.observations=s.observations.filter(r=>observationKey(r)!==b.dataset.key),'작업판 입력값을 삭제했습니다. 원천값은 유지됩니다.');break;
    case 'observationTemplate':download({observations:[{origin_id:ui.origin||state.origins[0].id,date:'2026-07-01',hour:null,metric:'source_arrivals',value:null,value_class:'UNKNOWN',source:'출처 또는 추정 기준을 입력'}]},'인원-입력양식.json');break;
    case 'endpointPoint':ui.epAccess=selectedWalk().review_id;ui.area=[];ui.areaMode=false;ui.epPointMode=true;render();break;
    case 'endpointAccess':ui.epAccess=selectedWalk().review_id;ui.areaMode=false;render();break;
    case 'areaToggle':ui.areaMode=!ui.areaMode;render();notify(ui.areaMode?'같은 층에서 둘레 순서대로 격자를 클릭하세요.':'영역 꼭짓점 선택을 마쳤습니다.');break;
    case 'areaUndo':ui.area.pop();render();sendMap();break;
    case 'areaClear':ui.area=[];ui.epPointMode=true;render();sendMap();break;
    case 'newEndpoint':resetEditor('endpoint');break;
    case 'saveEndpoint':{const access=walk(ui.epAccess),old=state.endpoints.find(e=>e.id===ui.endpoint);if(ui.area.some(id=>getPoint(id).floor!==access.floor))throw Error('영역과 접속점은 같은 층이어야 합니다.');const geometry=ui.area.length?endpointArea(ui.area.map(id=>getPoint(id).geometry.coordinates),{id:'area',label:f.name,floor:access.floor}):!ui.epPointMode&&old?.geometry.type==='Polygon'?old.geometry:access.geometry;const eid=ui.endpoint||newId('OD');commit(s=>upsert(s.endpoints,{id:eid,name:f.name,role:f.role,status:f.status,floor:access.floor,geometry,access_id:access.review_id,origin_ids:f.origin_ids||[]}),'출발·도착 위치를 저장했습니다.');ui.endpoint=eid;ui.areaMode=false;break;}
    case 'editEndpoint':{const e=state.endpoints.find(e=>e.id===id);ui.endpoint=id;ui.epAccess=e.access_id;ui.epPointMode=false;ui.area=[];ui.areaMode=false;ui.forms[tab]={...e};render();choose(id);break;}
    case 'deleteEndpoint':commit(s=>s.endpoints=s.endpoints.filter(e=>e.id!==id),'출도착 위치를 삭제했습니다.');resetEditor('endpoint');break;
    case 'viaAdd':insertRouteStep({kind:'point',point_id:selectedWalk().review_id});break;
    case 'routeInsert':ui.routeInsert=index;render();sendMap();$('#routeConnectionDetails')?.scrollIntoView({block:'nearest'});break;
    case 'stepUp':if(index>0)[ui.steps[index-1],ui.steps[index]]=[ui.steps[index],ui.steps[index-1]];ui.routeInsert=ui.steps.length;render();sendMap();break;
    case 'stepDown':if(index<ui.steps.length-1)[ui.steps[index],ui.steps[index+1]]=[ui.steps[index+1],ui.steps[index]];ui.routeInsert=ui.steps.length;render();sendMap();break;
    case 'stepRemove':ui.steps.splice(index,1);if(index<ui.routeInsert)ui.routeInsert--;ui.routeInsert=Math.min(ui.routeInsert,ui.steps.length);render();sendMap();break;
    case 'viaConnection':case 'viaConnectionReverse':{
      const value=ui.routeConnection;if(!value)throw Error('층간 연결과 이동할 층을 선택하세요.');
      const [cid,a,b]=JSON.parse(value),c=state.connections.find(c=>c.id===cid),pair=action.endsWith('Reverse')?[b,a]:[a,b];
      if(!c||!connectionPath(c,...pair))throw Error('이 방향으로 사용할 수 없는 층간 연결입니다.');
      insertRouteStep({kind:'connection',connection_id:cid,from:pair[0],to:pair[1]});break;
    }
    case 'newRoute':resetEditor('route');break;
    case 'saveRoute':{const rid=ui.route||newId('ROUTE'),draft=routeDraft();const issues=routeSequenceIssues(draft,state,pointMap);if(issues.length)throw Error(issues[0].message);commit(s=>upsert(s.routes,updateRouteRecord(s.routes.find(r=>r.id===rid),{id:rid,name:f.name,from:f.from,to:f.to,via:routeStepsVia(draft,state),steps:structuredClone(ui.steps),direction:f.direction,status:f.status})),'경로 순서를 저장했습니다. 자동 길찾기는 활성화하지 않습니다.');ui.route=rid;render();break;}
    case 'editRoute':{const r=state.routes.find(r=>r.id===id);ui.route=id;ui.forms[tab]={...r};ui.steps=routeSteps(r,state,pointMap);ui.routeInsert=ui.steps.length;ui.routeConnection='';render();choose(state.endpoints.find(e=>e.id===r.from).access_id);break;}
    case 'deleteRoute':commit(s=>s.routes=s.routes.filter(r=>r.id!==id),'경로를 삭제했습니다.');resetEditor('route');break;
    case 'editFacility':{const record=state.facilities.find(f=>f.id===id);ui.facility=id;ui.forms[tab]={...record};render();if(record.access_id||record.source_id)choose(record.access_id||record.source_id);break;}
    case 'newFacility':resetEditor('facility');break;
    case 'facilityAccess':{const p=selectedWalk();ui.forms[tab].access_id=p.review_id;ui.forms[tab].floor=p.floor;render();break;}
    case 'facilityClearAccess':ui.forms[tab].access_id='';render();break;
    case 'facilitySource':{const id=state.facilities.find(f=>f.id===ui.facility)?.source_id;if(id)choose(id);else notify('기존 참고 좌표가 없습니다.');break;}
    case 'saveFacility':{const old=state.facilities.find(f=>f.id===ui.facility),fid=old?.id||newId('FAC');commit(s=>upsert(s.facilities,{id:fid,name:f.name,category:f.category,floor:f.floor||null,source_id:old?.source_id||null,access_id:f.access_id||null,notes:f.notes,hours:f.hours,contact:f.contact,active:old?.active??true,status:f.status}),'시설 정보를 저장했습니다.');ui.facility=fid;render();break;}
    case 'toggleFacility':commit(s=>{const f=s.facilities.find(f=>f.id===ui.facility);f.active=!f.active;},'시설 등록 상태를 변경했습니다. 지도 시설물 자체는 철거하지 않습니다.');break;
  }}
  $('#content').addEventListener('submit',e=>e.preventDefault());
  $('#content').addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b)try{perform(b.dataset.action,b);}catch(error){notify(error.message);}});
  $('#content').addEventListener('click',async e=>{if(!e.target.closest('[data-action=loadHourly]'))return;const originId=ui.origin;if(!originId)return notify('원점을 먼저 저장하세요.');remember();try{notify('시간대 원천값을 읽는 중…');ui.hourly[originId]=await load(`/__location_workbench/hourly?origin=${encodeURIComponent(originId)}`);if(tab==='origins'&&ui.origin===originId){remember();render();}notify('시간대 자료를 열었습니다. 원천연도·운행일은 그대로 유지됩니다.');}catch(error){notify(error.message);}});
  $('#content').addEventListener('change',async e=>{
    if(e.target.id==='wbOrigin'){remember();ui.origin=e.target.value;ui.forms.origins={};render();}
    if(e.target.id==='showInactive'){remember();ui.showInactive=e.target.checked;render();}
    if(e.target.id==='allFacilityFloors'){remember();ui.allFacilityFloors=e.target.checked;render();}
    if(e.target.id==='hourSourceDate'){ui.hourDay=e.target.value;remember();render();}
    if(e.target.name==='origin_ids'){remember();render();}
    if(tab==='connections'&&e.target.name==='kind'){
      remember();if(form().kind==='elevator'&&!ui.connectionStops.length)ui.connectionStops=[ui.connectionFrom,ui.connectionTo].filter(Boolean);
      if(form().kind==='elevator')ui.forms[tab].direction='both';render();sendMap();
    }
    if(tab==='routes'){remember();if(e.target.id==='routeConnection')ui.routeConnection=e.target.value;render();sendMap();}
    if(e.target.id==='observationImport'&&e.target.files[0])try{if(e.target.files[0].size>20_000_000)throw Error('20MB 이하 파일을 선택하세요.');const data=JSON.parse(await e.target.files[0].text());if(!Array.isArray(data.observations)||data.observations.length>100000)throw Error('인원 입력 양식을 확인하세요.');const records=data.observations.map(r=>validateObservation(r,new Set(state.origins.map(o=>o.id))));if(new Set(records.map(observationKey)).size!==records.length)throw Error('파일에 중복된 인원 항목이 있습니다.');commit(s=>{const merged=new Map(s.observations.map(r=>[observationKey(r),r]));for(const r of records)merged.set(observationKey(r),r);s.observations=[...merged.values()];},`${records.length}건을 입력했습니다.`);}catch(error){notify(error.message);}
  });
  $('[data-work-tab]').parentElement.addEventListener('click',e=>{const b=e.target.closest('[data-work-tab]');if(!b)return;remember();ui.areaMode=false;tab=b.dataset.workTab;query='';ui.limit=80;$('#wbSearch').value='';updateUrl();render();$('#content').scrollTop=0;sendMap();notify(`${TABS[tab]} 작업`);});
  $('#wbFloor').addEventListener('change',e=>{remember();floor=e.target.value;selected=null;ui.areaMode=false;ui.limit=80;updateUrl();render();sendMap(true);});
  $('#wbSearch').addEventListener('input',e=>{remember();query=e.target.value;ui.limit=80;render();});
  $('#wbGrid').addEventListener('change',()=>sendMap());$('#wbLabels').addEventListener('change',()=>sendMap());$('#wbOverview').addEventListener('click',()=>sendMap(true));
  $('#wbSave').addEventListener('click',save);$('#wbExport').addEventListener('click',()=>download({schema_version:1,site:'S202103',kind:'location_workbench_backup',exported_at:new Date().toISOString(),data:state},'서울역-위치경로-작업판.json'));
  $('#wbImport').addEventListener('change',async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>20_000_000)throw Error('20MB 이하 파일을 선택하세요.');const payload=JSON.parse(await file.text());if(payload.kind!=='location_workbench_backup'){if(payload.site==='S202103'&&payload.purpose==='point_hierarchy_review'){commit(s=>s.legacy_review=payload,'이전 검토안을 원문 보관했습니다. 새 작업판 항목은 별도로 지정하세요.');return;}throw Error('이 작업판에서 내보낸 백업을 선택하세요.');}const incoming=validateWorkbench(payload.data,context());if(!confirm('현재 작업안을 가져온 백업으로 교체할까요? 현재 상태도 파일로 내려받습니다.'))return;download({kind:'location_workbench_backup',data:state},'서울역-불러오기전-백업.json');state=incoming;ui.forms={};ui.origin=state.origins[0]?.id;ui.facility=state.facilities[0]?.id;ui.endpoint=ui.connection=ui.route=null;ui.routeConnection='';ui.steps=[];ui.routeInsert=0;ui.area=[];ui.connectionStops=[];ui.epAccess=ui.connectionFrom=ui.connectionTo=null;pendingSave();render();sendMap();notify('백업을 불러왔습니다.');}catch(error){notify(error.message);}finally{e.target.value='';}});
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  function loadMap(){ready=false;$('#mapStatus').textContent='3D 지도 연결 중';frame.src=`/app/?site=S202103&embed=catalog&pointReview=1&floor=${floor}${localScene?'&scene=local':''}`;$('#mapLink').href=frame.src;clearTimeout(waitingMap);waitingMap=setTimeout(()=>{if(!ready)$('#mapStatus').textContent='지도 연결 지연 · 재연결을 눌러주세요';},30000);}
  $('#reloadMap').addEventListener('click',loadMap);
  window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==frame.contentWindow)return;const d=e.data;if(d?.type==='station-one:catalog-map-ready'&&d.vworldReady){ready=true;clearTimeout(waitingMap);sendMap(true);}if(d?.type==='station-one:point-review-select')try{const link=tab==='routes'&&connectionMarkers().find(p=>p.review_id===d.id);if(link)selectRouteConnection(link.connection_id);else choose(d.id,false);}catch(error){notify(error.message);}if(d?.type==='station-one:point-review-layer-applied')$('#mapStatus').textContent=d.ok?`${d.floor} · ${d.count.toLocaleString()}점 · ${localScene?'로컬':'VWorld'} 지도`:'지도 표시 오류';});
}

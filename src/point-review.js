import { escapeHtml as esc, makeFocus, pointUrl, REVIEW_FLOORS } from './route-review-core.js';
import { POINT_LAYERS, buildPointRegister, filterPoints, mapFeature, areaDraft, validGeometry,assignPointRole } from './point-review-core.js';
import {entryFeatures,entryPoint} from './origin-entry-core.js';
import {createOriginAssignmentEditor} from './origin-assignment-editor.js';
import {isEntryTarget} from './origin-assignment-core.js';
import {attachRouteDraftEditor} from './route-draft-editor.js';
import {preserveScene} from './local-scene-mode.js';

export async function startPointReview() {
  const $=s=>document.querySelector(s),frame=$('#stationMap');
  const localScene=new URLSearchParams(location.search).get('scene')==='local';
  let points=[],grid=null,ready=false,selected=null,layer='',floor='2F',query='',limit=100,request=0,timer;
  let drafts=[],vertices=[],drawing=false,dirty=false,routeDirty=false,originDirty=false,draftSource=null,showReferences=false;
  let originData=null,originError='',originView=new URLSearchParams(location.search).get('origins')==='1';
  const roleDrafts=new Map();
  let originalPoints=new Map();
  const visible=new Set(Object.keys(POINT_LAYERS));
  const post=d=>frame.contentWindow.postMessage(d,location.origin);
  let routeEditor;
  document.title='서울역 주요 포인트 검토 · STATION ONE';
  $('.title h1').textContent='주요 포인트 검토';
  $('.review-head').innerHTML=`<div class="review-heading"><h2>먼저 위치, 그다음 경로</h2><span id="counts"></span></div>
    <p class="notice">① 전 층 바닥·계단 이동점 → ② 점 선택·역할 체크 → ③ 연결부·경로 검토<br><b>흰 점을 선택해 출도착·층간접속·시설로 지정하세요. 아직 확정 경로는 없습니다.</b></p>
    <nav class="origin-view-tabs" aria-label="포인트 검토 방식"><button id="pointView" aria-pressed="false">이동점·역할 검토</button><button id="originView" aria-pressed="false">원점별 진입 위치 · 48</button></nav>
    <div class="point-types">${Object.entries(POINT_LAYERS).map(([id,t])=>`<button data-kind="${id}" aria-pressed="false" style="--point-color:${t.color}"><i></i>${t.label}<b id="count-${id}">—</b></button>`).join('')}</div>
    <div class="filters"><label><span>포인트 검색</span><input id="pointSearch" type="search" placeholder="시설명, 모드, 포인트 ID"></label><label><span>표시층</span><select id="pointFloor">${['2F',...REVIEW_FLOORS.filter(f=>f!=='2F')].map(f=>`<option>${f}</option>`).join('')}</select></label></div>
    <div class="point-options"><button id="allKinds">네 종류 전체</button><button id="overview">층 전체 보기</button><label><input id="pointLabels" type="checkbox"> 이름 표시</label><label><input id="sourceReferences" type="checkbox"> 기존 POI 참고점</label></div>
    <details class="point-reference"><summary>기존 자료·경로안 참고 (연결 미확정)</summary><a href="?view=locations">유동인구 발생장소</a><a href="?view=nodes">기존 진입점 후보</a><a href="?view=destinations">매장·시설 목록</a><a href="?view=routes">기존 출도착 경로안</a></details>`;
  $('.review-pane footer').innerHTML='<span>미검수 · 경로 연결 대기</span><button id="exportReview">검토 데이터 받기 ↓</button>';
  const legend=document.createElement('div');legend.className='point-legend';legend.innerHTML=Object.entries(POINT_LAYERS).map(([id,t])=>`<label style="--point-color:${t.color}"><input type="checkbox" data-visible="${id}" checked><i></i>${t.label}</label>`).join('');
  $('.map-pane').append(legend);
  const sketch=document.createElement('div');sketch.className='point-sketch';sketch.hidden=true;sketch.innerHTML='<span id="sketchStatus"></span><button id="undoVertex">한 점 취소</button><button id="finishArea">영역 완성</button><button id="cancelArea">취소</button>';
  $('.map-pane').append(sketch);
  routeEditor=attachRouteDraftEditor({localScene,post,getPoints:()=>points,getGrid:()=>grid,getSelected:()=>selected,onDirty:()=>{dirty=routeDirty=true;},select:id=>select(id),status:s=>status(s)});
  const originEditor=createOriginAssignmentEditor({getData:()=>originData,getPoints:()=>points,getGrid:()=>grid,getFloor:()=>floor,select:id=>select(id),onDirty:()=>{dirty=originDirty=true;},status:s=>status(s),onChange:()=>{
    selected=originEditor.selectedPoint()||null;render();renderOriginSelection();sendLayers();
  }});
  const originGuide=document.createElement('div');originGuide.className='origin-map-guide';originGuide.hidden=true;originGuide.textContent='초록: 역사 진입 후보 · 흰색: 직접 선택용 이동점 · 외부 원점은 목록에서만 확인';$('.map-pane').append(originGuide);
  const all=()=>originView?originEditor.mapPoints():[...points.filter(p=>p.record_kind!=='source_reference'||showReferences),...drafts];
  const status=s=>$('#mapStatus').textContent=s;
  function sendLayers(overview=false){
    if(!ready)return;
    const features=all().filter(p=>p.floor===floor&&(originView||visible.has(p.layer))).map(mapFeature).filter(Boolean);
    post({type:'station-one:point-review-layer',requestId:++request,floor,features,selected:selected?.review_id,labels:$('#pointLabels').checked,overview});
    if(originView)post({type:'station-one:route-draft-lines',floor,lines:[]});else routeEditor.renderMap(floor);
  }
  function render(){
    document.body.classList.toggle('origin-assignment-mode',originView);
    $('.route-draft-editor').hidden=originView;legend.hidden=originView;originGuide.hidden=!originView;
    $('.review-heading h2').textContent=originView?'원점별 진입점 지정':'먼저 위치, 그다음 경로';
    $('.review-head .notice').textContent=originView?'원점 선택 → 지도에서 진입점 확인 → 이 원점에 지정':'전 층 이동점에서 역할을 지정한 뒤 연결부·경로를 검토하세요. 아직 확정 경로는 없습니다.';
    $('.filters label>span').textContent=originView?'원점 검색':'포인트 검색';
    $('#pointSearch').placeholder=originView?'원점명, 교통수단, 원점 ID':'시설명, 모드, 포인트 ID';
    $('#exportReview').textContent=originView?'검토안 파일 저장 ↓':'검토 데이터 받기 ↓';
    $('.review-pane footer>span').textContent=dirty?'변경 있음 · 파일로 보관 필요':'임시 검토안 · 서버 미저장';
    const rows=filterPoints(all(),{floor,layer,query});
    $('#counts').textContent=`${floor} · ${rows.length} 후보 · 역할 지정 ${roleDrafts.size}`;
    for(const id of Object.keys(POINT_LAYERS))$(`#count-${id}`).textContent=all().filter(p=>p.floor===floor&&p.layer===id).length;
    document.querySelectorAll('[data-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===layer)));
    $('#originView').setAttribute('aria-pressed',String(originView));$('#pointView').setAttribute('aria-pressed',String(!originView));
    $('.point-types').hidden=originView;
    if(originView){
      $('#counts').textContent=originData?`${originData.origins.length}개 원점 · 지도 ${floor}`:'원점 자료 연결 필요';
      if(originData){
        const activeId=document.activeElement?.id,scroll=$('#content').scrollTop;
        originEditor.render($('#content'),query);
        if(['originSelect','onlyPendingOrigins','originGrid','nextOrigin','previousOrigin','assignOriginEntry'].includes(activeId))document.getElementById(activeId)?.focus({preventScroll:true});
        $('#content').scrollTop=scroll;
      }else $('#content').innerHTML=`<p class="check">원점 자료를 열지 못했습니다. ${esc(originError)} 이동점·역할 검토는 이용할 수 있습니다.</p>`;
      return;
    }
    const missing=all().filter(p=>!mapFeature(p)).length;
    $('#content').innerHTML=`<div class="point-explanation"><b>${layer?POINT_LAYERS[layer].label:'주요 포인트 4종'}</b><p>${layer?POINT_LAYERS[layer].description:'초록 = 출도착, 흰색 = 경유 격자, 청색 = 층간접속, 노랑 = 시설. 지도 범례에서 각 종류를 켜고 끌 수 있습니다.'}</p></div>
      <p class="check">${grid?.floors?.[floor]?.points?`${floor} 평지 ${grid.floors[floor].floor_grid_points}개 (${grid.spacing_m}m) · 계단·ES 이동면 ${grid.floors[floor].tread_points}개 (${grid.tread_spacing_m}m). 철거 시설은 장애물에서 제외했습니다. 높이·통행성·운행 방향은 검토 대상입니다.`:'이 층은 확인 가능한 보행 바닥이 없습니다. 지붕이나 빈 공간에 임의의 점을 생성하지 않습니다.'}</p>
      <div class="area-actions"><button id="newArea">출도착 영역 검토안 그리기</button><label class="file-button">역할·영역 검토안 불러오기<input id="importArea" type="file" accept="application/json,.json"></label><p>역할 체크·영역은 임시 검토안입니다. 서버 저장이 아니므로 새로고침 전에 ‘검토 데이터 받기’로 보관하세요.</p></div>
      <div class="point-list-cards">${rows.slice(0,limit).map(p=>{
        const type=POINT_LAYERS[p.layer],available=p.geometry||makeFocus(p);
        return `<article class="point-card" style="--point-color:${type.color}"><div class="point-meta"><i></i>${type.label}<span>${p.geometry?.type==='Polygon'?'영역 · 임시 검토안':p.layer==='waypoint'?'모델 검사 후보':'위치 후보 · 미검수'}</span></div><button data-select="${esc(p.review_id)}" ${available?'':'disabled'}>${esc(p.label)}</button><small>${esc(p.review_id)} · ${esc(p.floor||'층 미확인')}</small><p>${esc(p.required_check)}</p>${p.layer==='connector'?'<p class="point-fields">위치 유형: 시설 POI / 랜딩 미확정<br>연결 층·상대 랜딩·이동 방향: 미지정</p>':''}${p.layer==='od'?`<p class="point-fields">${p.modes?.length?`출도착 모드: ${p.modes.map(esc).join(', ')}<br>`:''}형태: ${p.geometry?.type==='Polygon'?'영역':'점 후보 (영역 전환 가능)'} / 역할: 출발·도착<br>접속점 후보: ${p.entry_node_ids?.map(esc).join(', ')||'미지정'}</p>`:''}${p.layer==='facility'?'<p class="point-fields">시설 위치 ≠ 보행 출입구 / 경유점 접속: 미지정</p>':''}</article>`;
      }).join('')||'<p class="list-help">이 조건에 해당하는 후보가 없습니다.</p>'}</div>
      ${rows.length>limit?`<button id="morePoints">다음 100개 보기 (${Math.min(limit,rows.length)} / ${rows.length})</button>`:''}
      <details class="secondary"><summary>좌표·층 미확인 ${missing}개 / 전 층 검사 내역</summary><p>층 또는 높이가 없는 대표점은 지도에 임의로 찍지 않습니다.</p>${Object.entries(grid?.floors||{}).map(([f,s])=>`<p>${esc(f)}: 평지 ${s.floor_grid_points} · 계단/ES ${s.tread_points} · 철거 제외 삼각형 ${s.retired_triangles}${s.status==='floor_geometry_unavailable'?' · 보행 바닥 자료 없음':''}</p>`).join('')}${all().filter(p=>!mapFeature(p)).map(p=>`<p>${esc(p.review_id)} · ${esc(p.label)} · ${esc(p.floor||'층 미지정')}</p>`).join('')}<p>${(grid?.limitations||[]).map(esc).join('<br>')}</p><a href="/data/route-review/grid-all.json" download>전 층 격자 생성 근거 받기</a></details>
      <p class="list-help">영역의 중심이나 시설 중심을 보행점으로 연결하지 않습니다. 출도착 영역의 출입점, 시설 출입점, 층간 랜딩을 검수한 뒤 경유 격자와 연결합니다.</p>`;
  }
  function select(id,{move=true}={}){
    const p=[...points,...drafts].find(p=>p.review_id===id||p.aliases?.includes(id))||entryPoint(originData,id);if(!p)return;
    if(originView&&!isEntryTarget(p))return;
    selected=p;
    if(originView)originEditor.selectionChanged(p);else routeEditor.selectionChanged(p);
    const f=makeFocus(p),type=POINT_LAYERS[p.layer];
    // Reference-only camera defaults must not be overwritten by the previous floor's layer message.
    // This changes the display floor only; missing source floors/heights remain unknown.
    const displayFloor=f?.floor||p.floor;
    if(REVIEW_FLOORS.includes(displayFloor)&&floor!==displayFloor){floor=displayFloor;$('#pointFloor').value=floor;render();}
    if(originView){
      render();renderOriginSelection();
      if(f){$('#mapLink').href=preserveScene(pointUrl(p,location.origin));if(move)focus(f);}
      const u=new URL(location.href);u.hash=id;history.replaceState(null,'',u);sendLayers();return;
    }
    $('#selection').innerHTML=`<small style="color:${type.color}">${esc(type.label)} · ${esc(id)}</small><h2>${esc(p.label)}</h2><p>${esc(p.required_check)}</p><div class="coordinate">${p.geometry?.type==='Polygon'?`${p.geometry.coordinates[0].length-1}개 꼭짓점 · 연결 출입점 미지정`:p.lon!=null?`${p.lon.toFixed(8)}, ${p.lat.toFixed(8)}`:'좌표 미확인'}</div>${f?'<button id="refocus">선택 위치로 이동</button>':''}${p.layer==='od'?'<button id="areaForSelected">이 출도착점의 영역 검토안</button>':''}`;
    if(f){$('#mapLink').href=preserveScene(pointUrl(p,location.origin));$('#refocus').addEventListener('click',()=>focus(f));if(move)focus(f);}
    if(p.record_kind==='walk_point'){
      const editor=document.createElement('div');editor.className='point-role-editor';
      editor.innerHTML=`<label>포인트 이름<input id="roleLabel" maxlength="120" value="${esc(p.label)}"></label><fieldset><legend>이동점 역할 (검토안)</legend>${Object.entries(POINT_LAYERS).map(([id,t])=>`<label style="--point-color:${t.color}"><input type="radio" name="pointRole" value="${id}" ${p.layer===id?'checked':''}>${t.label}</label>`).join('')}</fieldset><label>연관 참고점<select id="roleReference"><option value="">미지정</option>${points.filter(q=>q.record_kind==='source_reference'&&q.floor===p.floor).map(q=>`<option value="${esc(q.review_id)}" ${p.linked_reference_id===q.review_id?'selected':''}>${esc(q.label)}</option>`).join('')}</select></label><button id="applyRole">역할 체크 반영</button><small>임시 검토안 · 연결 층/상대 랜딩/방향 미확정</small>`;
      $('#selection').append(editor);
      if(roleDrafts.has(p.review_id)){
        const reset=document.createElement('button');reset.textContent='이 점 역할 체크 취소';
        reset.addEventListener('click',()=>{points[points.findIndex(q=>q.review_id===p.review_id)]=originalPoints.get(p.review_id);roleDrafts.delete(p.review_id);dirty=roleDrafts.size>0||drafts.length>0||routeDirty||originDirty;render();select(p.review_id,{move:false});status('이 점을 기본 이동점으로 되돌렸습니다.');});editor.append(reset);
      }
      $('#applyRole').addEventListener('click',()=>{try{
        const source=$('#roleReference').value||null,next=assignPointRole(p,$('input[name="pointRole"]:checked').value,{label:$('#roleLabel').value,source_id:source});
        points[points.findIndex(q=>q.review_id===p.review_id)]=next;
        roleDrafts.set(p.review_id,{review_id:p.review_id,layer:next.layer,label:next.label,source_id:source});
        visible.add(next.layer);legend.querySelector(`[data-visible="${next.layer}"]`).checked=true;
        dirty=true;render();select(p.review_id,{move:false});status('역할 체크 반영 · 임시 검토안을 내려받아 보관하세요.');
      }catch(error){status(error.message);}});
    }
    $('#areaForSelected')?.addEventListener('click',()=>beginArea(selected?.layer==='od'&&selected.floor===floor?selected:null));
    const u=new URL(location.href);u.hash=id;history.replaceState(null,'',u);sendLayers();
  }
  function renderOriginSelection(){
    const p=originEditor.selectedPoint();
    $('#selection').innerHTML=`<small>원점: ${esc(originEditor.currentOrigin()?.name||'선택 필요')}</small><h2>${p?esc(p.label):'진입 후보를 선택하세요'}</h2><p>${p?`${esc(p.floor)} · 위치 확인 후 오른쪽에서 지정`:'오른쪽 원점 목록에서 시작하세요.'}</p>${p?'<button id="refocus">선택 위치로 이동</button>':''}`;
    $('#refocus')?.addEventListener('click',()=>{const f=makeFocus(p);if(f)focus(f);});
  }
  function focus(f){
    if(!ready){status('지도 준비 중 · 선택 위치 대기');return;}
    post({type:f.catalog?'station-one:catalog-focus':'station-one:route-review-focus',requestId:++request,focus:f});
  }
  function beginArea(source=null){
    if(!ready){status('3D 지도가 연결된 후 영역을 그릴 수 있습니다.');return;}
    draftSource=source;vertices=[];drawing=true;sketch.hidden=false;
    post({type:'station-one:point-review-draw',enabled:true});
    updateSketch();
  }
  function updateSketch(){
    $('#sketchStatus').textContent=`${floor} 바닥에서 경계 선택 · ${vertices.length}점 / ${vertices.length<3?'3점 이상 필요':'완성 가능'} · 서버 미저장`;
    $('#finishArea').disabled=vertices.length<3;$('#undoVertex').disabled=!vertices.length;
    post({type:'station-one:point-review-sketch',vertices});
  }
  function endArea(){drawing=false;vertices=[];sketch.hidden=true;post({type:'station-one:point-review-draw',enabled:false});sendLayers();}
  $('#finishArea').addEventListener('click',()=>{
    try{
      const origin=draftSource;
      const p=areaDraft(vertices,{id:`OD-AREA-${Date.now()}`,label:`${origin?.label||floor+' 출도착'} 영역 검토안`,floor,source_id:origin?.review_id});
      drafts.push(p);dirty=true;endArea();render();select(p.review_id,{move:false});status('영역 검토안 생성 · 새로고침 전에 데이터 받기로 보관하세요.');
    }catch(e){status(e.message);}
  });
  $('#undoVertex').addEventListener('click',()=>{vertices.pop();updateSketch();});
  $('#cancelArea').addEventListener('click',endArea);
  $('#content').addEventListener('click',e=>{
    const b=e.target.closest('[data-select]');if(b){select(b.dataset.select);return;}
    if(e.target.closest('#newArea'))beginArea(null);
    if(e.target.closest('#morePoints')){limit+=100;render();}
  });
  $('#content').addEventListener('change',async e=>{
    if(e.target.id!=='importArea'||!e.target.files?.[0])return;
    try{
      if(e.target.files[0].size>20_000_000)throw Error('20MB 이하의 검토 파일을 선택하세요.');
      const d=JSON.parse(await e.target.files[0].text());
      const routeImport=routeEditor.validateImport(d);
      const originImport=originEditor.validateImport(d);
      if(d.site!=='S202103'||!Array.isArray(d.area_drafts)||d.area_drafts.length>100)throw Error('서울역 영역 검토안 파일이 아닙니다.');
      const roles=d.role_drafts||[];
      if(!Array.isArray(roles)||roles.length>30000)throw Error('역할 검토안 형식이 올바르지 않습니다.');
      if(roles.length&&d.source_revision!==grid?.source_revision)throw Error('격자 생성 버전이 다릅니다. 위치를 다시 검토해야 합니다.');
      const roleUpdates=roles.map(r=>{const p=points.find(q=>q.review_id===r.review_id);if(!p)throw Error('알 수 없는 이동점 ID');if(r.source_id&&!points.some(q=>q.record_kind==='source_reference'&&q.review_id===r.source_id&&q.floor===p.floor))throw Error('연관 참고점이 올바르지 않습니다.');return [r,assignPointRole(p,r.layer,{label:r.label,source_id:r.source_id})];});
      const importedPoints=new Map(points.map(p=>[p.review_id,p]));for(const [,p] of roleUpdates)importedPoints.set(p.review_id,p);
      const imported=d.area_drafts.map((p,i)=>{
        if(p.layer!=='od'||p.geometry?.type!=='Polygon'||!validGeometry(p.geometry))throw Error('유효하지 않은 영역이 포함되어 있습니다.');
        const source=importedPoints.get(p.source_ids?.[0]);
        return areaDraft(p.geometry.coordinates[0].slice(0,-1),{id:`OD-AREA-${Date.now()}-${i}`,label:String(p.label||'불러온 영역').slice(0,120),floor:p.floor,source_id:source?.layer==='od'&&source.floor===p.floor?source.review_id:null});
      });
      for(const [r,p] of roleUpdates){points[points.findIndex(q=>q.review_id===p.review_id)]=p;roleDrafts.set(p.review_id,r);}
      drafts.push(...imported);dirty=true;
      routeEditor.applyImport(routeImport);originEditor.applyImport(originImport);if(originImport)originDirty=true;
      render();sendLayers();if(selected)select(selected.review_id,{move:false});status(`원점 지정 ${originImport?.assignments.length||0}개 · 역할 ${roles.length}개 · 영역 ${imported.length}개 불러옴 · 미검수`);
    }catch(error){status(`불러오기 실패: ${error.message}`);}
  });
  function download(){
    const payload={schema_version:2,site:'S202103',purpose:'point_hierarchy_review',routing_enabled:false,source_revision:grid?.source_revision,
      exported_at:new Date().toISOString(),layers:POINT_LAYERS,role_drafts:[...roleDrafts.values()],area_drafts:drafts,connections:[],
      origin_entry_review:originData,
      origin_entry_assignments:originEditor.exportDrafts(),
      route_configuration:routeEditor.exportDrafts(),
      note:'위치 검토 자료입니다. 영역 경계·통행성·상대 랜딩·접속점은 사용자가 검수해야 합니다. 원점별 진입 후보는 별도 참고표이며 인원 배분은 미승인입니다.'};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='seoul-point-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    dirty=routeDirty=originDirty=false;render();status('검토 데이터 내려받기 요청됨 · 다운로드 폴더에서 파일을 확인하세요.');
  }
  $('#exportReview').addEventListener('click',()=>{try{download();}catch(e){status(e.message);}});
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  function changeView(origins){
    if(drawing)endArea();originView=origins;query='';$('#pointSearch').value='';selected=null;const u=new URL(location.href);u.hash='';origins?u.searchParams.set('origins','1'):u.searchParams.delete('origins');history.replaceState(null,'',u);render();if(origins){selected=originEditor.selectedPoint()||null;renderOriginSelection();}else $('#selection').innerHTML='<h2>지도에서 이동점을 선택하세요</h2>';sendLayers(true);
  }
  $('#originView').addEventListener('click',()=>changeView(true));
  $('#pointView').addEventListener('click',()=>changeView(false));
  $('.point-types').addEventListener('click',e=>{const b=e.target.closest('[data-kind]');if(b){layer=b.dataset.kind;limit=100;render();}});
  $('#allKinds').addEventListener('click',()=>{layer='';limit=100;changeView(false);});
  $('#pointSearch').addEventListener('input',e=>{query=e.target.value;limit=100;render();});
  $('#pointFloor').addEventListener('change',e=>{
    if(drawing)endArea();floor=e.target.value;selected=null;limit=100;
    if(originView)originEditor.selectionChanged(null);
    $('#selection').innerHTML=`<small>${esc(floor)} 위치 검토</small><h2>지도에서 이동점을 선택하세요</h2>`;
    $('#mapLink').href=preserveScene(`/app/?site=S202103&embed=catalog&pointReview=1&floor=${floor}`);
    const u=new URL(location.href);u.hash='';history.replaceState(null,'',u);render();if(originView)renderOriginSelection();sendLayers(true);
  });
  $('#pointLabels').addEventListener('change',()=>sendLayers());
  $('#sourceReferences').addEventListener('change',e=>{showReferences=e.target.checked;limit=100;render();sendLayers();});
  $('#overview').addEventListener('click',()=>sendLayers(true));
  legend.addEventListener('change',e=>{const id=e.target.dataset.visible;if(id){e.target.checked?visible.add(id):visible.delete(id);sendLayers();}});
  function loadMap(){
    ready=false;clearTimeout(timer);if(drawing)endArea();status('3D 지도 준비 중 · 포인트 레이어 대기');
    frame.src=`/app/?site=S202103&embed=catalog&pointReview=1&floor=${floor}${localScene?'&scene=local':''}`;
    timer=setTimeout(()=>{if(!ready)status('지도 연결 지연 · 지도 재연결을 눌러주세요.');},30000);
  }
  $('#reloadMap').addEventListener('click',loadMap);
  window.addEventListener('message',e=>{
    if(e.origin!==location.origin||e.source!==frame.contentWindow)return;
    const d=e.data;
    if(d?.type==='station-one:catalog-map-ready'&&d.vworldReady){ready=true;clearTimeout(timer);sendLayers(true);if(selected)select(selected.review_id);}
    if(d?.type==='station-one:point-review-layer-applied')status(d.ok?`${d.floor} · ${d.count}개 후보 표시 · 확정 경로 없음`:'표시 데이터 오류 · 다시 연결해주세요.');
    if(d?.type==='station-one:point-review-select')select(d.id,{move:false});
    if(d?.type==='station-one:point-review-vertex'&&drawing&&d.floor===floor){if(vertices.length<100){vertices.push(d.coordinate);updateSketch();}}
    if(d?.type==='station-one:point-review-draw-error')status(d.message);
  });
  try{
    const load=async path=>{const r=await fetch(path);if(!r.ok)throw Error(`${path}: ${r.status}`);return r.json();};
    const [data,dest,g,origins]=await Promise.all([load('/data/route-review/register.json'),load('/data/route-review/destinations.json'),load('/data/route-review/grid-all.json').catch(()=>null),load('/data/route-review/origin-entries.json').catch(e=>{originError=e.message;return null;})]);
    originData=origins;grid=g;points=[...buildPointRegister(data.register,dest,grid),...(originData?entryFeatures(originData):[])];originalPoints=new Map(points.map(p=>[p.review_id,p]));render();if(originView)renderOriginSelection();loadMap();
    routeEditor.dataReady(originData);
    const initial=decodeURIComponent(location.hash.slice(1));if(points.some(p=>p.review_id===initial||p.aliases?.includes(initial)))select(initial,{move:false});
    if(!grid)status('격자 자료를 불러오지 못했습니다. 다른 세 종류의 후보는 확인할 수 있습니다.');
  }catch(e){$('#content').textContent=`포인트 자료를 열지 못했습니다. ${e.message}`;status('자료 연결 실패');}
}

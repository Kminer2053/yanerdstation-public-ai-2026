import {escapeHtml as esc} from './route-review-core.js';
import {routeDraft,entryBinding,importRouteConfiguration} from './route-draft-core.js';

export function attachRouteDraftEditor({localScene,post,getPoints,getGrid,getSelected,onDirty,select,status}){
  const panel=document.createElement('details');panel.className='route-draft-editor';panel.open=localScene;
  panel.innerHTML=`<summary>${localScene?'로컬 3D · ':''}진입점·경로 설정</summary>
    <p>${localScene?'보관한 3D 원본으로 작업합니다. 브이월드 연결은 필요하지 않습니다.':'지도에서 선택한 이동점으로 검토안을 만듭니다.'} <b>확정·자동 길찾기에는 반영되지 않습니다.</b></p>
    <div class="draft-grid"><label>연결할 진입 후보<select id="bindEntry"><option value="">자료 준비 중</option></select></label><button id="bindSelected" disabled>선택 이동점을 진입점으로 연결</button></div>
    <div id="entryBindings"></div>
    <hr><label>경로 이름<input id="draftRouteName" maxlength="120" placeholder="예: 동쪽 출입구 → 맞이방"></label>
    <div class="draft-grid"><label>연결 종류<select id="draftRouteKind"><option value="walk">같은 층 보행</option><option value="stairs">층간 · 계단</option><option value="escalator">층간 · 에스컬레이터</option><option value="elevator">층간 · 엘리베이터</option></select></label><label>방향<select id="draftDirection"><option value="both">양방향</option><option value="forward">선택 순서 단방향</option></select></label></div>
    <p id="draftSelected">지도에서 흰 이동점을 선택하세요.</p>
    <div class="draft-buttons"><button id="addRoutePoint" disabled>선택점을 경로에 추가</button><button id="undoRoutePoint">마지막 점 취소</button><button id="clearRoute">구성 비우기</button></div>
    <ol id="draftRoutePoints"></ol><button id="storeRoute" disabled>경로 검토안 보관</button>
    <div id="savedRoutes"></div><p class="draft-warning">보라색 점선은 검토용 직선 연결입니다. 벽·장애물 통과 여부, 층간 랜딩과 운영 방향은 아직 미검수입니다. 새로고침 전 하단 ‘검토 데이터 받기’로 파일을 저장하세요.</p>`;
  document.querySelector('.review-head').after(panel);
  let entries=[],chain=[],routes=[],bindings=[],floor='2F';
  const $=s=>panel.querySelector(s);
  const safe=fn=>{try{fn();}catch(e){status(e.message);}};
  const getPoint=id=>getPoints().find(p=>p.review_id===id);
  function map(){
    const byId=new Map(getPoints().map(p=>[p.review_id,p]));
    const lines=[...routes,...(chain.length>1?[{id:'working',point_ids:chain}]:[])].flatMap(r=>{
      const ps=r.point_ids.map(id=>byId.get(id));return ps.slice(1).flatMap((p,i)=>p?.floor===floor&&ps[i]?.floor===floor?[{id:`${r.id}-${i}`,coordinates:[ps[i].geometry.coordinates,p.geometry.coordinates]}]:[]);
    });
    post({type:'station-one:route-draft-lines',floor,lines});
  }
  function render(){
    $('#draftRoutePoints').innerHTML=chain.map((id,i)=>`<li><button data-draft-focus="${esc(id)}">${i+1}. ${esc(getPoint(id)?.label||id)}</button></li>`).join('');
    $('#storeRoute').disabled=chain.length<2;
    $('#savedRoutes').innerHTML=routes.map(r=>`<div class="draft-record"><b>${esc(r.label)}</b><small>${r.point_ids.length}점 · ${esc(r.kind)} · ${r.direction==='both'?'양방향':'단방향'} · 미검수</small><button data-edit-route="${esc(r.id)}">불러와 편집</button><button data-remove-route="${esc(r.id)}">삭제</button></div>`).join('');
    $('#entryBindings').innerHTML=bindings.map(b=>`<div class="draft-record"><b>${esc(entries.find(e=>e.id===b.entry_id)?.label||b.entry_id)}</b><button data-draft-focus="${esc(b.point_id)}">${esc(b.point_id)}</button><button data-remove-binding="${esc(b.entry_id)}">연결 취소</button></div>`).join('');
    map();
  }
  let editingId=null;
  $('#bindSelected').onclick=()=>safe(()=>{
    const b=entryBinding($('#bindEntry').value,getSelected()?.review_id,entries,getPoints());
    bindings=bindings.filter(x=>x.entry_id!==b.entry_id).concat(b);onDirty();render();status('진입 위치 연결 검토안 반영 · 원본 좌표·유동인구 수치는 변경하지 않았습니다.');
  });
  $('#addRoutePoint').onclick=()=>safe(()=>{
    const p=getSelected();if(p?.record_kind!=='walk_point')throw Error('바닥·계단 이동점을 먼저 선택하세요.');
    if(chain.includes(p.review_id)||chain.length>=200)throw Error('중복점 또는 200개 초과는 추가할 수 없습니다.');
    chain.push(p.review_id);onDirty();render();status(`경로 구성 ${chain.length}점 · 완료 후 경로 검토안 보관을 누르세요.`);
  });
  $('#undoRoutePoint').onclick=()=>{chain.pop();render();};
  $('#clearRoute').onclick=()=>{chain=[];editingId=null;render();};
  $('#storeRoute').onclick=()=>safe(()=>{
    const r=routeDraft({id:editingId||`DRAFT-${crypto.randomUUID()}`,label:$('#draftRouteName').value,point_ids:chain,kind:$('#draftRouteKind').value,direction:$('#draftDirection').value},getPoints());
    if(!editingId&&routes.length>=100)throw Error('한 검토 파일에 최대 100개의 경로안을 보관할 수 있습니다.');
    routes=routes.filter(x=>x.id!==r.id).concat(r);chain=[];editingId=null;onDirty();render();status('경로 검토안 보관됨 · 파일 내려받기로 저장하세요. 실제 경로는 활성화하지 않았습니다.');
  });
  panel.addEventListener('click',e=>safe(()=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.draftFocus)select(b.dataset.draftFocus);
    if(b.dataset.removeRoute){routes=routes.filter(r=>r.id!==b.dataset.removeRoute);onDirty();render();}
    if(b.dataset.removeBinding){bindings=bindings.filter(r=>r.entry_id!==b.dataset.removeBinding);onDirty();render();}
    if(b.dataset.editRoute){const r=routes.find(x=>x.id===b.dataset.editRoute);chain=[...r.point_ids];editingId=r.id;$('#draftRouteName').value=r.label;$('#draftRouteKind').value=r.kind;$('#draftDirection').value=r.direction;render();}
  }));
  return {
    dataReady(data){entries=data?.entries||[];$('#bindEntry').innerHTML='<option value="">진입 후보 선택</option>'+entries.filter(e=>e.map_eligible).map(e=>`<option value="${esc(e.id)}">${esc(e.point.floor)} · ${esc(e.label)}</option>`).join('');render();},
    selectionChanged(p){$('#draftSelected').textContent=`선택: ${p.label} · ${p.floor||'층 미확인'}`;$('#addRoutePoint').disabled=$('#bindSelected').disabled=p.record_kind!=='walk_point';},
    renderMap(value){floor=value;map();},
    exportDrafts(){if(chain.length)throw Error('구성 중인 경로를 먼저 보관하거나 비워주세요.');return {schema_version:1,source:localScene?'local-snapshot':'live',routes,entry_bindings:bindings,routing_enabled:false};},
    validateImport(payload){return payload.route_configuration?importRouteConfiguration(payload,{grid:getGrid(),entries,points:getPoints()}):null;},
    applyImport(d){if(!d)return;routes=d.routes;bindings=d.entry_bindings;chain=[];editingId=null;onDirty();render();},
  };
}

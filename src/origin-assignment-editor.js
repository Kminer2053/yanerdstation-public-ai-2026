import {escapeHtml as esc} from './route-review-core.js';
import {filterOrigins} from './origin-entry-core.js';
import {isEntryTarget,validateOriginAssignments,assignOriginPoint} from './origin-assignment-core.js';

export function createOriginAssignmentEditor({getData,getPoints,getGrid,getFloor,select,onChange,onDirty,status}){
  let originId=null,pickedId=null,assignments=[],showGrid=false,onlyPending=false;
  const context=()=>({origins:getData()?.origins||[],points:getPoints(),sourceRevision:getGrid()?.source_revision});
  const current=()=>getData()?.origins.find(o=>o.id===originId);
  const assignedIds=()=>assignments.find(r=>r.origin_id===originId)?.point_ids||[];
  const pointFor=id=>getPoints().find(p=>p.review_id===id);
  const refresh=()=>onChange();
  function chooseOrigin(id){
    if(!getData()?.origins.some(o=>o.id===id))return;
    originId=id;pickedId=null;refresh();
    status('원점을 선택했습니다. 진입 후보를 누르거나 지도에서 위치를 고르세요.');
  }
  function choosePoint(id){select(id);}
  function render(container,query=''){
    const data=getData();if(!data)return;
    const origins=filterOrigins(data,{query}).filter(o=>!onlyPending||!assignments.some(r=>r.origin_id===o.id));
    if(!originId)originId=data.origins[0]?.id;
    const origin=current(),ids=assignedIds(),picked=pointFor(pickedId),entries=new Map(data.entries.map(e=>[e.id,e]));
    const candidates=origin?.entry_ids.map(id=>entries.get(id)).filter(Boolean)||[];
    const alternatives=getPoints().filter(p=>p.record_kind==='entry_candidate'&&p.floor===getFloor()&&isEntryTarget(p));
    const index=data.origins.findIndex(o=>o.id===originId);
    const pointButton=(id,extra='')=>{const p=pointFor(id);return `<button data-entry-pick="${esc(id)}" class="entry-choice ${pickedId===id?'active':''}"><span>${esc(p?.label||id)}</span><small>${esc(p?.floor||'')} · ${esc(id)}${extra}</small></button>`;};
    container.innerHTML=`<section class="origin-picker" aria-labelledby="originStep1">
      <div class="origin-step-title"><h3 id="originStep1">1. 유동인구 원점 선택</h3><span id="originProgress">${assignments.length} / ${data.origins.length} 지정</span></div>
      <label class="pending-filter"><input id="onlyPendingOrigins" type="checkbox" ${onlyPending?'checked':''}> 미지정 원점만 보기 <small>검색 결과 ${origins.length}개</small></label>
      <select id="originSelect" size="4" aria-label="유동인구 원점 목록">${origins.map(o=>`<option value="${esc(o.id)}" ${o.id===originId?'selected':''}>${assignments.some(r=>r.origin_id===o.id)?'✓':'○'} ${esc(o.name)} · ${esc(o.mode_label)}</option>`).join('')}</select>
      ${!origins.length?'<p class="origin-help">조건에 맞는 원점이 없습니다. 검색어나 미지정 필터를 바꾸세요.</p>':''}
      <div class="origin-current"><small>현재 작업 원점 · ${index+1} / ${data.origins.length}</small><h2>${esc(origin?.name||'원점 없음')}</h2><p>${esc(origin?.mode_label||'')} · ${esc(originId||'')}</p></div>
      <div class="origin-paging"><button id="previousOrigin" ${index<=0?'disabled':''}>← 이전 원점</button><button id="nextOrigin" ${index>=data.origins.length-1?'disabled':''}>다음 원점 →</button></div>
    </section>
    <section class="origin-entry-step" aria-labelledby="originStep2"><div class="origin-step-title"><h3 id="originStep2">2. 역사 진입점 선택</h3><span>지도와 연결</span></div>
      <p class="origin-help">추천 후보는 아직 지정된 위치가 아닙니다. 후보를 눌러 지도를 확인한 뒤 아래 버튼으로 지정하세요.</p>
      <div class="origin-suggestions">${candidates.filter(e=>e.map_eligible&&isEntryTarget(pointFor(e.id))).map(e=>pointButton(e.id,' · 추천 후보')).join('')||'<p class="origin-help">위치가 확인된 추천 후보가 없습니다. 다른 진입점이나 실제 지도 격자에서 선택하세요.</p>'}</div>
      <label class="other-entry-label">다른 진입점 선택 · ${esc(getFloor())}<select id="otherEntry"><option value="">이 층의 진입 후보 ${alternatives.length}개</option>${alternatives.map(p=>`<option value="${esc(p.review_id)}">${esc(p.label)} · ${esc(p.review_id)}</option>`).join('')}</select></label>
      <label class="direct-grid"><input id="originGrid" type="checkbox" ${showGrid?'checked':''}> 격자에서 직접 선택 <small>흰 이동점을 클릭</small></label>
      <div class="origin-picked" id="originPicked" aria-live="polite"><small>현재 선택한 진입점</small>${picked?`<strong>${esc(picked.label)}</strong><p>${esc(picked.floor)} · ${esc(picked.review_id)}</p>`:'<strong>아직 선택하지 않았습니다</strong><p>위의 후보 또는 지도 위 점을 선택하세요.</p>'}
        <button id="assignOriginEntry" ${!picked||ids.includes(pickedId)?'disabled':''}>${ids.includes(pickedId)?'이 원점에 지정됨':'이 원점의 진입점으로 지정'}</button>
      </div>
    </section>
    <section class="origin-assigned" aria-labelledby="originStep3"><div class="origin-step-title"><h3 id="originStep3">3. 지정된 진입점</h3><span>${ids.length}개 · 검토안</span></div>
      <div id="assignedOriginEntries">${ids.map(id=>`<div class="assigned-entry">${pointButton(id)}<button data-entry-remove="${esc(id)}" aria-label="${esc(pointFor(id)?.label||id)} 지정 해제">해제</button></div>`).join('')||'<p class="origin-help">이 원점에 지정한 진입점이 없습니다.</p>'}</div>
      <p class="origin-help">여러 출입구를 사용하면 추가 지정할 수 있습니다. 유동인구 배분율과 실제 경로는 별도로 검토합니다.</p>
    </section>
    <details class="origin-reference"><summary>원점·추천 후보 근거 보기</summary><p>${esc(origin?.reason||'')}</p><p>${esc(origin?.checks||'')}</p><p>외부 원점 좌표는 지도에 표시하지 않습니다. 역사 진입점만 표시합니다.</p></details>
    <div class="origin-file"><label class="file-button">저장한 검토안 불러오기<input id="importArea" type="file" accept="application/json,.json"></label><p>이 화면의 지정은 임시 상태입니다. 새로고침·종료 전에 아래 ‘검토안 파일 저장’을 눌러 보관하세요.</p></div>`;
    container.querySelector('#originSelect').addEventListener('change',e=>chooseOrigin(e.target.value));
    if(!origins.some(o=>o.id===originId))container.querySelector('#originSelect').selectedIndex=-1;
    container.querySelector('#onlyPendingOrigins').addEventListener('change',e=>{onlyPending=e.target.checked;refresh();});
    container.querySelector('#previousOrigin').addEventListener('click',()=>chooseOrigin(data.origins[index-1]?.id));
    container.querySelector('#nextOrigin').addEventListener('click',()=>chooseOrigin(data.origins[index+1]?.id));
    container.querySelectorAll('[data-entry-pick]').forEach(b=>b.addEventListener('click',()=>choosePoint(b.dataset.entryPick)));
    container.querySelector('#otherEntry').addEventListener('change',e=>{if(e.target.value)choosePoint(e.target.value);});
    container.querySelector('#originGrid').addEventListener('change',e=>{showGrid=e.target.checked;refresh();});
    container.querySelector('#assignOriginEntry').addEventListener('click',()=>{
      try{assignments=assignOriginPoint(assignments,originId,pickedId,context());onDirty();refresh();status(`${current().name} → ${pointFor(pickedId).label} 지정 완료 · 파일로 보관하세요.`);}catch(e){status(e.message);}
    });
    container.querySelectorAll('[data-entry-remove]').forEach(b=>b.addEventListener('click',()=>{
      assignments=assignments.map(r=>r.origin_id===originId?{...r,point_ids:r.point_ids.filter(id=>id!==b.dataset.entryRemove)}:r).filter(r=>r.point_ids.length);onDirty();refresh();status('이 원점의 진입점 지정만 해제했습니다.');
    }));
  }
  return {
    render,
    selectionChanged(p){pickedId=isEntryTarget(p)?p.review_id:null;},
    selectedPoint:()=>pointFor(pickedId),
    currentOrigin:current,
    mapPoints(){const ids=new Set([...assignedIds(),pickedId]);return getPoints().filter(p=>isEntryTarget(p)&&(p.record_kind==='entry_candidate'||showGrid||ids.has(p.review_id))).map(p=>ids.has(p.review_id)?{...p,layer:'od'}:p);},
    exportDrafts:()=>({schema_version:1,source_revision:getGrid()?.source_revision,assignments,routing_enabled:false}),
    validateImport:payload=>validateOriginAssignments(payload.origin_entry_assignments,context()),
    applyImport(value){if(value!==null)assignments=value.assignments;},
  };
}

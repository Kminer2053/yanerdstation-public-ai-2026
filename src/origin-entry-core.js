import {escapeHtml as esc} from './route-review-core.js';
import {reviewFeature} from './point-review-core.js';

export function entryPoint(data,id){
  const entry=data?.entries.find(e=>e.id===id);if(!entry)return null;
  const linked=data.origins.filter(o=>entry.origin_ids.includes(o.id));
  return reviewFeature({...entry.point,review_id:entry.id,label:entry.label},'od',{
    record_kind:'entry_candidate',roles:['origin','destination'],origin_ids:entry.origin_ids,
    source_ids:[...entry.point.source_ids,...entry.origin_ids],aliases:linked.map(o=>o.name),
    modes:[...new Set(linked.map(o=>o.mode_label))],entry_node_ids:[entry.source_review_id],
    allocation_weight:null,area_boundary:null,geometry_status:'entry_candidate_unverified',
    required_check:`연결 원점 ${linked.length}개: ${linked.map(o=>o.name).join(', ')}. ${entry.point.required_check} · 경로·배분 미승인`,
  });
}
export function entryFeatures(data){return data.entries.filter(e=>e.map_eligible).map(e=>entryPoint(data,e.id));}
export function filterOrigins(data,{query='',type=''}={}){
  const q=query.trim().toLowerCase();
  return data.origins.filter(o=>(!type||o.type===type)&&(!q||[o.id,o.name,o.mode_label,...o.entry_ids].join(' ').toLowerCase().includes(q)));
}
export function originCards(data,options={}){
  const entries=new Map(data.entries.map(e=>[e.id,e]));
  return filterOrigins(data,options).map(o=>`<article class="point-card origin-card" style="--point-color:#43dc83">
    <div class="point-meta"><i></i>${esc(o.mode_label)}<span>${o.entry_ids.length?'진입 후보 연결 · 미검수':'접속부 위치 확인 필요'}</span></div>
    <h3>${esc(o.name)}</h3><small>${esc(o.id)}</small><p>${esc(o.reason)}</p>
    <div class="origin-entries">${o.entry_ids.map((id,i)=>{const e=entries.get(id);return `<button data-select="${esc(id)}" ${e.map_eligible?'':'disabled'}><span>${i===0?'우선 검토 · ':''}${esc(e.label)}</span><small>${esc(id)} · ${e.map_eligible?esc(e.point.floor):'층·높이 미확인 / 지도 표시 제외'}</small></button>`;}).join('')||'<p class="missing">실제 접속부의 층·높이를 확인한 뒤 녹색 출발·도착점으로 등록합니다.</p>'}</div>
    <p class="point-fields">${esc(o.hourly_note)}<br>${esc(o.checks)}</p>
    <details><summary>통계 발생장소 참고 위치 · 지도 표시 제외</summary><p>${esc(o.source_location.longitude)}, ${esc(o.source_location.latitude)}</p><small>${o.source_location.locator_ids.map(esc).join(', ')}</small><p>발생원 좌표는 보행출구나 역사 진입점이 아닙니다.</p></details>
  </article>`).join('')||'<p class="list-help">해당 원점이 없습니다. 검색어를 바꿔주세요.</p>';
}
export function estimationNotes(data){
  return `<details class="secondary"><summary>시간대 자료와 GTX·주차 추정 상태</summary>
    <p>기존 ${data.hourly.source_summary.origins}개 원점의 시간자료를 유지합니다. GTX·주차 ${data.hourly.source_summary.missing_origins}개 원점은 시간대 미확보입니다. 미확인은 0이 아닙니다.</p><p>${esc(data.hourly.note)}</p>
    ${Object.entries(data.models).map(([key,m])=>`<h3>${key==='gtx'?'GTX':'주차'} · 수치 미확정</h3><p>${esc(m.formula)}</p><p>${esc(m.note)}</p>${m.sources.map((url,i)=>`<a href="${esc(url)}" target="_blank" rel="noopener">공식 근거 ${i+1} ↗</a>`).join(' · ')}`).join('')}
    <p>낮음·기준·높음은 가정 비교이며 통계적 신뢰구간이 아닙니다. 보정할 기준량·계수가 미확보되어 이번에는 새 인원을 생성하지 않았습니다.</p></details>`;
}

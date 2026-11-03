import {escapeHtml as esc} from './route-review-core.js';
import {connectionCode,connectionPairs,connectionPath,routeSteps,routeStepPoints,routeInsertionPoint,routeSequenceIssues,routeGeometryKey} from './location-workbench-core.js';

const button=(action,label,attrs='')=>`<button type="button" data-action="${action}" ${attrs}>${label}</button>`;
const section=(title,html)=>`<section class="wb-section"><h3>${title}</h3>${html}</section>`;
const select=(name,label,rows,value)=>`<label>${label}<select name="${name}">${rows.map(([id,text])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`;
const kinds={stairs:'계단',escalator:'에스컬레이터',elevator:'엘리베이터'};
const calculated=r=>r?.generation?.method==='dijkstra-mesh-checked-grid-v1'&&Number.isFinite(r.distance_m);
const distanceLabel=r=>`등록 당시 계산거리 약 ${r.distance_m.toLocaleString('ko-KR',{maximumFractionDigits:1})}m`;

export function renderRouteEditor({f,state,pointMap,steps,insert,selected,connection,editing,match}){
  const draft={...f,steps},issues=routeSequenceIssues(draft,state,pointMap),get=id=>pointMap.get(id);
  const saved=state.routes.find(r=>r.id===editing),computed=calculated(saved)&&routeGeometryKey(saved)===routeGeometryKey(draft);
  const from=state.endpoints.find(e=>e.id===f.from),to=state.endpoints.find(e=>e.id===f.to);
  const cursor=get(routeInsertionPoint(draft,state,insert)),count=steps.filter(s=>s.kind==='connection').length;
  const location=id=>id?`${get(id)?.floor||''} · ${get(id)?.label||id}`:'미지정';
  const gap=i=>button('routeInsert',insert===i?'＋ 현재 추가 위치':'＋ 여기에 추가',`data-index="${i}" class="wb-route-gap" aria-pressed="${insert===i}"`);
  const endCard=(e,start)=>`<div class="wb-route-end"><span class="wb-sequence-number">${start?'출발':'도착'}</span><div><strong>${esc(e?.name||'위치를 선택하세요')}</strong><small>${esc(e?.floor||'미지정')} · ${start?'순서 시작':'순서 종료'}</small></div>${e?button('pick','지도',`data-id="${esc(e.id)}" aria-label="${start?'출발':'도착'} 위치 지도 보기"`):''}</div>`;
  const rows=steps.map((s,i)=>{
    const c=s.kind==='connection'?state.connections.find(c=>c.id===s.connection_id):null,ids=routeStepPoints(s);
    const title=c?connectionCode(state.connections,c.id)+' · '+kinds[c.kind]:'경유점';
    return `<li class="wb-route-item ${c?'is-connection':''} ${issues.some(p=>p.index===i)?'has-error':''}" data-step-index="${i}">
      <div class="wb-route-step"><span class="wb-sequence-number">${i+1}</span><div class="wb-route-step-main"><strong>${esc(title)}</strong>
      ${c?`<small>${esc(c.name)} · ${c.status==='checked'?'위치 확인함':'미검토'}</small>`:''}
      <div class="wb-route-locations">${ids.map((id,j)=>button('pick',esc((c?(j?'하차·진출 ':'승차·진입 '):'')+location(id)),`data-id="${esc(id)}"`)).join(c?'<span aria-hidden="true">↓</span>':'')}</div>
      <div class="wb-buttons">${button('stepUp','↑ 위로',`data-index="${i}" aria-label="${i+1}번 위로" ${i===0?'disabled':''}`)}${button('stepDown','↓ 아래로',`data-index="${i}" aria-label="${i+1}번 아래로" ${i===steps.length-1?'disabled':''}`)}${button('stepRemove','삭제',`data-index="${i}" aria-label="${i+1}번 순서 삭제"`)}</div></div></div>${gap(i+1)}</li>`;
  }).join('');
  const chosen=connection?JSON.parse(connection):[],c=state.connections.find(c=>c.id===chosen[0]),pair=chosen.slice(1);
  const directionButton=reverse=>{
    if(!c)return '';
    const ids=reverse?[...pair].reverse():pair,valid=connectionPath(c,...ids),matches=!cursor||cursor.floor===get(ids[0])?.floor;
    return button(reverse?'viaConnectionReverse':'viaConnection',esc(`${get(ids[0])?.floor} → ${get(ids[1])?.floor} 추가`),`${!from||!valid||!matches?'disabled':''} title="${!valid?'허용되지 않은 이동 방향':!matches?'현재 추가 위치의 층과 다릅니다':'이 연결을 순서에 추가'}"`);
  };
  return section('출발부터 도착까지 순서 편집',`<form id="wbForm"><label>경로 이름<input name="name" maxlength="240" value="${esc(f.name||'')}"></label>
    <div class="wb-pair">${select('from','출발 위치',[['','선택'],...state.endpoints.filter(e=>e.role!=='end').map(e=>[e.id,`${e.name} (${e.floor})`])],f.from||'')}${select('to','도착 위치',[['','선택'],...state.endpoints.filter(e=>e.role!=='start').map(e=>[e.id,`${e.name} (${e.floor})`])],f.to||'')}</div>
    <div class="wb-pair">${select('direction','방향',[['forward','출발 → 도착'],['both','양방향']],f.direction||'forward')}${select('status','위치 검토 상태',[['draft','미검토'],['checked','위치 확인함']],f.status||'draft')}</div>
    <p>출발부터 아래로 순서대로 이으세요. 층간연결은 여러 번 추가할 수 있고, 진입·진출점이 한 묶음으로 이동합니다.</p>
    <div class="wb-stats" id="routeStepCounts"><span>경유점 ${steps.length-count}개</span><span>층간이동 ${count}회</span></div>
    ${computed?`<p class="wb-live" id="routeDistance">${distanceLabel(saved)} · 격자 기준 최단 후보</p>`:''}
    <div class="wb-route-sequence" aria-label="경로 이동 순서">${endCard(from,true)}${gap(0)}<ol class="wb-route-steps">${rows}</ol>${endCard(to,false)}</div>
    <div id="routeContinuity" class="wb-route-check ${issues.length?'has-error':''}" role="status">${issues.length?issues.map(p=>`<div>${esc(p.message)}</div>`).join(''):'층과 이동 방향의 순서가 이어집니다. 실제 통행 가능 여부는 지도에서 확인하세요.'}</div>
    <div class="wb-route-adder"><h4>${insert===steps.length?'다음 순서 추가':`${insert+1}번 앞에 삽입`}</h4>
      <div class="wb-live">이어갈 위치: ${esc(location(cursor?.review_id))}${cursor?button('pick','이 위치로 지도 이동',`data-id="${esc(cursor.review_id)}"`):''}</div>
      <div class="wb-live">선택 위치: ${esc(selected?location(selected.review_id):'지도에서 점을 선택하세요')}</div>${button('viaAdd','선택 격자를 이 순서에 추가',from?'':'disabled')}
      <p>층을 바꿀 때는 지도 C번호 라벨 또는 아래 목록에서 연결을 고르고 이동 방향을 누르세요.</p>
      <label>추가할 층간 연결<select id="routeConnection"><option value="">연결 선택</option>${state.connections.flatMap(c=>connectionPairs(c).map(([a,b])=>`<option value="${esc(JSON.stringify([c.id,a,b]))}">${esc(connectionCode(state.connections,c.id)+' · '+c.name)} (${get(a).floor} ↔ ${get(b).floor})</option>`)).join('')}</select></label>
      <div class="wb-buttons">${directionButton(false)}${directionButton(true)}</div>
    </div>
    <p class="wb-warning">${computed?'등록 당시 모델의 보행 격자·층간연결에서 거리 합이 최소인 후보입니다. 실제 통행, ES 방향, 개찰구 통제 및 대기시간은 미검토입니다. 접속점·연결 변경 시 재계산이 필요합니다.':'보라색 선은 지정한 이동 순서의 초안입니다. 자동 최단경로·장애물 회피 결과는 아닙니다.'}</p>
    <div class="wb-buttons">${button('saveRoute',editing?'경로 수정 저장':'경로 등록',`class="wb-primary" ${issues.length?'disabled':''}`)}${button('newRoute','새 경로')}</div></form>`)
    +section(`저장된 경로 ${state.routes.length}개`,`<div class="wb-list">${state.routes.filter(match).map(r=>{
      const sequence=routeSteps(r,state,pointMap),n=sequence.filter(s=>s.kind==='connection').length;
      return `<div class="wb-row">${button('editRoute',`<strong>${esc(r.name)}</strong><small>${calculated(r)?distanceLabel(r)+' · ':''}경유점 ${sequence.length-n}개 · 층간이동 ${n}회 · ${r.status==='checked'?'확인함':'미검토'}</small>`,`data-id="${esc(r.id)}"`)}${button('deleteRoute','삭제',`data-id="${esc(r.id)}"`)}</div>`;
    }).join('')||'<p>등록된 경로가 없습니다. 출발·도착 위치를 선택해 순서를 만드세요.</p>'}</div>`);
}

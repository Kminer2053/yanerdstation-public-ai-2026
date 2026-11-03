import {esc} from './experience-core.js';
// Connections and origins detail editors (routes: manager-route-editor.js, facilities: manager-facility-panel.js).
export function mountConfirmedDetails({kind,record,override,form}){
 const $=s=>form.querySelector(s),host=document.createElement('section');host.className='confirmed-extra';form.insertBefore(host,form.querySelector('.confirmed-save'));
 let observations=structuredClone(override.observations||[]),currentDate='2026-07-01';
 if(kind==='connections'){
  host.innerHTML='<label>통행 방향<select data-field="direction"><option value="both">양방향</option>'+(record.kind==='elevator'?'':'<option value="forward">A → B 정방향</option>')+'</select></label><p>엘리베이터는 등록된 여러 층 사이의 연결을 유지합니다. 연결의 위치·층을 바꾸려면 심사 종료 후 기준 경로를 함께 검토해야 합니다.</p>';$('[data-field=direction]').value=override.direction??record.direction;
 }else if(kind==='origins'){
  host.innerHTML='<h4>시간대별 진입·이탈량 편집</h4><label>기준일<input id="demoObservationDate" type="date" min="2026-07-01" max="2026-07-31" value="'+currentDate+'"></label><p>빈 칸은 수정하지 않음을 뜻합니다. 0을 입력하면 0으로 기록합니다. 아래 값은 시연 수정값이며 원본 관측·추정 자료는 유지합니다.</p><div class="demo-hour-table"><table><thead><tr><th>시각</th><th>진입량</th><th>이탈량</th><th>구분</th><th>출처·추정 근거</th></tr></thead><tbody id="demoHours"></tbody></table></div>';
  let original=null;const originalView=document.createElement('details');originalView.innerHTML='<summary>확정 시간대별 원천·추정 자료 확인</summary><div>불러오는 중…</div>';host.insertBefore(originalView,host.querySelector('.demo-hour-table'));
  const drawOriginal=()=>{if(!original)return;originalView.querySelector('div').innerHTML='<p>'+esc(original.note)+'</p><table><thead><tr><th>원천 시각</th><th>집계 구분</th><th>수량</th><th>구분</th></tr></thead><tbody>'+original.rows.filter(r=>r.service_date===currentDate).map(r=>'<tr><td>'+esc(r.source_hour)+'시</td><td>'+esc(r.metric==='passenger_boardings'?'원점 승차':'원점 하차')+'</td><td>'+esc(r.value)+'</td><td>'+esc(r.value_class)+'</td></tr>').join('')+'</tbody></table>';};
  fetch('/data/experience/origins/'+encodeURIComponent(record.id)+'.json').then(r=>{if(!r.ok)throw Error('이 원점의 자료 파일이 없습니다.');return r.json();}).then(v=>{original=v;drawOriginal();}).catch(e=>originalView.querySelector('div').textContent=e.message);
  const collect=()=>{const next=[];for(const row of host.querySelectorAll('[data-hour]')){const [a,d,type,method]=row.querySelectorAll('input,select');if(a.value===''&&d.value==='')continue;next.push({date:currentDate,hour:+row.dataset.hour,arrivals:a.value===''?NaN:Number(a.value),departures:d.value===''?NaN:Number(d.value),value_class:type.value,method:method.value});}observations=[...observations.filter(o=>o.date!==currentDate),...next];};
  const draw=()=>$('#demoHours').innerHTML=Array.from({length:24},(_,h)=>{const o=observations.find(o=>o.date===currentDate&&o.hour===h);return '<tr data-hour="'+h+'"><th>'+h+'시</th><td><input aria-label="'+h+'시 진입량" type="number" min="0" value="'+(o?.arrivals??'')+'"></td><td><input aria-label="'+h+'시 이탈량" type="number" min="0" value="'+(o?.departures??'')+'"></td><td><select aria-label="'+h+'시 값 구분"><option value="observed">관측</option><option value="estimated" '+(o?.value_class==='estimated'?'selected':'')+'>추정</option></select></td><td><input aria-label="'+h+'시 산출 근거" value="'+esc(o?.method||'')+'"></td></tr>';}).join('');
  $('#demoObservationDate').onchange=e=>{collect();currentDate=e.target.value;draw();drawOriginal();};draw();return {read(){collect();return {observations};}};
 }
 return {read:()=>({})};
}

// Route tab editor: waypoints are placed on the map (clicks snap to walkable floor cells, wall-crossing
// segments are rerouted along the walking grid, floors change through registered connection landings)
// and checked live with the same rules the server applies on save. Edits stay in the demo copy.
import {esc,int} from './experience-core.js';
import {routePreview,snapGround,segmentClear,detourPath,landingsOnFloor,routeIssues,stepEntry,stepExit,metres} from './manager-core.js';

const KIND_NAME={stairs:'계단',escalator:'에스컬레이터',elevator:'엘리베이터'};

export function mountRouteEditor({record,override,register,index,form,notify,scene,walk}){
  const byId=index.byId,start=register.endpoints.find(e=>e.id===record.from),end=register.endpoints.find(e=>e.id===record.to);
  let steps=structuredClone(override.steps??record.steps??[]),active=null,drawing=false,wg=null,choice=null,armed=null,timer=null,undo=[],destroyed=false,blockedNow=[];
  const host=document.createElement('section');host.className='route-editor';form.prepend(host);
  const changed=()=>form.dispatchEvent(new Event('input',{bubbles:true}));
  const label=id=>{const p=byId.get(id);return p?p[1]+' · '+id:id;};
  const connection=id=>register.connections.find(c=>c.id===id);
  host.innerHTML='<header><h4>경로 순서</h4><span class="panel-badge">'+esc(start?.name||'출발')+' → '+esc(end?.name||'도착')+'</span></header>'+
    '<div class="route-draw-bar"><button type="button" id="routeDraw" class="primary-soft" aria-pressed="false">지도에서 경유점 찍기</button><button type="button" id="routeUndo" disabled>되돌리기</button><button type="button" id="routeClear">처음부터 다시</button><label class="inline-check"><input type="checkbox" id="routeDetour" checked> 벽을 피해 자동 경유</label></div>'+
    '<p id="routeDrawHint" class="panel-note" role="status"></p><div id="routeChecks" class="route-checks" aria-live="polite"></div>'+
    '<label>통행 방향<select data-field="direction"><option value="both">양방향</option><option value="forward">출발 → 도착</option></select></label>'+
    '<ol id="demoSteps"></ol>'+
    '<details class="route-manual"><summary>ID로 경유점·층간연결 추가</summary><label>추가할 경유점<input id="demoPoint" list="demoPointChoices" placeholder="GRID- 또는 층을 입력해 검색" autocomplete="off"></label><datalist id="demoPointChoices"></datalist><button type="button" id="demoAddPoint">경유점 추가</button><label>추가할 층간연결<select id="demoConnection">'+register.connections.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('')+'</select></label><button type="button" id="demoAddConnection">층간연결 추가</button></details>'+
    '<div class="panel-actions"><button type="button" id="demoRoutePreview">경로 전체 보기</button></div><p class="panel-note">안내 서비스의 확정 경로·유동인구 계산에는 적용되지 않는 시연 편집입니다.</p>';
  const $=s=>host.querySelector(s),direction=$('[data-field=direction]');direction.value=override.direction??record.direction??'both';

  // Insertion point: after the selected step (-1: right after the start), otherwise at the end. The working floor follows it.
  const insertAt=()=>active===null?steps.length:active+1;
  const cursorId=()=>{const i=insertAt()-1;return i<0?start?.access_id:stepExit(steps[i]);};
  const workFloor=()=>byId.get(cursorId())?.[1]||start?.floor;
  function remember(){undo.push({steps:structuredClone(steps),active});if(undo.length>40)undo.shift();$('#routeUndo').disabled=false;}
  function commit(opts){changed();render(opts);}

  function addPoints(ids,{detour=true}={}){
    const k=insertAt(),prev=cursorId(),next=steps[k]?stepEntry(steps[k]):null,auto=detour&&$('#routeDetour').checked&&wg;
    const id=ids.at(-1);if(id===prev||id===next)return notify('바로 앞뒤 단계와 같은 지점입니다.');
    let before=[],after=[],lost=false;
    if(auto&&prev&&segmentClear(wg,prev,id)===false){const d=detourPath(wg,prev,id);if(d)before=d;else lost=true;}
    if(auto&&next&&segmentClear(wg,id,next)===false){const d=detourPath(wg,id,next);if(d)after=d;else lost=true;}
    // Areas of one floor that meet only through another floor (platforms, separated concourses) need a connection.
    if(lost)return notify('같은 층에서 걸어서 이어지지 않는 곳입니다(선로·벽 등). 보라 점의 층간연결을 거쳐 가세요.');
    remember();choice=null;
    steps.splice(k,0,...[...before,...ids,...after].map(point_id=>({kind:'point',point_id})));active=k+before.length+ids.length-1;
    if(before.length+after.length)notify('벽을 피해 경유점 '+(before.length+after.length)+'개를 함께 넣었습니다.');
    commit();
  }
  function addConnection(c,from,to){
    const k=insertAt(),prev=cursorId(),auto=$('#routeDetour').checked&&wg;let before=[];
    if(auto&&prev&&prev!==from){const d=detourPath(wg,prev,from);if(d)before=d;}
    remember();choice=null;
    steps.splice(k,0,...before.map(point_id=>({kind:'point',point_id})),{kind:'connection',connection_id:c.id,from,to});active=k+before.length;
    notify(c.name+' 추가 · 이제 '+(byId.get(to)?.[1]||'')+' 에서 이어서 찍습니다.');commit({view:to});
  }
  // Walkable waypoints for one red-dashed segment, inserted in front of the step it leads to.
  function fixSegment(b){
    if(!b||!wg)return;const d=detourPath(wg,b.from,b.to);
    if(d===null)return notify('같은 층에서 걸어서 이어지지 않는 구간입니다. 층간연결을 거치도록 고치세요.');if(!d.length)return;
    remember();steps.splice(b.index,0,...d.map(point_id=>({kind:'point',point_id})));if(active!==null&&active>=b.index)active+=d.length;
    notify('벽을 피해 경유점 '+d.length+'개를 넣었습니다.');commit();
  }
  function chooseLanding(c,landing){
    const stops=landingsOnFloor([c],byId,workFloor(),direction.value).find(l=>l.landing===landing);
    if(!stops)return notify('이 층간연결은 현재 통행 방향으로 쓸 수 없습니다.');
    if(stops.targets.length===1)return addConnection(c,landing,stops.targets[0].id);
    choice={c,landing,targets:stops.targets};hint();
  }

  function render({fit=false,view=null}={}){
    draw();checks();hint();clearTimeout(timer);timer=setTimeout(()=>preview({fit,view}),fit||view?0:120);
  }
  function draw(){
    const ends=(tag,e,extra='')=>'<li class="route-end-row"'+extra+'>'+tag+'<span>'+esc(e?.name||'')+' · '+esc(label(e?.access_id))+'</span></li>';
    $('#demoSteps').innerHTML=ends('<button type="button" class="step-focus" data-focus="-1" title="출발 바로 다음에 넣기">출발</button>',start,' data-index="-1"'+(active===-1?' aria-current="true"':''))+steps.map((s,i)=>'<li data-index="'+i+'"'+(i===active?' aria-current="true"':'')+'><button type="button" class="step-focus" data-focus="'+i+'" title="이 단계 선택 · 지도에서 보기">'+(i+1)+'</button><span>'+esc(s.kind==='point'?label(s.point_id):'↕ '+(connection(s.connection_id)?.name||s.connection_id)+' ('+(byId.get(s.from)?.[1]||'?')+'→'+(byId.get(s.to)?.[1]||'?')+')')+'</span>'+
      ['up','down','reverse','remove'].filter(a=>a!=='reverse'||s.kind==='connection').map(a=>'<button type="button" data-step="'+i+'" data-action="'+a+'" aria-label="'+({up:'위로',down:'아래로',reverse:'연결 방향 반전',remove:'경유 항목 제거'})[a]+'">'+({up:'↑',down:'↓',reverse:'⇄',remove:'×'})[a]+'</button>').join('')+'</li>').join('')+(steps.length?'':'<li class="route-empty">경유점이 없습니다. [지도에서 경유점 찍기]로 출발점부터 차례로 찍으세요.</li>')+ends('<span class="step-focus end">도착</span>',end);
  }
  function checks(){
    const {issues,blocked}=routeIssues({...record,direction:direction.value,steps},register,byId,wg),v=routePreview(record,steps,register,byId);
    let length=0;if(!v.error)for(let i=1;i<v.coordinates.length;i++)length+=Math.hypot(metres(v.coordinates[i-1],v.coordinates[i]),v.coordinates[i][2]-v.coordinates[i-1][2]);
    blockedNow=blocked;
    const rows=[...issues.map(x=>({index:x.index,text:x.message})),...blocked.map((b,k)=>({index:b.index,fix:k,text:(b.index?b.index+'번':'출발')+' → '+(b.index<steps.length?(b.index+1)+'번':'도착')+' 구간이 벽·시설을 지나는 것으로 보입니다 (지도의 빨간 점선).'}))];
    $('#routeChecks').dataset.state=rows.length?'warn':'ok';
    $('#routeChecks').innerHTML=rows.length?'<ul>'+rows.map(r=>'<li>'+(r.index>=0&&r.index<steps.length?'<button type="button" data-focus="'+r.index+'">'+(r.index+1)+'번</button> ':'')+esc(r.text)+(r.fix===undefined?'':' <button type="button" data-fix="'+r.fix+'">자동 우회</button>')+'</li>').join('')+'</ul>'
      :'<p>저장 조건 충족 · 단계 '+steps.length+'개 · 층간연결 '+steps.filter(s=>s.kind==='connection').length+'회 · 약 '+int(length)+'m'+(wg?'':' · 벽 통과 검사 준비 중')+'</p>';
    return blocked;
  }
  function hint(){
    const f=workFloor(),k=insertAt();
    $('#routeDrawHint').innerHTML=choice?'<b>'+esc(choice.c.name)+'</b> 도착 층을 고르세요: '+choice.targets.map(t=>'<button type="button" data-target="'+esc(t.id)+'">'+esc(t.floor)+'</button>').join(' ')+' <button type="button" data-target="">취소</button>'
      :drawing?'<b>'+esc(f)+'</b> 바닥을 누르면 '+(k?k+'번 뒤':'출발 다음')+'에 경유점을 넣습니다. 보라 점은 층간연결, 번호 점을 누르면 그 뒤에 이어서 넣습니다.'+(wg?'':' (보행 격자 불러오는 중…)')
      :'번호를 누르면 그 단계 뒤에 이어서 편집합니다. 지도에서 직접 찍으려면 [지도에서 경유점 찍기]를 누르세요.';
    $('#routeDraw').setAttribute('aria-pressed',String(drawing));$('#routeDraw').textContent=drawing?'찍기 끝내기':'지도에서 경유점 찍기';host.classList.toggle('drawing',drawing);
  }
  function preview({fit=false,view=null}={}){
    if(destroyed)return;const v=routePreview(record,steps,register,byId);if(v.error){notify(v.error);return;}
    scene.route({route_id:'demo-preview',coordinates:v.coordinates,floors:v.floors},fit);
    const marks=v.stops.map(s=>({id:'step:'+s.index,kind:s.kind==='connection'?'connection':'step',point:s.point,label:s.kind==='connection'?(s.index+1)+' · '+s.name.slice(0,18):String(s.index+1)}));
    const lines=(wg?routeIssues({...record,direction:direction.value,steps},register,byId,wg).blocked:[]).map(b=>({coordinates:[byId.get(b.from).slice(2,5),byId.get(b.to).slice(2,5)],color:'#ef4444',width:5,dashed:true}));
    const data={marks,lines,selected:active===null?null:'step:'+active};
    if(drawing){
      const f=workFloor();data.floors=[f];data.draw={height:byId.get(cursorId())?.[4]};
      // Side-by-side landings (up/down escalator pairs) share one short label so the map stays readable.
      const groups=[];
      for(const l of landingsOnFloor(register.connections,byId,f,direction.value)){
        const g=groups.find(g=>metres(g[0].point,l.point)<6);if(g)g.push(l);else groups.push([l]);
      }
      for(const g of groups)g.forEach((l,i)=>marks.push({id:'land:'+l.connection.id+'|'+l.landing,kind:'landing',point:l.point,
        ...(i?{}:{label:'↕ '+[...new Set(g.map(l=>KIND_NAME[l.connection.kind]||'연결'))].join('·')+' → '+[...new Set(g.flatMap(l=>l.targets.map(t=>t.floor)))].join('·')})}));
      const p=byId.get(view||cursorId());if(view||fit)data.view={point:p.slice(2,5),range:48,pitch:-62};
    }
    scene.overlay(data);
  }

  host.onclick=e=>{
    const x=e.target.closest('[data-fix]');if(x){fixSegment(blockedNow[+x.dataset.fix]);return;}
    const t=e.target.closest('[data-target]');if(t){if(!t.dataset.target){choice=null;hint();return;}const c=choice;if(c)addConnection(c.c,c.landing,t.dataset.target);return;}
    const f=e.target.closest('[data-focus]');if(f){active=+f.dataset.focus;render();scene.focusMark('step:'+active);return;}
    const b=e.target.closest('[data-step]');if(!b)return;const i=+b.dataset.step,a=b.dataset.action;
    if(a!=='remove'&&a!=='reverse'){const j=i+(a==='up'?-1:1);if(j<0||j>=steps.length)return;remember();[steps[i],steps[j]]=[steps[j],steps[i]];active=j;}
    else{remember();if(a==='remove'){steps.splice(i,1);active=i>0?i-1:steps.length?-1:null;}else[steps[i].from,steps[i].to]=[steps[i].to,steps[i].from];}
    commit();
  };
  $('#routeDraw').onclick=()=>{drawing=!drawing;choice=null;render({view:drawing?cursorId():null,fit:!drawing});};
  $('#routeUndo').onclick=()=>{const u=undo.pop();if(!u)return;steps=u.steps;active=u.active;choice=null;$('#routeUndo').disabled=!undo.length;commit();};
  $('#routeClear').onclick=()=>{if(armed){clearTimeout(armed);armed=null;remember();steps=[];active=null;$('#routeClear').textContent='처음부터 다시';commit({view:start?.access_id});return;}
    $('#routeClear').textContent='한 번 더 누르면 모두 지움';armed=setTimeout(()=>{armed=null;$('#routeClear').textContent='처음부터 다시';},3000);};
  direction.onchange=()=>render();
  $('#demoPoint').oninput=e=>{const q=e.target.value.toLowerCase(),f=workFloor();$('#demoPointChoices').innerHTML=(index.byFloor.get(f)||[]).filter(p=>p[0].toLowerCase().includes(q)).slice(0,150).map(p=>'<option value="'+esc(p[0])+'">'+esc(label(p[0]))+'</option>').join('');};
  $('#demoAddPoint').onclick=()=>{const id=$('#demoPoint').value.trim();if(!byId.has(id))return notify('검색 목록의 유효한 보행점을 선택하세요.');addPoints([id],{detour:false});};
  $('#demoAddConnection').onclick=()=>{const c=connection($('#demoConnection').value);if(!c)return;const landing=landingsOnFloor([c],byId,workFloor(),direction.value)[0];
    if(landing)return chooseLanding(c,landing.landing);const k=insertAt();remember();steps.splice(k,0,{kind:'connection',connection_id:c.id,from:c.from||c.stops[0],to:c.to||c.stops.at(-1)});active=k;commit();};
  $('#demoRoutePreview').onclick=()=>{active=null;render({fit:true});};
  walk.then(g=>{if(destroyed)return;wg=g;render();}).catch(()=>notify('보행 격자를 불러오지 못해 벽 통과 검사와 자동 우회를 쓸 수 없습니다.'));
  render({fit:true});
  return {
    read:()=>({steps}),
    pick(id){
      if(id.startsWith('step:')){active=+id.slice(5);render();return;}
      if(id.startsWith('land:')&&drawing){const [cid,landing]=id.slice(5).split('|'),c=connection(cid);if(c)chooseLanding(c,landing);}
    },
    ground(p){
      if(!drawing)return;if(!wg)return notify('보행 격자를 불러오는 중입니다. 잠시 후 다시 누르세요.');
      const f=workFloor(),s=snapGround(wg,f,p,{radius:3});
      if(!s)return notify(f+' 보행 가능한 바닥을 눌러 주세요. 벽·시설 위나 다른 층은 선택되지 않습니다.');
      addPoints([s.id]);
    },
    destroy(){destroyed=true;clearTimeout(timer);clearTimeout(armed);},
  };
}

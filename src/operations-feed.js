// Operations decision feed (manager overview): situations for the chosen hour stream in one by one, each with its map
// location, evidence and demo action records. The demo clock can run the day forward so the feed keeps changing.
// Action records are a demonstration log in this browser only; nothing is sent to staff or systems.
import {esc,int} from './experience-core.js';
import {situations,LEVELS,situationReport,metricFor,occupancySeries} from './operations-core.js';

const KIND_LABEL={occupancy:'동시체류',corridor:'통행 혼잡',vertical:'층간 이동',arrival:'열차 도착','arrival-next':'도착 예보','store-up':'매장 영업','store-down':'매장 영업',conversion:'매장 영업','suspect-zero':'휴점 확인','no-access':'등록 정비',stale:'분석 기준',resolved:'해소 확인'};
const MARK_KIND={critical:'critical',warning:'warning',advice:'advice',data:'data',info:'advice'};
const HOUR_MS=28000,REVEAL_MS=1050,FIRST_HOUR=6,LAST_HOUR=23;
const pct=(a,b)=>b>0?Math.round((a/b-1)*100):null,signed=v=>v===null?'':(v>=0?'+':'')+v+'%';

export function createOperationsFeed({getContext,post,setHour,showPlace,openFacility,notify}){
  const root=document.createElement('section');root.id='reviewAttention';root.className='ops-feed';root.setAttribute('aria-label','운영 판단 피드');
  root.innerHTML='<header class="ops-head"><div class="ops-title"><span class="ops-live"><i></i>LIVE · SIM</span><h2>운영 판단 피드</h2><small>추정 모델 기반 · 실측 센서 아님</small></div>'+
    '<div class="ops-clock"><b id="opsClock">--:--</b><span id="opsDate"></span></div><div class="ops-spark" id="opsSpark" aria-label="오늘 동시체류 추이"></div>'+
    '<div class="ops-counts"><span data-count="critical">긴급<b>0</b></span><span data-count="open">조치 대기<b>0</b></span><span data-count="progress">조치 중<b>0</b></span><span data-count="done">완료<b>0</b></span></div>'+
    '<div class="ops-controls"><button type="button" id="opsAuto" aria-pressed="true">⏸ 시연 진행 중</button><button type="button" id="opsReport">상황 보고</button></div><div class="ops-progress"><i id="opsBar"></i></div></header>'+
    '<div class="ops-cards" id="opsCards" role="list" aria-live="polite"></div>';
  const $=s=>root.querySelector(s),cards=$('#opsCards'),skeleton=document.createElement('div');skeleton.className='ops-skeleton';skeleton.innerHTML='<i></i><span>데이터 분석 중…</span>';
  let items=[],revealed=[],queue=[],lastKey='',lastHour='',revealTimer=null,auto=true,active=false,hourStart=performance.now(),focusKey=null;
  const records=new Map();

  // The demo hour runs after the situations have streamed in, so each hour stays readable.
  const clock=()=>{const ctx=getContext(),m=auto&&active&&!revealTimer?Math.min(59,Math.floor((performance.now()-hourStart)/HOUR_MS*60)):0;return String(ctx.hour).padStart(2,'0')+':'+String(m).padStart(2,'0');};
  function header(){
    const ctx=getContext(),d=new Date(ctx.date+'T00:00:00');
    $('#opsClock').textContent=clock();$('#opsDate').textContent=ctx.date+' ('+'일월화수목금토'[d.getDay()]+')';
    const open=revealed.filter(s=>s.level!=='info'&&!records.has(s.key)&&(s.dispatch||s.facility)).length;
    const counts={critical:revealed.filter(s=>s.level==='critical'&&!records.has(s.key)).length,open,progress:[...records.values()].filter(r=>r.status==='dispatched').length,done:[...records.values()].filter(r=>r.status==='done').length};
    for(const [k,v] of Object.entries(counts))root.querySelector('[data-count='+k+'] b').textContent=v;
    root.querySelector('[data-count=critical]').classList.toggle('hot',counts.critical>0);
    const series=occupancySeries(ctx),max=Math.max(1,...series.filter(Number.isFinite));
    $('#opsSpark').innerHTML=series.every(v=>v===null)?'':'<svg viewBox="0 0 96 26" preserveAspectRatio="none">'+series.map((v,h)=>'<rect x="'+(h*4)+'" y="'+(26-(v||0)/max*24).toFixed(1)+'" width="3" height="'+((v||0)/max*24).toFixed(1)+'" class="'+(h===ctx.hour?'now':'')+'"/>').join('')+'</svg><span>동시체류 '+int(series[ctx.hour])+'명</span>';
  }
  function statusLine(s,r){
    if(!r)return '';
    const now=s.metric?.value,change=r.metricAt!=null&&now!=null&&r.hourAt!==s.hour?pct(now,r.metricAt):null;
    return '<div class="ops-status" data-status="'+r.status+'">'+(r.status==='done'?'✓ 완료 '+r.doneAt:r.status==='ack'?'확인 '+r.at:'조치 지시 '+r.at+' · '+esc(r.action)+(change!==null?' · 지시 후 '+signed(change):''))+'</div>';
  }
  function actions(s,r){
    const b=[];if(s.place?.point)b.push('<button type="button" data-act="focus">지도</button>');
    if(s.dispatch&&!r)b.push('<button type="button" data-act="dispatch" class="primary">조치 지시 ▾</button>');
    if(s.facility&&!r)b.push('<button type="button" data-act="facility" class="primary">시설 탭에서 정비</button>');
    if(r?.status==='dispatched'||s.kind==='resolved'&&!r)b.push('<button type="button" data-act="done" class="primary">완료 처리</button>');
    if(!s.dispatch&&!s.facility&&s.kind!=='resolved'&&!r)b.push('<button type="button" data-act="ack">확인</button>');
    if(s.evidence)b.push('<button type="button" data-act="evidence">근거</button>');
    return b.join('');
  }
  function card(s,{enter=true}={}){
    const r=records.get(s.key),el=document.createElement('article');
    el.className='ops-card'+(enter?' enter':'')+(r?.status==='done'||r?.status==='ack'?' settled':'');el.dataset.level=s.level;el.dataset.key=s.key;el.setAttribute('role','listitem');
    el.innerHTML='<div class="ops-card-head"><span class="ops-level">'+LEVELS[s.level].label+'</span><span class="ops-kind">'+(KIND_LABEL[s.kind]||'')+'</span><time>'+String(s.hour).padStart(2,'0')+'시</time></div>'+
      '<h3>'+esc(s.title)+'</h3><p>'+esc(s.body)+'</p>'+statusLine(s,r)+'<div class="ops-actions">'+actions(s,r)+'</div>'+
      '<div class="ops-menu" hidden><small>조치 지시 (시연 기록)</small>'+(s.dispatch||[]).map(a=>'<button type="button" data-dispatch="'+esc(a)+'">'+esc(a)+'</button>').join('')+'</div><p class="ops-evidence" hidden>'+esc(s.evidence||'')+'</p>';
    return el;
  }
  const find=key=>revealed.find(s=>s.key===key)||items.find(s=>s.key===key);
  const cardOf=key=>[...cards.children].find(c=>c.dataset.key===key);
  function rerender(key){const s=find(key),el=cardOf(key);if(s&&el)el.replaceWith(card(s,{enter:false}));header();markers();}

  function markers({view=null}={}){
    if(!active)return;const ctx=getContext(),floors=ctx.managerFloor&&ctx.managerFloor!=='all'?[ctx.managerFloor]:null;
    // One marker per spot: the most urgent situation there, with a count of the others.
    const spots=new Map();
    for(const s of revealed){
      if(!s.place?.point||records.get(s.key)?.status==='done'||floors&&!floors.includes(s.place.floor))continue;
      const k=s.place.floor+':'+s.place.point.map(v=>v.toFixed(5)).join(',');(spots.get(k)||spots.set(k,[]).get(k)).push(s);
    }
    const marks=[...spots.values()].map(g=>{const s=g[0],dispatched=records.get(s.key)?.status==='dispatched';
      return {id:'sit:'+s.key,kind:dispatched?'progress':MARK_KIND[s.level],point:s.place.point,
        label:(dispatched?'조치 중':LEVELS[s.level].label)+' · '+(s.place.label||s.title).split(' · ').pop().slice(0,18)+(g.length>1?' +'+(g.length-1):'')};});
    post({action:'manager-overlay',marks,selected:focusKey?'sit:'+focusKey:null,...(view?{view:{point:view,range:75,pitch:-46}}:{})});
  }
  function focus(s){
    if(!s?.place?.point)return;focusKey=s.key;showPlace(s.place);markers({view:s.place.point});
    for(const c of cards.children)c.classList.toggle('focused',c.dataset.key===s.key);
  }
  function revealNext(){
    const s=queue.shift();
    if(!s){revealTimer=null;hourStart=performance.now();skeleton.remove();header();setTimeout(()=>{if(!revealTimer)cards.scrollTo({left:0,behavior:'smooth'});},1600);return;}
    cardOf(s.key)?.remove();const el=card(s),anchor=revealed.length?cardOf(revealed.at(-1).key):null;
    if(anchor)anchor.after(el);else cards.prepend(el);el.after(skeleton);revealed.push(s);
    // Keep the newest arrivals in view while the hour streams in.
    const right=el.offsetLeft+el.offsetWidth+skeleton.offsetWidth+24-cards.clientWidth;cards.scrollLeft=Math.max(0,right);
    if(s.level==='critical')root.classList.add('alarm'),setTimeout(()=>root.classList.remove('alarm'),1200);
    header();markers();revealTimer=setTimeout(revealNext,REVEAL_MS);
  }
  function update(){
    const ctx=getContext();if(!active||!ctx.catalog||!ctx.timeline?.[ctx.date])return;
    const key=ctx.date+'|'+ctx.hour+'|'+(ctx.flowsByHour?1:0)+'|'+(ctx.sales?1:0),hourKey=ctx.date+'|'+ctx.hour;
    header();if(key===lastKey)return;lastKey=key;
    const newHour=hourKey!==lastHour;lastHour=hourKey;if(newHour)hourStart=performance.now();
    const next=situations(ctx),keys=new Set(next.map(s=>s.key));
    // Follow-up: a subject that was acted on and is no longer flagged gets a confirmation card.
    for(const [k,r] of records)if(r.status==='dispatched'&&!keys.has(k)&&r.hourAt!==ctx.hour){
      const now=metricFor(ctx,k,r.place);
      next.push({id:hourKey+'|resolved|'+k,key:'resolved|'+k,level:'info',kind:'resolved',date:ctx.date,hour:ctx.hour,resolves:k,title:r.title.replace(/\s*(통행 집중|이동 집중|하차 급증|이용 급증|이용 급감|하차 증가 예상)$/,'')+' 해소',
        body:r.action+' 조치 후 판단 기준 아래로 내려감'+(now!==null&&r.metricAt!=null?' · '+int(r.metricAt)+' → '+int(now)+(r.unit||'')+' ('+signed(pct(now,r.metricAt))+')':''),evidence:'조치 시각('+r.at+')의 추정값과 현재 시간 추정값 비교',place:r.place});
    }
    items=next;
    if(!newHour){ // same hour, more data arrived: refresh the texts in place
      revealed=revealed.map(s=>items.find(x=>x.key===s.key)||s);for(const s of revealed)cardOf(s.key)?.replaceWith(card(s,{enter:false}));
      queue=items.filter(s=>!revealed.some(x=>x.key===s.key));if(queue.length&&!revealTimer)revealNext();header();markers();return;
    }
    clearTimeout(revealTimer);revealTimer=null;
    for(const c of cards.children)c.classList.add('past');
    const past=[...cards.querySelectorAll('.ops-card.past')];past.slice(8).forEach(c=>c.remove());
    revealed=[];queue=[...items];focusKey=null;cards.prepend(skeleton);cards.scrollLeft=0;revealTimer=setTimeout(revealNext,400);
  }
  function tick(){
    if(!active)return;header();
    const f=revealTimer?0:Math.min(1,(performance.now()-hourStart)/HOUR_MS);$('#opsBar').style.width=(auto?f*100:0)+'%';
    if(auto&&f>=1&&!queue.length&&!revealTimer){const h=getContext().hour;hourStart=performance.now();setHour(h>=LAST_HOUR||h<FIRST_HOUR?FIRST_HOUR:h+1);}
  }
  const ticker=setInterval(tick,500);

  cards.addEventListener('click',e=>{
    const c=e.target.closest('.ops-card');if(!c)return;const s=find(c.dataset.key);if(!s)return;const b=e.target.closest('button');
    if(!b){focus(s);return;}
    const ctx=getContext();
    if(b.dataset.dispatch){
      records.set(s.key,{status:'dispatched',action:b.dataset.dispatch,at:clock(),hourAt:ctx.hour,metricAt:s.metric?.value??null,unit:s.metric?.unit||'',title:s.title,place:s.place});
      notify('조치 지시 기록 · '+b.dataset.dispatch+' (시연 기록, 외부 전송 없음)');rerender(s.key);return;
    }
    const act=b.dataset.act;
    if(act==='focus')focus(s);
    else if(act==='dispatch'){const m=c.querySelector('.ops-menu');m.hidden=!m.hidden;}
    else if(act==='evidence'){const p=c.querySelector('.ops-evidence');p.hidden=!p.hidden;}
    else if(act==='facility')openFacility(s.facility);
    else if(act==='ack'){records.set(s.key,{status:'ack',at:clock(),title:s.title});rerender(s.key);}
    else if(act==='done'){
      const r=records.get(s.key)||{title:s.title,at:clock()};records.set(s.key,{...r,status:'done',doneAt:clock()});
      if(s.resolves){const o=records.get(s.resolves);if(o)records.set(s.resolves,{...o,status:'done',doneAt:clock()});}
      rerender(s.key);
    }
  });
  $('#opsAuto').onclick=()=>{auto=!auto;hourStart=performance.now();$('#opsAuto').setAttribute('aria-pressed',String(auto));$('#opsAuto').textContent=auto?'⏸ 시연 진행 중':'▶ 시연 진행';header();};
  $('#opsReport').onclick=()=>{const ctx=getContext(),text=situationReport(ctx,revealed.length?revealed:items,records),url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');
    a.href=url;a.download='seoul-station-ops-'+ctx.date+'-'+String(ctx.hour).padStart(2,'0')+'h.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('상황 보고서를 내려받았습니다.');};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)hourStart=performance.now();});

  return {
    element:root,update,markers,
    setActive(on){if(active===on)return;active=on;if(on){hourStart=performance.now();lastKey='';update();}else{clearTimeout(revealTimer);revealTimer=null;queue=[];skeleton.remove();}},
    pause(){if(!auto)return;auto=false;$('#opsAuto').setAttribute('aria-pressed','false');$('#opsAuto').textContent='▶ 시연 진행';},
    pick(id){if(!id.startsWith('sit:'))return;const key=id.slice(4),el=cardOf(key);if(!el)return;focusKey=key;for(const c of cards.children)c.classList.toggle('focused',c===el);el.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});markers();},
    destroy(){clearInterval(ticker);clearTimeout(revealTimer);},
  };
}

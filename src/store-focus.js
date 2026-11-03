// Store focus (역내상권분석): one store's facade on the map with its store-front corridor highlighted, and a panel
// that follows the clock — passages in front of the store, usage and sales over the day, conversion and ticket size.
// Passages come from the flow model (not a door counter); usage and sales are the processed demo values.
import {int} from './experience-core.js';
import {zoneSeries,seriesAt,valueAt,cumulativeAt,clockText} from './spatial-analysis.js';
import {nearbyFlow,FRONT_M} from './experience-analytics.js';
import {metres} from './manager-core.js';

// Chart margins in pixels; the chart itself is drawn at the size of its box (1 unit = 1 px) so text keeps its size.
const L=12,R=12,T=12,B=22;
// Conversion is not shown when too few people pass (a handful of passages makes any ratio meaningless).
export const MIN_PASSAGES=30;
const finite=a=>(a||[]).filter(Number.isFinite),pad=h=>String(h).padStart(2,'0');
const peakHour=a=>a?a.reduce((b,v,h)=>Number.isFinite(v)&&(b<0||v>a[b])?h:b,-1):-1;
const money=v=>v>=1e8?(v/1e8).toFixed(1)+'억':v>=1e4?(v/1e4).toFixed(v<1e5?1:0).replace(/\.0$/,'')+'만':int(v);

// Storefront view: from the corridor side, high enough to see the facade, the corridor in front and the people
// passing. Facade photo normal first; else the direction from the store to its walking access point. The scene picks
// the spot in front and the angle that the building leaves room for.
export function storeView(f,fallbackHeading=325){
  const r=f.reference,a=Array.isArray(f.access)?f.access:null;let n=r.focus?.cameraHeading;
  if(!Number.isFinite(n)&&a&&metres([r.lon,r.lat],a)>.5){const k=Math.cos(r.lat*Math.PI/180);n=(Math.atan2((a[0]-r.lon)*k,a[1]-r.lat)*180/Math.PI+360)%360;}
  if(!Number.isFinite(n))n=(fallbackHeading+180)%360;
  return {point:[r.lon,r.lat,a?a[2]:r.height-1.5],normal:Math.round(n*10)/10,pitch:-24,range:21};
}

// Relationship of passages and usage over one day: hours where both are known.
export function storeDay(series){
  const f=series?.flow,u=series?.usage,s=series?.sales,hours=[];
  for(let h=0;h<24;h++)if(Number.isFinite(f?.[h])&&Number.isFinite(u?.[h]))hours.push(h);
  const sum=(a,hs)=>hs.reduce((x,h)=>x+(Number.isFinite(a?.[h])?a[h]:0),0);
  let r=null;
  if(hours.length>=4){const a=hours.map(h=>f[h]),b=hours.map(h=>u[h]),ma=a.reduce((x,y)=>x+y,0)/a.length,mb=b.reduce((x,y)=>x+y,0)/b.length;
    let c=0,va=0,vb=0;a.forEach((x,i)=>{c+=(x-ma)*(b[i]-mb);va+=(x-ma)**2;vb+=(b[i]-mb)**2;});r=va>0&&vb>0?c/Math.sqrt(va*vb):null;}
  const passages=sum(f,hours),uses=sum(u,hours),salesHours=[...Array(24).keys()].filter(h=>Number.isFinite(s?.[h])&&Number.isFinite(u?.[h]));
  const soldUses=sum(u,salesHours);
  return {r,hours:hours.length,conversion:passages>0?uses/passages*100:null,ticket:soldUses>0?sum(s,salesHours)/soldUses:null,
    peak:{flow:peakHour(f),usage:peakHour(u),sales:peakHour(s)}};
}
// Conversion text: none when few pass, capped when the store draws more people than the modelled corridor carries.
export function conversionText(uses,passages){
  if(!Number.isFinite(uses)||!Number.isFinite(passages)||passages<MIN_PASSAGES)return {text:'—',note:'통행이 적은 시간'};
  const c=uses/passages*100;
  return c>100?{text:'100% 초과',note:'모형 밖 유입(승강장·열차 등) 포함',value:c}:{text:c.toFixed(c<10?2:1)+'%',value:c};
}

export function createStoreFocus({getContext,post,sceneWindow,setClock,playback,onEnter,onExit,zoneHeading=()=>325}){
  const stage=document.querySelector('.map-stage');
  stage.insertAdjacentHTML('beforeend','<section id="storeFocus" hidden aria-label="매장 포커스"><div class="sf-id"><figure class="sf-facade"><img id="sfFacade" alt=""><figcaption id="sfFacadeNote"></figcaption></figure><span class="eyebrow">STORE FOCUS</span><h3 id="sfName"></h3><small id="sfMeta"></small><div class="sf-buttons"><button type="button" id="sfPlay"></button><button type="button" id="sfExit">← 구역으로</button></div></div>'+
    '<div class="sf-main"><dl class="sf-metrics"><div class="sf-clock"><dt>시각</dt><dd id="sfClock"></dd><small id="sfClockNote"></small></div><div data-k="flow"><dt>매장 앞 통행</dt><dd id="sfFlow"></dd><small id="sfFlowNote"></small></div><div data-k="usage"><dt id="sfUsageLabel">이용</dt><dd id="sfUsage"></dd><small id="sfUsageNote"></small></div><div data-k="sales"><dt id="sfSalesLabel">매출</dt><dd id="sfSales"></dd><small id="sfSalesNote"></small></div><div data-k="conv"><dt>통행 대비 이용</dt><dd id="sfConv"></dd><small id="sfConvNote"></small></div><div data-k="ticket"><dt>객단가</dt><dd id="sfTicket"></dd><small id="sfTicketNote"></small></div></dl><p id="sfInsight"></p></div>'+
    '<div class="sf-chart"><svg id="sfChart" viewBox="0 0 480 150" role="img" aria-label="시간대별 매장 앞 통행·이용·매출"></svg><div class="sf-legend"><span data-k="flow" id="sfLegendFlow">매장 앞 통행</span><span data-k="usage" id="sfLegendUsage">이용</span><span data-k="sales" id="sfLegendSales">매출</span><em>차트를 누르면 그 시각으로</em></div></div></section>');
  const $=s=>stage.querySelector(s);
  let W=480,H=150;const X=h=>L+h/24*(W-L-R),yOf=(v,max)=>T+(H-T-B)*(1-Math.min(1,Math.max(0,v/Math.max(1,max))));
  let facility=null,series=null,day=null,started=false,lastHour=-1,approved=null,scale=null,suspect=false,view=null;
  const mode=()=>getContext().valueMode==='cumulative'?'cumulative':'hourly';
  fetch('/data/jury-frozen/approved-facades.json').then(r=>r.ok?r.json():null).then(v=>{approved=new Map((v?.replacements||[]).map(r=>[r.slot?.slot_alias,r]));if(facility)facade();}).catch(()=>{});

  // The approved storefront photo (sign or front, any aspect) beside the live 3D facade; none: the model surface only.
  function facade(){
    const r=approved?.get(facility.source_id),img=$('#sfFacade');img.hidden=!r;
    if(r){img.src=r.image_url;img.alt=facility.name+' 심사 승인 파사드';}
    $('#sfFacadeNote').textContent=r?'심사 승인 파사드':approved?'승인 사진 없음 · 3D 모델 면':'';
  }
  function pool(fr){if(!fr?.segments?.length)return [];const front=fr.segments.filter(s=>s.distance_m<=FRONT_M);return front.length?front:fr.segments.filter(s=>s.distance_m<=fr.segments[0].distance_m+3);}
  // Store-front corridor on the map: the segments behind the "매장 앞 통행" figure, wider where busier this hour.
  function drawMap(hour){
    const ctx=getContext(),net=ctx.network,edges=ctx.flowsByHour?.[hour]||[],vals=new Map();for(let i=0;i<edges.length;i+=2)vals.set(edges[i],edges[i+1]);
    const segs=pool(net.frontage?.[facility.id]).map(s=>({s,v:s.edges.reduce((a,i)=>a+(vals.get(i)||0),0),e:net.edges[s.edges[0]]})).filter(x=>x.e).sort((a,b)=>b.v-a.v);
    const max=Math.max(1,...segs.map(x=>x.v)),best=segs[0],marks=[];
    const mid=e=>e.coordinates[0].map((v,k)=>(v+e.coordinates.at(-1)[k])/2);
    if(best)marks.push({id:'store-front',kind:'progress',point:mid(best.e),label:'가장 붐비는 매장 앞 통로 · '+Math.round(best.s.distance_m)+'m'});
    if(Array.isArray(facility.access))marks.push({id:'store-access',kind:'access',point:facility.access,label:'출입점'});
    post({action:'manager-overlay',marks,lines:segs.slice(0,300).map(x=>({coordinates:[x.e.coordinates[0],x.e.coordinates.at(-1)],color:x===best?'#facc15':'#38bdf8',width:2+6*x.v/max}))});
  }
  function hoursBand(){
    const m=/(\d{1,2}):(\d{2})\s*~\s*(\d{1,2}):(\d{2})/.exec(facility.hours||'');if(!m)return '';
    const open=+m[1]+m[2]/60,close=+m[3]+m[4]/60;if(!(close>open))return '';
    const band=(a,b)=>b>a?'<rect class="sf-closed" x="'+X(a).toFixed(1)+'" y="'+T+'" width="'+(X(b)-X(a)).toFixed(1)+'" height="'+(H-T-B)+'"/>':'';
    return band(0,open)+band(close,24);
  }
  function drawChart(){
    const m=mode(),u=series.usage,s=series.sales,f=series.flow,box=$('#sfChart').getBoundingClientRect();
    if(box.width>0&&box.height>0){W=Math.max(240,Math.round(box.width));H=Math.max(80,Math.round(box.height));}$('#sfChart').setAttribute('viewBox','0 0 '+W+' '+H);
    const fMax=Math.max(1,...finite(f));
    const uMax=Math.max(1,...(m==='cumulative'?[cumulativeAt(u,24)||0]:finite(u))),sMax=Math.max(1,...(m==='cumulative'?[cumulativeAt(s,24)||0]:finite(s)));
    scale={fMax,uMax,sMax};
    const grid=[0,3,6,9,12,15,18,21,24].map(h=>'<line x1="'+X(h)+'" x2="'+X(h)+'" y1="'+T+'" y2="'+(H-B)+'" class="sf-grid"/>'+(h%6===0&&h<24?'<text x="'+X(h)+'" y="'+(H-7)+'" class="sf-tick">'+pad(h)+'시</text>':'')).join('');
    const area=f?'<path class="sf-flow" d="M'+X(0)+' '+(H-B)+' '+f.map((v,h)=>'L'+X(h+.5).toFixed(1)+' '+yOf(v||0,fMax).toFixed(1)).join(' ')+' L'+X(24)+' '+(H-B)+' Z"/>':'';
    const hours=Array.from({length:24},(_,h)=>h);
    // Running totals of usage and sales rise alike (both scaled to the day's total): usage as an area, sales as a line.
    const usage=!u?'':m==='cumulative'?'<path class="sf-usage-line" d="M'+X(0)+' '+(H-B)+' '+hours.concat(24).map(h=>'L'+X(h).toFixed(1)+' '+yOf(cumulativeAt(u,h)||0,uMax).toFixed(1)).join(' ')+' L'+X(24)+' '+(H-B)+' Z"/>'
      :hours.map(h=>{const v=u[h]||0,y=yOf(v,uMax);return '<rect class="sf-usage" x="'+(X(h)+2).toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+(X(1)-X(0)-4).toFixed(1)+'" height="'+(H-B-y).toFixed(1)+'"/>';}).join('');
    const sales=!s?'':'<path class="sf-sales" d="'+(m==='cumulative'?hours.concat(24).map((h,i)=>(i?'L':'M')+X(h).toFixed(1)+' '+yOf(cumulativeAt(s,h)||0,sMax).toFixed(1)):hours.map((h,i)=>(i?'L':'M')+X(h+.5).toFixed(1)+' '+yOf(s[h]||0,sMax).toFixed(1))).join(' ')+'"/>';
    $('#sfChart').innerHTML=hoursBand()+grid+area+usage+sales+'<line id="sfCursor" class="sf-cursor" y1="'+(T-4)+'" y2="'+(H-B)+'"/><circle id="sfDotF" r="4" class="sf-dot-flow"/><circle id="sfDotU" r="4" class="sf-dot-usage"/><circle id="sfDotS" r="4" class="sf-dot-sales"/>';
    const cum=m==='cumulative';
    $('#sfUsageLabel').textContent=cum?'이용 · 당일 누적':'이용 · 시간당';$('#sfSalesLabel').textContent=cum?'가공 매출 · 당일 누적':'가공 매출 · 시간당';
    $('#sfLegendFlow').textContent='매장 앞 통행'+(f?' · 최대 '+int(fMax)+'건/시':' · 경로 밖');
    $('#sfLegendUsage').textContent=(cum?'이용 누적 · 하루 ':'이용 · 최대 ')+(u?int(uMax)+(cum?'건':'건/시'):'미확보');
    $('#sfLegendSales').textContent=(cum?'매출 누적 · 하루 ':'매출 · 최대 ')+(s?money(sMax)+(cum?'원':'원/시'):'미확보');
  }
  function insight(){
    if(suspect)return '이날 이용·매출이 0으로 기록되어 미확보로 표시합니다. 앞뒤 날은 정상 영업 — 휴점 여부를 매장에 확인하세요.';
    if(series.offRoute)return '걸어서 30m 안에 유동 모형 경로가 없어 통행과의 관계는 계산하지 않습니다(승강장·선상 이동은 모형 미포함).';
    if(!series.usage)return '이 매장은 이날 이용 자료가 없어 통행만 보여줍니다.';
    const r=day.r,p=day.peak,parts=[];
    if(r!==null)parts.push((r>=.7?'통행과 이용이 뚜렷하게 함께 움직입니다':r>=.4?'통행과 이용이 함께 움직이는 편입니다':'통행과 이용의 연동이 약합니다')+' (상관 '+r.toFixed(2)+')');
    const peaks=[p.flow>=0&&'통행 '+pad(p.flow)+'시',p.usage>=0&&'이용 '+pad(p.usage)+'시',p.sales>=0&&'매출 '+pad(p.sales)+'시'].filter(Boolean);
    if(peaks.length)parts.push('피크 '+peaks.join(' · '));
    if(day.conversion!==null)parts.push(day.conversion>100?'하루 이용이 매장 앞 통행보다 많아 모형 밖 유입(승강장·열차 이용객 등) 비중이 큰 매장':'하루 통행 대비 이용 '+day.conversion.toFixed(2)+'%');
    return parts.join(' · ');
  }
  function load(){
    const ctx=getContext(),d=ctx.catalog.dates.indexOf(ctx.date);series=zoneSeries(ctx,[{id:facility.id}])[0];day=storeDay(series);
    suspect=Boolean(ctx.usage?.suspect?.[facility.id]?.days?.includes(d));
    const near=nearbyFlow(facility,ctx.network,ctx.flowsByHour?.[ctx.hour]||ctx.edgeValues||[]);
    $('#sfName').textContent=facility.name;$('#sfMeta').textContent=[facility.floor,facility.store?.category,facility.hours].filter(Boolean).join(' · ');
    $('#sfFlowNote').textContent=near?.offRoute?'30m 안 경로 없음':near?(near.basis==='front'?'매장 앞 통로 ':'가까운 통로 ')+Math.round(near.distance)+'m':'';
    $('#sfInsight').textContent=insight();$('#storeFocus').dataset.suspect=String(suspect);
    facade();drawChart();
  }
  function update(t){
    if(!facility||!series)return;const m=mode(),cum=m==='cumulative',u=series.usage,s=series.sales,f=series.flow;
    const fv=f?seriesAt(f,t):null,uh=seriesAt(u,t),sh=seriesAt(s,t),uv=valueAt(u,t,m),sv=valueAt(s,t,m);
    $('#sfClock').textContent=clockText(t);$('#sfClockNote').textContent=cum?'00:00부터 누적':pad(Math.floor(t))+'시대 자료 보간';
    $('#sfFlow').textContent=series.offRoute?'경로 밖':fv===null?'미확보':int(fv)+'건/시';
    $('#sfUsage').textContent=uv===null?'미확보':int(uv)+(cum?'건':'건/시');$('#sfSales').textContent=sv===null?'미확보':money(sv)+(cum?'원':'원/시');$('#sfSales').title=sv===null?'':int(sv)+'원';
    $('#sfUsageNote').textContent=suspect?'휴점 여부 확인 필요':cum&&u?'하루 '+int(cumulativeAt(u,24))+'건':'';$('#sfSalesNote').textContent=suspect?'휴점 여부 확인 필요':cum&&s?'하루 '+money(cumulativeAt(s,24))+'원':'';
    // Conversion and ticket: this hour (시간당) or the running totals (당일 누적), with the day's average beside it.
    const conv=series.offRoute?{text:'—',note:'매장 앞 통행 경로 밖'}:!u?{text:'—',note:'이용 미확보'}:cum?conversionText(cumulativeAt(u,t),f?cumulativeAt(f,t):null):conversionText(uh,fv);
    $('#sfConv').textContent=conv.text;
    $('#sfConvNote').textContent=conv.note||(day.conversion!==null&&day.conversion<=100&&Number.isFinite(conv.value)?'하루 평균 '+day.conversion.toFixed(2)+'% '+(conv.value>=day.conversion?'▲':'▼'):cum?'누적 이용 ÷ 누적 통행':'이 시간 이용 ÷ 매장 앞 통행');
    $('#storeFocus').querySelector('[data-k=conv]').dataset.trend=conv.note||day.conversion===null||!Number.isFinite(conv.value)?'':conv.value>=day.conversion?'up':'down';
    const tu=cum?cumulativeAt(u,t):uh,ts=cum?cumulativeAt(s,t):sh,ticket=tu>0&&Number.isFinite(ts)?ts/tu:null;
    $('#sfTicket').textContent=ticket===null?'—':int(ticket)+'원';$('#sfTicketNote').textContent=day.ticket?'하루 평균 '+int(day.ticket)+'원':'';
    const x=X(t);$('#sfCursor')?.setAttribute('x1',x);$('#sfCursor')?.setAttribute('x2',x);
    if(scale){const dot=(id,v,max)=>{const c=$(id);if(!c)return;c.style.display=v===null||v===undefined?'none':'';if(v!==null&&v!==undefined){c.setAttribute('cx',x);c.setAttribute('cy',yOf(v,max));}};
      dot('#sfDotF',fv,scale.fMax);dot('#sfDotU',cum?cumulativeAt(u,t):uh,scale.uMax);dot('#sfDotS',cum?cumulativeAt(s,t):sh,scale.sMax);}
    $('#sfPlay').textContent=playback.get()?'Ⅱ 일시정지':'▶ 시간 흐름 재생';
    const h=Math.floor(t);if(h!==lastHour){lastHour=h;drawMap(h);}
  }
  new ResizeObserver(()=>{if(facility&&series){drawChart();update(getContext().clock??getContext().hour);}}).observe($('.sf-chart'));
  $('#sfExit').onclick=()=>close();
  $('#sfPlay').onclick=()=>{started=false;playback.set(!playback.get());update(getContext().clock??getContext().hour);};
  $('#sfChart').addEventListener('click',e=>{const r=e.currentTarget.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*W,t=Math.max(0,Math.min(23.95,(x-L)/(W-L-R)*24));setClock(t);});

  function open(f){
    const ctx=getContext(),p=f?.reference;if(!p||!Number.isFinite(p.lon)||!Number.isFinite(p.height))return false;
    facility=f;lastHour=-1;document.body.dataset.storeFocus='true';$('#storeFocus').hidden=false;
    // Only the store's floor, opaque (a stacked translucent view blurs the storefront); zone flow lines step aside.
    post({action:'analysis-clear'});post({action:'floors',floors:[f.floor]});onEnter?.();
    sceneWindow()?.postMessage({type:'station-one:catalog-focus',requestId:Date.now(),focus:{floor:f.floor,longitude:p.lon,latitude:p.lat,height:p.height,label:f.name,imageId:f.source_id,...(p.focus||{}),sourceKind:p.focus?.sourceKind||'catalog'}},location.origin);
    // Close-up of the facade first (the scene tints the store's model), then back to the storefront and its corridor.
    view=storeView(f,zoneHeading());post({action:'camera',command:'look',...view});
    load();update(ctx.clock??ctx.hour);
    // Entering the focus starts the day moving so passages, usage and sales can be watched together.
    if(!playback.get()){started=true;playback.set(true);}
    stage.scrollIntoView({block:'start',behavior:'smooth'});
    return true;
  }
  function close({silent=false}={}){
    if(!facility)return;facility=null;series=null;delete document.body.dataset.storeFocus;$('#storeFocus').hidden=true;
    post({action:'manager-overlay-clear'});sceneWindow()?.postMessage({type:'station-one:catalog-focus-clear'},location.origin);
    if(started){started=false;playback.set(false);}
    if(!silent)onExit();
  }
  return {open,close,get active(){return Boolean(facility);},get id(){return facility?.id||null;},front(){if(facility)post({action:'camera',command:'look',...view});},
    refresh(){if(!facility)return;load();lastHour=-1;update(getContext().clock??getContext().hour);},
    tick(t){if(facility)update(t);}};
}

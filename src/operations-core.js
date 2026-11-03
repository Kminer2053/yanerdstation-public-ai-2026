// Operations decision support for the manager overview. Every situation is derived from the model estimates of the
// chosen date and hour (and the next hour): walking flows, arrivals, dwell, store usage/sales and the registers.
// Nothing here is live sensing; each item carries its evidence so the operator can judge it.
import {crowdComposition} from './crowd-core.js';
import {group,coordinateDistance,int} from './experience-core.js';
import {ZONES,inside,position} from './spatial-analysis.js';
import {suspectZeroDays} from './data-quality.js';
import {nearbyFlow} from './experience-analytics.js';

export const LEVELS={critical:{rank:0,label:'긴급'},warning:{rank:1,label:'주의'},advice:{rank:2,label:'권고'},data:{rank:3,label:'정비'},info:{rank:4,label:'현황'}};
const FLOOR_NAME={B3:'지하 3층',B2:'지하 2층',B1:'지하 1층','1F':'1층','2F':'2층','3F':'3층','4F':'4층'};
const pct=(a,b)=>b>0?Math.round((a/b-1)*100):null;
const signed=v=>v===null?'':(v>=0?'+':'')+v+'%';
const pairs=values=>{const m=new Map();for(let i=0;i<(values?.length||0);i+=2)m.set(values[i],values[i+1]);return m;};
const mid=e=>{const a=e.coordinates[0],b=e.coordinates.at(-1);return [(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2];};
export const polygonCenter=g=>{const ring=g?.type==='Polygon'?g.coordinates[0].slice(0,-1):g?.type==='Point'?[g.coordinates]:[];if(!ring.length)return null;return [0,1,2].map(k=>ring.reduce((s,p)=>s+p[k],0)/ring.length);};

// Human place name: analysis zone + the nearest registered facility on that floor.
export function placeName(catalog,point,floor){
  const zone=ZONES.find(z=>z.bounds&&inside(point,z,floor));let best=null,bd=28;
  for(const f of catalog.facilities){if(f.floor!==floor)continue;const p=position(f);if(!p)continue;const d=coordinateDistance([p[0],p[1],0],[point[0],point[1],0]);if(d<bd){bd=d;best=f;}}
  const near=best?best.name.replace(/\s*·.*$/,'')+' 앞':'';
  return [zone?.name||FLOOR_NAME[floor]||floor,near].filter(Boolean).join(' · ');
}
export function occupancyAt(ctx,hour,edgeValues){
  const {catalog,network,timeline,date}=ctx,hd=network?.headwayDwell?.endpoints||{},endpoints={};
  for(const e of catalog.endpoints){const h=hd[e.id],d=h?.dates?.[date];endpoints[e.id]={dwell:h?.dwell_seconds?.[hour]??180,ambient:d?.ambient_hourly?.[hour]??h?.ambient_hourly?.[hour]??0};}
  return crowdComposition({routes:network.routes,values:timeline[date]?.routes?.[hour]||[],edges:network.edges,edgeValues:edgeValues||[],endpoints});
}
// Separate hot spots along the walking network (at least `gap` metres apart) so one corridor is reported once.
export function hotspots(network,edgeValues,{limit=3,gap=30,walkOnly=true}={}){
  const out=[];
  for(const [i,v] of [...pairs(edgeValues)].sort((a,b)=>b[1]-a[1])){
    const e=network.edges[i];if(!e||!(v>0))continue;if(walkOnly!==(e.kind==='walk'))continue;
    const p=mid(e);if(out.some(h=>h.edge.from_floor===e.from_floor&&coordinateDistance(h.point,p)<gap))continue;
    out.push({index:i,edge:e,value:v,point:p,floor:e.from_floor});if(out.length>=limit)break;
  }
  return out;
}

export function situations(ctx){
  const {catalog,network,timeline,usage,sales,date,hour,flowsByHour}=ctx,t=timeline?.[date];
  if(!catalog||!network||!t)return [];
  const next=(hour+1)%24,prev=(hour+23)%24,now=flowsByHour?.[hour]||ctx.edgeValues||[],after=flowsByHour?.[next]||[],out=[];
  const at=(level,kind,subject,fields)=>out.push({id:[date,hour,kind,subject].join('|'),key:kind+'|'+subject,level,kind,date,hour,...fields});
  const max=network.max_edge_passages||1,nextEdge=pairs(after);

  // 1. Concurrent occupancy against the day's own profile.
  const series=occupancySeries(ctx);
  const occ=occupancyAt(ctx,hour,now),peakH=series.reduce((b,v,h)=>v!==null&&(b===null||v>series[b])?h:b,null);
  const share=peakH!==null&&series[peakH]?occ.expected/series[peakH]:null,dPrev=series[prev]!==null&&series[prev]!==undefined?pct(occ.expected,series[prev]):null,dNext=series[next]!==null&&series[next]!==undefined?pct(series[next],occ.expected):null;
  at(share!==null&&share>=.9?'warning':'info','occupancy','station',{title:'동시체류 추정 '+int(occ.expected)+'명'+(share!==null?' · 오늘 최대의 '+Math.round(share*100)+'%':''),
    body:'보행 중 '+int(occ.walking)+' · 출도착 대기 '+int(occ.dwell)+' · 비환승 체류 '+int(occ.ambient)+'명'+(dPrev!==null?' · 전 시간 대비 '+signed(dPrev):'')+(dNext!==null?' · '+next+'시 예상 '+signed(dNext):''),
    metric:{value:occ.expected,unit:'명'},evidence:'구간 통과량×길이÷1.25m/s + 경로 이동×출발·도착 체류시간 + 비환승 체류(시간당 인원 합산) · 오늘 최대 '+(peakH??'-')+'시 '+int(series[peakH]??null)+'명',
    place:null,actions:share!==null&&share>=.9?['focus','dispatch']:['focus'],dispatch:['역무 인력 증원','혼잡 안내 방송','상황판 공지']});

  // Quiet hours are the operator's window for cleaning and inspections.
  if(share!==null&&share<=.35&&occ.expected>0)at('advice','quiet','station',{title:'한산 시간대 · 시설 점검·청소 적기',
    body:'동시체류 '+int(occ.expected)+'명 (오늘 최대의 '+Math.round(share*100)+'%)'+(dNext!==null?' · '+next+'시 '+signed(dNext):'')+' · 혼잡 구간 작업을 이 시간에 배정하세요.',
    metric:{value:occ.expected,unit:'명'},evidence:'오늘 시간대별 동시체류 추정의 최대 대비 비율',place:null,actions:['dispatch'],dispatch:['청소 작업 배정','시설 점검 일정 반영','에스컬레이터 점검 배정']});
  // The busiest origin-destination movement this hour.
  const routeValues=t.routes?.[hour]||[],totalTrips=routeValues.reduce((a,b)=>a+(b||0),0),topRoute=routeValues.reduce((b,v,i)=>v>(routeValues[b]||0)?i:b,0),rt=network.routes?.[topRoute];
  if(rt&&routeValues[topRoute]>0){const ep=id=>catalog.endpoints.find(e=>e.id===id),from=ep(rt.from_endpoint),to=ep(rt.to_endpoint);
    if(from&&to)at('info','top-route',rt.route_id,{title:'최다 이동 · '+from.name+' → '+to.name,body:'시간당 '+int(routeValues[topRoute])+'건 · 전체 이동의 '+Math.round(routeValues[topRoute]/totalTrips*100)+'% · 경로 '+int(rt.distance_m)+'m, 층간연결 '+(rt.connections||0)+'회',
      metric:{value:routeValues[topRoute],unit:'건/시'},evidence:'IPF/RAS 시간대 경로 배분 결과 중 최대',place:polygonCenter(from.geometry)?{point:polygonCenter(from.geometry),floor:from.floor,label:from.name}:null,actions:['focus']});}
  // 2. Walking corridors carrying the most trips this hour.
  const names=new Set();
  for(const h of hotspots(network,now,{limit:3})){
    const ratio=h.value/max;if(ratio<.4)continue;const growth=pct(nextEdge.get(h.index)||0,h.value),name=placeName(catalog,h.point,h.floor);
    // Keyed by place so an action follows the same corridor into the next hour even when its busiest edge shifts.
    let subject=name;for(let k=2;names.has(subject);k++)subject=name+' '+k;names.add(subject);
    at(ratio>=.75?'critical':ratio>=.55?'warning':'advice','corridor',subject,{title:name+' 통행 집중',
      body:'시간당 '+int(h.value)+'건 통과 추정 · 분당 약 '+int(h.value/60)+'명 · 7월 최대의 '+Math.round(ratio*100)+'%'+(growth!==null?' · '+next+'시 '+signed(growth):''),
      metric:{value:h.value,unit:'건/시'},evidence:'이 구간을 지나는 경로별 이동량 합 (IPF/RAS 배분) · 7월 구간 최대 '+int(max)+'건/시',
      place:{point:h.point,floor:h.floor,label:name},actions:['focus','dispatch'],dispatch:['안내요원 배치','우회 동선 안내방송','임시 동선 분리 검토']});
  }
  // 3. Stairs and escalators carrying floor changes.
  const connections=new Map((network.connections||[]).map(c=>[c.id,c]));
  for(const v of verticalLoads(network,now).slice(0,2)){
    const c=connections.get(v.id),ratio=v.top.value/max;if(!c||ratio<.25)continue;
    const kind={escalator:'에스컬레이터',stairs:'계단',elevator:'엘리베이터'}[v.kind]||'층간연결',later=verticalLoads(network,after).find(x=>x.id===v.id),growth=later?pct(later.total,v.total):null;
    at(ratio>=.6?'warning':'advice','vertical',c.id,{title:c.name.replace(/\s*·\s*/,' ')+' 이동 집중',
      body:v.dirs.map(d=>d.from+'→'+d.to+' '+int(d.value)).join(' · ')+'건/시'+(growth!==null?' · '+next+'시 '+signed(growth):'')+' · '+kind+' 탑승 대기열 발생 가능',
      metric:{value:v.total,unit:'건/시'},evidence:c.name+' 층 전환 구간을 지나는 경로 이동량 (방향별)',place:{point:v.top.point,floor:v.top.floor,label:c.name},
      actions:['focus','dispatch'],dispatch:v.kind==='escalator'?['계단 병행 이용 안내','유도요원 배치','운행 방향 조정 검토']:['유도요원 배치','계단 안전 안내']});
  }
  // 4. Arrival waves at each origin (observed alightings) and the next hour's estimate.
  for(const e of catalog.endpoints){
    const h=network.headwayDwell?.endpoints?.[e.id],d=h?.dates?.[date];if(!d?.real_hourly)continue;
    const cur=d.real_hourly[hour]||0,before=d.real_hourly[prev]||0,later=d.real_hourly[next]||0,g=pct(cur,before),gn=pct(later,cur),place={point:polygonCenter(e.geometry),floor:e.floor,label:e.name};
    if(!place.point)continue;
    if(cur>=500&&g!==null&&g>=40)at(g>=80?'warning':'advice','arrival',e.id,{title:e.name+' 하차 급증',
      body:'시간당 '+int(cur)+'명 하차 · 전 시간 대비 '+signed(g)+' · 평균 체류 '+Math.round((h.dwell_seconds?.[hour]??0)/60)+'분',metric:{value:cur,unit:'명/시'},
      evidence:'원점 관측 하차('+(h.mode||'')+') '+prev+'시 '+int(before)+' → '+hour+'시 '+int(cur)+'명',place,actions:['focus','dispatch'],dispatch:['맞이방 안내인력 증원','도착 안내 방송 강화','환승 동선 안내판 점검']});
    else if(later>=500&&gn!==null&&gn>=35)at('advice','arrival-next',e.id,{title:e.name+' '+next+'시 하차 증가 예상',
      body:next+'시 '+int(later)+'명 예상 · 지금보다 '+signed(gn)+' · 선제 배치 검토',metric:{value:later,unit:'명/시'},
      evidence:'같은 날 '+next+'시 관측·추정 하차 자료',place,actions:['focus','dispatch'],dispatch:['안내인력 선제 배치','도착 안내 예고 방송']});
  }
  // 5. Stores far from their usual level at this hour (July average of the same hour).
  const day=catalog.dates.indexOf(date),stores=catalog.facilities.filter(f=>f.store&&position(f)),moves=[];
  // A lone zero day of a store that trades every day is a suspected gap in the provider's file, never a closure.
  const suspects=usage?.suspect||Object.fromEntries(Object.entries(suspectZeroDays(usage?.stores)).map(([id,x])=>[id,{...x,dates:x.days.map(d=>catalog.dates[d])}]));
  const closed=stores.filter(f=>suspects[f.id]?.dates?.includes(date));
  for(const f of stores){
    if(closed.includes(f))continue;const u=usage?.stores?.[f.id];const v=u?.hourly?.[day]?.[hour];if(!Number.isFinite(v))continue;
    const same=(u.hourly||[]).map(r=>r?.[hour]).filter(Number.isFinite);if(same.length<7)continue;const mean=same.reduce((a,b)=>a+b,0)/same.length;
    if(mean<8)continue;moves.push({f,v,mean,dev:pct(v,mean),sale:sales?.stores?.[f.id]?.hourly?.[hour]??null});
  }
  moves.sort((a,b)=>b.dev-a.dev);
  const up=moves.find(m=>m.dev>=30),down=[...moves].reverse().find(m=>m.dev<=-30);
  for(const [m,dir] of [[up,'up'],[down,'down']]){if(!m)continue;const place={point:position(m.f),floor:m.f.floor,label:m.f.name};
    at(dir==='up'?'advice':'warning','store-'+dir,m.f.id,{title:m.f.name+(dir==='up'?' 이용 급증':' 이용 급감'),
      body:hour+'시 이용 '+int(m.v)+'건 · 7월 같은 시간 평균 '+int(m.mean)+'건 대비 '+signed(m.dev)+(m.sale!==null?' · 매출 '+int(Math.round(m.sale/10000))+'만원':''),
      metric:{value:m.v,unit:'건'},evidence:'결제건수 기반 가공 이용인원 · 7월 '+hour+'시 평균과 비교',place,actions:['focus','dispatch'],
      dispatch:dir==='up'?['재고·계산대 점검 요청','주변 동선 안내']:['영업 상태 확인 요청','결제 장애 여부 확인']});}
  // 6. Plenty of passers-by, few customers: signage or promotion review.
  const conv=[];
  for(const f of stores){
    if(closed.includes(f))continue;const hourly=usage?.stores?.[f.id]?.hourly||[],u=hourly[day]?.[hour];if(!Number.isFinite(u))continue;
    // Only hours when this store usually trades (July mean of the hour), so opening hours are not read as low conversion.
    const usual=hourly.map(r=>r?.[hour]).filter(Number.isFinite);if(usual.length<7||usual.reduce((a,b)=>a+b,0)/usual.length<5)continue;
    const n=nearbyFlow(f,network,now);if(n?.value>=600)conv.push({f,u,pass:n.value,distance:n.distance,rate:u/n.value});
  }
  const low=conv.sort((a,b)=>a.rate-b.rate)[0];
  if(low&&low.rate<.02)at('advice','conversion',low.f.id,{title:low.f.name+' 통행 대비 이용 저조',
    body:'앞 통로 시간당 '+int(low.pass)+'건 통과 · 이용 '+int(low.u)+'건 ('+(low.rate*100).toFixed(1)+'%) · 사인물·프로모션 검토',metric:{value:low.rate*100,unit:'%'},
    evidence:'인근 통과(출입점에서 걸어서 '+Math.round(low.distance)+'m 앞 모형 이동 경로, 30m 안 최대)와 같은 시간 이용인원 비교',place:{point:position(low.f),floor:low.f.floor,label:low.f.name},actions:['focus','dispatch'],dispatch:['매장에 프로모션 제안','사인물 위치 점검']});
  // Only the store knows whether it was closed: ask first, then the provider if it traded.
  if(closed.length)at('data','suspect-zero',closed.map(f=>f.id).join(','),{title:'휴점 여부 확인 필요 '+closed.length+'곳',
    body:closed.map(f=>{const x=suspects[f.id],[a,b]=x.neighbours[x.dates.indexOf(date)];return f.name+' '+date.slice(5).replace('-','/')+' 결제 0건 (전날 '+int(a)+' · 다음날 '+int(b)+'건)';}).join(' / ')+' — 휴점 여부를 매장에 확인하세요. 영업했다면 원본 재확인 요청',
    evidence:'제공 원본 일자별 시트의 총객수·총매출이 0으로 기록됨 · 평소 하루 '+int(suspects[closed[0].id].median)+'건 영업 매장 · 휴점이면 0이 맞고, 영업했다면 집계 누락 · 확인 전까지 지표는 미확보로 표시',
    place:{point:position(closed[0]),floor:closed[0].floor,label:closed[0].name},actions:['focus','dispatch'],dispatch:['매장에 휴점 여부 확인 요청','제공기관에 원본 재확인 요청']});
  // 7. Register gaps that block guidance.
  const noAccess=catalog.facilities.filter(f=>group(f)==='매장'&&!f.access_id);
  if(noAccess.length)at('data','no-access','stores',{title:'방문 경로 미연결 매장 '+noAccess.length+'곳',body:noAccess.slice(0,3).map(f=>f.name).join(', ')+(noAccess.length>3?' 외 '+(noAccess.length-3)+'곳':'')+' · 보행 출입점이 없어 길안내 목적지에서 빠집니다.',
    evidence:'시설 등록부 access_id 미지정',place:position(noAccess[0])?{point:position(noAccess[0]),floor:noAccess[0].floor,label:noAccess[0].name}:null,actions:['focus','facility'],facility:noAccess[0].id});
  // Registered opening hours that do not cover this hour's sales (the observed profile is kept; the register may be stale).
  const outside=stores.filter(f=>{
    const sale=sales?.stores?.[f.id]?.hourly?.[hour];if(!(sale>0))return false;const m=(f.hours||'').match(/(\d{1,2}):(\d{2})\s*[~–-]\s*(\d{1,2}):(\d{2})/);if(!m)return false;
    const start=+m[1]*60 + +m[2],end=+m[3]*60 + +m[4],t=hour*60;return end>start?(t+60<=start||t>=end):(t>=end&&t+60<=start);
  });
  if(outside.length)at('data','hours',outside.map(f=>f.id).join(','),{title:'등록 영업시간 밖 매출 '+outside.length+'곳',body:outside.slice(0,3).map(f=>f.name).join(', ')+(outside.length>3?' 외 '+(outside.length-3)+'곳':'')+' · '+hour+'시 매출이 있으나 등록 영업시간 밖입니다. 등록 시간을 점검하세요.',
    evidence:'가공 매출 시간대 구성비와 시설 등록부 영업시간 비교',place:{point:position(outside[0]),floor:outside[0].floor,label:outside[0].name},actions:['focus','facility'],facility:outside[0].id});
  if(catalog.analysis_stale)at('data','stale','analysis',{title:'시설 변경 후 유동 분석 갱신 필요',body:'등록부 수정 이력과 유동 배분 기준 버전이 다릅니다. 현재 분석은 리비전 334 기준입니다.',evidence:'catalog.analysis_stale',place:null,actions:[]});
  return out.sort((a,b)=>LEVELS[a.level].rank-LEVELS[b.level].rank);
}
export function occupancySeries(ctx){return Array.from({length:24},(_,h)=>ctx.flowsByHour?.[h]?occupancyAt(ctx,h,ctx.flowsByHour[h]).expected:null);}
// Floor-changing edges of each registered connection, per direction.
export function verticalLoads(network,edgeValues){
  const by=new Map();
  for(const [i,v] of pairs(edgeValues)){
    const e=network.edges[i];if(!e||e.kind==='walk'||!e.connection_id||e.from_floor===e.to_floor||!(v>0))continue;
    const c=by.get(e.connection_id)||{id:e.connection_id,kind:e.kind,dirs:[],total:0,top:null};
    c.dirs.push({from:e.from_floor,to:e.to_floor,value:v});c.total+=v;if(!c.top||v>c.top.value)c.top={value:v,point:mid(e),floor:e.from_floor};by.set(e.connection_id,c);
  }
  return [...by.values()].sort((a,b)=>b.total-a.total);
}
// Current value of a situation subject, for follow-up after an action (null when it cannot be measured).
export function metricFor(ctx,key,place=null){
  const [kind,subject]=[key.slice(0,key.indexOf('|')),key.slice(key.indexOf('|')+1)],{network,catalog,date,hour}=ctx,now=ctx.flowsByHour?.[hour]||ctx.edgeValues||[];
  if(kind==='corridor'){if(!place?.point)return null;let best=0;for(const [i,v] of pairs(now)){const e=network.edges[i];if(e?.kind==='walk'&&e.from_floor===place.floor&&coordinateDistance(mid(e),place.point)<=25)best=Math.max(best,v);}return best;}
  if(kind==='vertical')return verticalLoads(network,now).find(v=>v.id===subject)?.total??0;
  if(kind==='arrival'||kind==='arrival-next')return network.headwayDwell?.endpoints?.[subject]?.dates?.[date]?.real_hourly?.[hour]??null;
  if(kind==='store-up'||kind==='store-down')return ctx.usage?.stores?.[subject]?.hourly?.[catalog.dates.indexOf(date)]?.[hour]??null;
  if(kind==='occupancy')return occupancyAt(ctx,hour,now).expected;
  return null;
}

// Plain-text situation report for handover or a briefing.
export function situationReport(ctx,items,records){
  const lines=['# 서울역 운영 상황 보고 ('+ctx.date+' '+ctx.hour+':00 기준 · 추정 모델)',''];
  for(const s of items){const r=records.get(s.key);lines.push('- ['+LEVELS[s.level].label+'] '+s.title+' — '+s.body+(r?' → '+r.status+(r.action?' ('+r.action+')':'')+' '+r.at:''));}
  lines.push('','※ 유동량·체류는 관측 원점 자료를 배분한 추정치이며 실측 센서가 아닙니다. 조치 기록은 시연 기록입니다.');
  return lines.join('\n');
}

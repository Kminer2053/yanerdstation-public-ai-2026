import {esc,int,sum,coordinateDistance,group} from './experience-core.js';
import {nearbyFlow} from './experience-analytics.js';

// Reviewable analysis windows, not lease parcels or observed catchment areas.
export const ZONES=[
  {id:'hall-east',name:'2층 동쪽 맞이방',floor:'2F',bounds:[126.9711,37.5538,126.9719,37.5546],heading:250,pitch:-18},
  {id:'hall-center',name:'2층 중앙 맞이방',floor:'2F',bounds:[126.97045,37.5538,126.9711,37.5546],heading:325,pitch:-18},
  {id:'hall-west',name:'2층 서쪽 맞이방',floor:'2F',bounds:[126.9693,37.5538,126.97045,37.5546],heading:35,pitch:-18},
  {id:'bridge-east',name:'2층 선상 동측 매장',floor:'2F',bounds:[126.9708,37.5532,126.9718,37.5538],heading:325,pitch:-15},
  {id:'bridge-west',name:'2층 선상 서측 매장',floor:'2F',bounds:[126.9693,37.5532,126.9708,37.5538],heading:325,pitch:-15},
  {id:'platform',name:'1층 승강장·출입구',floor:'1F',bounds:[126.968,37.551,126.973,37.557],heading:325,pitch:-28},
  {id:'retail-3',name:'3층 매장·식당가',floor:'3F',bounds:[126.969,37.553,126.972,37.555],heading:145,pitch:-18},
  {id:'subway',name:'B1 지하철 환승·상가',floor:'B1',bounds:[126.968,37.551,126.974,37.558],heading:325,pitch:-28},
  {id:'arex-2',name:'B2 공항철도 연결',floor:'B2',bounds:[126.968,37.551,126.974,37.558],heading:325,pitch:-28},
  {id:'arex-3',name:'B3 공항철도 대합실',floor:'B3',bounds:[126.968,37.551,126.974,37.558],heading:325,pitch:-28},
];
export function position(f){return f.reference?[f.reference.lon,f.reference.lat,f.reference.height]:null;}
export function inside(point,zone,floor){
  if(!point||floor!==zone.floor)return false;
  if(zone.radius)return coordinateDistance([point[0],point[1],0],[zone.center[0],zone.center[1],0])<=zone.radius;
  const [w,s,e,n]=zone.bounds;return point[0]>=w&&point[0]<e&&point[1]>=s&&point[1]<n;
}
export function spatialRows({catalog,usage,network,edgeValues,sales,date,hour},zone){
  const day=catalog.dates.indexOf(date);
  return catalog.facilities.filter(f=>group(f)==='매장'&&position(f)&&(!zone||inside(position(f),zone,f.floor))).map(f=>({
    id:f.id,name:f.name,floor:f.floor,point:position(f),approved:!!f.store,
    usage:usage.stores[f.id]?.hourly[day]?.[hour]??null,dailyUsage:usage.stores[f.id]?.daily[day]??null,
    sales:sales?.stores[f.id]?.hourly?.[hour]??null,dailySales:sales?.stores[f.id]?.daily??null,
    nearby:nearbyFlow(f,network,edgeValues),area:f.store?.area??null,hours:f.hours,
  }));
}
export function zonePassages(zone,network,values){
  // Count a route once if any of its same-floor points enters the zone.
  // Never sum adjacent edge volumes: that would multiply the same trip.
  return sum(network.routes.map((r,i)=>r.coordinates.some((p,k)=>inside(p,zone,r.floors[k]))?values[i]||0:0));
}
// Store table. mode 'hourly' shows rates at time t (건·원 per hour); 'cumulative' shows the day's total up to t.
// Cells carry data-live attributes so the smooth clock can update them between hourly reloads.
export function performanceTable(rows,{hour,manager=false,authorized=false,mode='hourly',t=hour,series=null}={}){
  const cum=mode==='cumulative',clock=clockText(t),unit=cum?'':'/시';
  const val=(r,i,k)=>series?.[i]?valueAt(series[i][k],t,mode):r[k];
  const head=(name,basis)=>'<th>'+name+'<br><i data-live-clock-range>'+(cum?'00:00~'+clock+' 누적':clock)+'</i> · '+basis+'</th>';
  return '<div class="table-scroll performance-table"><table><caption>이용인원은 결제건수 기반 가공값 · 시간대 값은 구성비 배분 추정 · '+(cum?'당일 누적':'시간당 값')+'</caption><thead><tr><th>매장 / 층</th>'+head('이용인원','건'+unit)+head('가공 매출','원'+unit)+'<th>인근 통과<br><i data-live-clock>'+clock+'</i> · 건/시</th>'+(manager?'<th>일 이용인원</th><th>일 가공 매출</th>':'')+'</tr></thead><tbody>'+
    rows.map((r,i)=>'<tr><th><button data-select="'+esc(r.id)+'"><span class="store-number">'+(i+1)+'</span>'+esc(r.name)+'</button><small>'+esc(r.floor)+(r.approved?'':' · 영업자료 미매칭')+'</small></th><td data-live-cell="usage" data-row="'+i+'">'+int(val(r,i,'usage'))+'</td><td'+(authorized?' data-live-cell="sales" data-row="'+i+'"':'')+'>'+(authorized?int(val(r,i,'sales')):'권한 필요')+'</td><td>'+(r.nearby?nearbyText(r.nearby,true):'미확보')+'</td>'+(manager?'<td>'+int(r.dailyUsage)+'</td><td>'+(authorized?int(r.dailySales):'권한 필요')+'</td>':'')+'</tr>').join('')+'</tbody></table></div>';
}

// Smooth playback: value of an hourly series at fractional time t (12.5 = 12:30), between this hour and the next.
export const clockText=t=>String(Math.floor(t)).padStart(2,'0')+':'+String(Math.floor((t%1)*60+1e-6)).padStart(2,'0');
// Day's total up to t: whole hours before t plus the elapsed part of the current hour (missing hours count as 0).
export function cumulativeAt(series,t){
  if(!Array.isArray(series)||!series.some(Number.isFinite))return null;const h=Math.max(0,Math.min(24,Math.floor(t))),f=Math.max(0,Math.min(1,t-h));
  let s=0;for(let k=0;k<h&&k<24;k++)s+=Number.isFinite(series[k])?series[k]:0;if(h<24&&Number.isFinite(series[h]))s+=series[h]*f;return s;
}
export const valueAt=(series,t,mode)=>mode==='cumulative'?cumulativeAt(series,t):seriesAt(series,t);
export function seriesAt(series,t){
  if(!Array.isArray(series))return null;const h=Math.max(0,Math.min(23,Math.floor(t))),f=Math.max(0,Math.min(1,t-h)),a=series[h],b=series[Math.min(23,h+1)];
  if(!Number.isFinite(a))return null;return Number.isFinite(b)&&h<23?a+(b-a)*f:a;
}
// Display of the nearby-passage metric: value with its walking distance, or 경로 밖 when no modelled route is within reach.
export function nearbyText(n,withDistance=false){
  if(n?.offRoute)return '경로 밖';if(!n||!Number.isFinite(n.value))return '미확보';
  return int(n.value)+(withDistance&&Number.isFinite(n.distance)?'<small class="walk-distance">'+Math.round(n.distance)+'m 앞</small>':'');
}
// 24-hour series per store row for the zone view: usage (건), processed sales (원), nearby passages (건/시).
export function zoneSeries(ctx,rows){
  const {catalog,usage,sales,network,flowsByHour,date}=ctx,day=catalog.dates.indexOf(date);
  return rows.map(r=>{
    const f=catalog.facilities.find(f=>f.id===r.id),first=f&&nearbyFlow(f,network,flowsByHour?.[0]||[]);
    const flow=first&&!first.offRoute&&flowsByHour?Array.from({length:24},(_,h)=>nearbyFlow(f,network,flowsByHour[h]||[])?.value??null):null;
    return {usage:usage?.stores?.[r.id]?.hourly?.[day]?.slice()||null,sales:sales?.stores?.[r.id]?.hourly?.slice()||null,flow,offRoute:Boolean(first?.offRoute)};
  });
}
// Zone totals per hour for the headline figures (trips once per route, store usage and sales sums).
export function zoneTotals(ctx,zone,series){
  const t=ctx.timeline?.[ctx.date];
  const total=k=>Array.from({length:24},(_,h)=>{const v=series.map(s=>s[k]?.[h]).filter(Number.isFinite);return v.length?sum(v):null;});
  return {passages:Array.from({length:24},(_,h)=>t?zonePassages(zone,ctx.network,t.routes[h]):null),usage:total('usage'),sales:total('sales')};
}
// View heading that shows most store fronts: each facade photo's cameraHeading is its outward normal,
// so the camera looks along normal+180. Stores without a facade photo do not vote.
export function frontHeading(catalog,rows,fallback=325){
  const normals=rows.map(r=>catalog.facilities.find(f=>f.id===r.id)?.reference?.focus?.cameraHeading).filter(Number.isFinite);
  if(!normals.length)return fallback;let best=fallback,score=-1;
  for(let h=0;h<360;h+=5){const s=normals.reduce((a,n)=>a+Math.max(0,Math.cos((n+180-h)*Math.PI/180)),0);if(s>score+1e-9){score=s;best=h;}}
  return best;
}

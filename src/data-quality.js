// Store data quality at load time. The provider's file can record a whole day as 0 for a store that trades every
// day (e.g. 서울지하통로편의점 on 2026-07-18: 0 between 556 and 439 customers). Such a day is shown as missing
// (null, "미확보") until the store confirms whether it was closed; the source values themselves are not changed.

// A store trades regularly when most days carry customers; a lone zero day there is a suspected gap.
export function suspectZeroDays(stores,{minActiveDays=25,minMedian=30}={}){
  const out={};
  for(const [id,s] of Object.entries(stores||{})){
    const daily=s?.daily||[],active=daily.filter(v=>v>0);if(active.length<minActiveDays)continue;
    const sorted=[...active].sort((a,b)=>a-b),median=sorted[sorted.length>>1];if(median<minMedian)continue;
    const days=daily.map((v,d)=>v===0?d:null).filter(d=>d!==null);
    if(days.length)out[id]={days,median,neighbours:days.map(d=>[daily[d-1]??null,daily[d+1]??null])};
  }
  return out;
}
export function maskUsage(usage,dates){
  const suspects=suspectZeroDays(usage?.stores);
  for(const [id,x] of Object.entries(suspects)){const s=usage.stores[id];for(const d of x.days){s.daily[d]=null;if(s.hourly)s.hourly[d]=null;}}
  usage.suspect=Object.fromEntries(Object.entries(suspects).map(([id,x])=>[id,{...x,dates:x.days.map(d=>dates[d])}]));
  return usage;
}
// Sales for one date follow the same days (same provider row).
export function maskSales(sales,usage,dates){
  if(!sales?.stores||!usage?.suspect)return sales;
  const d=dates.indexOf(sales.date);
  for(const [id,x] of Object.entries(usage.suspect)){
    const s=sales.stores[id];if(!s)continue;
    for(const k of x.days)if(Array.isArray(s.trend))s.trend[k]=null;
    if(x.days.includes(d)){s.daily=null;s.hourly=null;}
    if(Number.isFinite(s.available_days))s.available_days=Math.max(0,s.available_days-x.days.length);
  }
  return sales;
}

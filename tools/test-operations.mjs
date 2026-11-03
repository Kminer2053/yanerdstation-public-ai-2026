import assert from 'node:assert/strict';
import fs from 'node:fs';
import {situations,LEVELS,occupancySeries,occupancyAt,verticalLoads,metricFor,placeName,situationReport} from '../src/operations-core.js';
import {maskUsage,maskSales} from '../src/data-quality.js';

// Operations feed situations must come from the data of the chosen hour and read like decisions, not boilerplate.
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const catalog=json('public/data/experience/catalog.json'),network=json('public/data/experience/network.json');network.headwayDwell=json('public/data/experience/headway-dwell.json');network.frontage=json('public/data/experience/store-frontage.json').stores;
const timeline=json('public/data/experience/timeline.json'),usage=json('public/data/experience/usage.json');
const ctxFor=(date,hour)=>({catalog,network,timeline,usage,sales:null,date,hour,flowsByHour:json('public/data/experience/flows/'+date+'.json')});

let total=0;const kinds=new Set(),levels=new Set();
for(const date of ['2026-07-06','2026-07-18','2026-07-31'])for(const hour of [6,8,12,18,22]){
  const ctx=ctxFor(date,hour),list=situations(ctx);total+=list.length;
  assert(list.length>=3&&list.length<=20,date+' '+hour+'시: '+list.length+' situations');
  assert.equal(new Set(list.map(s=>s.key)).size,list.length,'one card per subject');
  assert.deepEqual(list.map(s=>LEVELS[s.level].rank),[...list.map(s=>LEVELS[s.level].rank)].sort((a,b)=>a-b),'most urgent first');
  for(const s of list){
    kinds.add(s.kind);levels.add(s.level);
    assert(!/undefined|NaN|null/.test(s.title+s.body),s.title+' | '+s.body);
    assert(s.evidence,'every situation states its evidence');
    if(s.place)assert(s.place.point.every(Number.isFinite)&&catalog.endpoints.concat(catalog.facilities).length&&typeof s.place.floor==='string',s.title+' has a map place');
    if(s.dispatch)assert(s.dispatch.length>=2,s.title+' offers actions');
  }
  const occ=list.find(s=>s.kind==='occupancy');assert(occ&&occ.metric.value===occupancyAt(ctx,hour,ctx.flowsByHour[hour]).expected,'occupancy card matches the crowd estimate');
}
for(const k of ['occupancy','corridor','vertical','arrival','conversion','no-access','suspect-zero','quiet','top-route'])assert(kinds.has(k),'situation kind '+k+' appears');
for(const l of ['critical','warning','advice','data'])assert(levels.has(l),'level '+l+' appears');

// Morning peak on 18 July: the busiest corridors are urgent and named after where they are.
const peak=situations(ctxFor('2026-07-18',8));
const urgent=peak.filter(s=>s.level==='critical');assert(urgent.length>=2&&urgent.every(s=>s.kind==='corridor'&&/맞이방|선상|층/.test(s.title)),urgent.map(s=>s.title).join(' / '));
assert(/분당 약 \d+명/.test(urgent[0].body)&&/7월 최대의 \d+%/.test(urgent[0].body));
assert.equal(occupancySeries(ctxFor('2026-07-18',8)).indexOf(Math.max(...occupancySeries(ctxFor('2026-07-18',8)))),8,'8시 is the day peak');
assert(peak.find(s=>s.kind==='occupancy').level==='warning','the day peak raises the occupancy card');

// Escalators are reported once per connection with both directions.
const v=verticalLoads(network,json('public/data/experience/flows/2026-07-18.json')[8])[0];
assert(v.dirs.length===2&&v.dirs[0].from!==v.dirs[1].from&&v.total===v.dirs[0].value+v.dirs[1].value);
assert.equal(peak.filter(s=>s.kind==='vertical').length,new Set(peak.filter(s=>s.kind==='vertical').map(s=>s.key)).size);

// Public arithmetic fixture: a deliberate lone zero tests warning and masking, not a real store result.
const gapDay=situations(ctxFor('2026-07-18',12)),gap=gapDay.find(s=>s.kind==='suspect-zero');
assert(gap&&gap.title.startsWith('휴점 여부 확인 필요')&&/스토리웨이 \(지하통로\) 07\/18 결제 0건 \(전날 121 · 다음날 141건\) — 휴점 여부를 매장에 확인하세요/.test(gap.body)&&gap.dispatch.includes('매장에 휴점 여부 확인 요청'),gap?.body);
assert(!gapDay.some(s=>/스토리웨이 \(지하통로\)/.test(s.title)&&s.kind!=='suspect-zero'));
const masked=maskUsage(structuredClone(usage),catalog.dates);
assert.deepEqual(Object.values(masked.suspect).map(x=>x.dates).sort(),[['2026-07-12'],['2026-07-18']]);
assert.equal(masked.stores['DEST-B01WL039-S02'].daily[17],null);assert.equal(masked.stores['DEST-B01WL039-S02'].daily[16],121);
const sale={date:'2026-07-18',stores:{'DEST-B01WL039-S02':{daily:0,hourly:Array(24).fill(0),trend:Array(31).fill(1),available_days:31}}};
maskSales(sale,masked,catalog.dates);assert.equal(sale.stores['DEST-B01WL039-S02'].daily,null);assert.equal(sale.stores['DEST-B01WL039-S02'].trend[17],null);assert.equal(sale.stores['DEST-B01WL039-S02'].available_days,30);
assert(!situations({...ctxFor('2026-07-18',12),usage:masked}).some(s=>/스토리웨이 \(지하통로\)/.test(s.title)&&s.kind==='store-down'));

// Follow-up: a corridor keeps its key across hours and its load can be measured at its place.
const c8=peak.find(s=>s.kind==='corridor'),c9=situations(ctxFor('2026-07-18',9)).find(s=>s.key===c8.key);
assert(c9,'the same corridor is recognised the next hour');
const later=metricFor(ctxFor('2026-07-18',11),c8.key,c8.place);assert(Number.isFinite(later)&&later<c8.metric.value,'the corridor eases later in the morning: '+c8.metric.value+' → '+later);
assert.equal(placeName(catalog,c8.place.point,c8.place.floor).split(' · ')[0],c8.title.split(' · ')[0]);

const report=situationReport(ctxFor('2026-07-18',8),peak,new Map([[c8.key,{status:'dispatched',action:'안내요원 배치',at:'08:12'}]]));
assert(report.includes('안내요원 배치')&&report.includes('추정')&&report.split('\n').length>=peak.length+3);
console.log('PASS: '+total+' situations over 15 date-hours ('+[...kinds].length+' kinds), morning peak urgent corridors '+urgent.length+', escalators by direction, follow-up '+c8.metric.value.toFixed(0)+'→'+later.toFixed(0)+' at 11시');

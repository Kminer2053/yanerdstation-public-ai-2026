import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ZONES,spatialRows,seriesAt,cumulativeAt,valueAt,zoneSeries,zoneTotals,frontHeading,performanceTable} from '../src/spatial-analysis.js';
import {nearbyFlow,FRONT_M} from '../src/experience-analytics.js';
import {buildStoreFrontage,WALK_LIMIT} from './build-store-frontage.mjs';

// Zone retail view: values glide between hours, columns face the storefronts, and the figures match the data.
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const catalog=json('public/data/experience/catalog.json'),network=json('public/data/experience/network.json'),usage=json('public/data/experience/usage.json'),timeline=json('public/data/experience/timeline.json');
const date='2026-07-18',flowsByHour=json('public/data/experience/flows/'+date+'.json'),day=catalog.dates.indexOf(date);
const frontage=json('public/data/experience/store-frontage.json');network.frontage=frontage.stores;

// 인근 통과: the committed frontage file is reproducible from the walking grid and the flow network.
const rebuilt=buildStoreFrontage({catalog,network,graph:json('public/data/experience/walk-graph.json')});
assert.deepEqual(rebuilt.stores,frontage.stores,'store-frontage.json matches tools/build-store-frontage.mjs');
for(const s of Object.values(frontage.stores))assert(s.segments.every(x=>x.distance_m<=WALK_LIMIT&&x.edges.every(i=>network.edges[i]?.kind==='walk')),'segments are walkable route steps within '+WALK_LIMIT+'m');
const store=n=>catalog.facilities.find(f=>f.name===n),at12=f=>nearbyFlow(f,network,flowsByHour[12]);
for(const n of ['TRUEDAN','소월당','마포만두','금메달토스트','부산미도어묵','영주당','육회바른연어'])assert(at12(store(n))?.offRoute,n+' (선상 동측) is off the modelled routes, not a far 22/h edge');
assert(Math.round(at12(store('디자인스킨')).value)===1216&&at12(store('디자인스킨')).distance<=12,'디자인스킨: the busy corridor 11 m away, not the 52/h side step');
assert(Math.round(at12(store('스토리웨이 · 중앙 맞이방')).value)>=4000,'중앙 맞이방 store sees the main hall line');
assert(at12(store('인생닭강정'))?.value>5000,'a store without an access point is anchored at its storefront');
// Store-front corridor first: the busiest segment within FRONT_M m walk; otherwise the nearest walking line.
const vals12=new Map();for(let i=0;i<flowsByHour[12].length;i+=2)vals12.set(flowsByHour[12][i],flowsByHour[12][i+1]);
const segValue=x=>x.edges.reduce((a,i)=>a+(vals12.get(i)||0),0);
for(const f of catalog.facilities.filter(f=>f.store)){const n=at12(f),s=frontage.stores[f.id];if(n.offRoute)continue;
  const front=s.segments.filter(x=>x.distance_m<=FRONT_M),pool=front.length?front:s.segments.filter(x=>x.distance_m<=s.segments[0].distance_m+3);
  assert.equal(n.value,Math.max(...pool.map(segValue)),f.name+' uses its '+(front.length?'front corridor':'nearest walking line'));assert.equal(n.basis,front.length?'front':'nearest');}
const kakao=at12(store('카카오프렌즈'));assert(kakao.basis==='front'&&kakao.distance<=FRONT_M&&Math.round(kakao.value)===4129,'카카오프렌즈: its own corridor 14 m away, not the busier line 29 m away');
const jihatongro=at12(store('스토리웨이 (지하통로)'));assert(jihatongro.basis==='nearest'&&jihatongro.distance>FRONT_M,'no corridor within 15 m: nearest walking line');

// 당일 누적: whole hours before t plus the elapsed part of this hour.
assert.equal(cumulativeAt([1,2,3,...Array(21).fill(0)],2.5),4.5);assert.equal(cumulativeAt([...Array(24).fill(2)],24),48);assert.equal(cumulativeAt([null,null,...Array(22).fill(null)],5),null);
assert.equal(valueAt([0,10,...Array(22).fill(20)],1.5,'hourly'),15);assert.equal(valueAt([0,10,...Array(22).fill(20)],1.5,'cumulative'),5);

// Interpolation: halfway between hours, held at the last hour, missing stays missing.
assert.equal(seriesAt([0,10,...Array(22).fill(20)],1.5),15);
assert.equal(seriesAt([...Array(23).fill(1),9],23.7),9);
assert.equal(seriesAt([null,5,...Array(22).fill(5)],0.5),null);
assert.equal(seriesAt([4,null,...Array(22).fill(5)],0.5),4,'a missing next hour holds the current value');
assert.equal(seriesAt(null,3),null);

{const ctx={catalog,usage,network,timeline,flowsByHour,date,hour:12,edgeValues:flowsByHour[12],sales:null},rows=spatialRows(ctx,ZONES[1]),ser=zoneSeries(ctx,rows);
  const hourly=performanceTable(rows,{hour:12,authorized:true,mode:'hourly',t:12.5,series:ser}),cum=performanceTable(rows,{hour:12,authorized:true,mode:'cumulative',t:12.5,series:ser});
  assert(hourly.includes('12:30')&&hourly.includes('건/시')&&!hourly.includes('누적 · 건'),'hourly table header');assert(cum.includes('00:00~12:30 누적'),'cumulative table header');
  const i=rows.findIndex(r=>ser[rows.indexOf(r)].usage),u=ser[i].usage;assert(cum.includes('>'+new Intl.NumberFormat('ko-KR',{maximumFractionDigits:0}).format(cumulativeAt(u,12.5))+'<'),'cumulative cell value');}
let stores=0;
for(const zone of ZONES){
  const ctx={catalog,usage,network,timeline,flowsByHour,date,hour:12,edgeValues:flowsByHour[12],sales:null};
  const rows=spatialRows(ctx,zone),series=zoneSeries(ctx,rows),totals=zoneTotals(ctx,zone,series);stores+=rows.length;
  rows.forEach((r,i)=>{
    const s=series[i];if(s.usage){assert.equal(s.usage.length,24);assert.deepEqual(s.usage,usage.stores[r.id].hourly[day]);}
    for(const h of [8,12,18]){const f=catalog.facilities.find(f=>f.id===r.id),n=nearbyFlow(f,network,flowsByHour[h]);if(n?.offRoute)assert(s.offRoute&&s.flow===null,r.name+' off-route');else if(n)assert(Math.abs(n.value-s.flow[h])<1e-6,r.name+' flow '+h+'시 matches the nearby passage metric');}
  });
  for(const h of [9,12,20]){const v=series.map(s=>s.usage?.[h]).filter(Number.isFinite);assert.equal(totals.usage[h],v.length?v.reduce((a,b)=>a+b,0):null);}
  const mid=seriesAt(totals.usage,12.5);if(Number.isFinite(totals.usage[12])&&Number.isFinite(totals.usage[13]))assert(mid>=Math.min(totals.usage[12],totals.usage[13])&&mid<=Math.max(totals.usage[12],totals.usage[13]));
  // Front view: the chosen heading faces at least as many storefronts as the old fixed zone heading.
  const normals=rows.map(r=>catalog.facilities.find(f=>f.id===r.id)?.reference?.focus?.cameraHeading).filter(Number.isFinite);
  const facing=h=>normals.filter(n=>Math.cos((n+180-h)*Math.PI/180)>0.2).length,h=frontHeading(catalog,rows,zone.heading);
  assert(facing(h)>=facing(zone.heading),zone.id+' front heading '+h+' faces '+facing(h)+' fronts vs '+facing(zone.heading));
  if(!normals.length)assert.equal(h,zone.heading,'no facade photos: keep the zone heading');
}
const bridge=ZONES.find(z=>z.id==='bridge-east'),brows=spatialRows({catalog,usage,network,edgeValues:flowsByHour[12],sales:null,date,hour:12},bridge);
const bh=frontHeading(catalog,brows,bridge.heading),bn=brows.map(r=>catalog.facilities.find(f=>f.id===r.id)?.reference?.focus?.cameraHeading).filter(Number.isFinite);
assert(bn.filter(n=>Math.cos((n+180-bh)*Math.PI/180)>0.2).length>=Math.ceil(bn.length/2),'2층 선상 동측: most storefronts face the camera');
console.log('PASS: frontage reproducible ('+Object.values(frontage.stores).filter(s=>s.segments.length).length+'/'+Object.keys(frontage.stores).length+' facilities reach a route within '+WALK_LIMIT+'m walk), 선상 동측 off-route, interpolation, '+stores+' zone stores with 24-hour usage/flow series matching the data, zone totals, front headings (2층 선상 동측 '+bh+'°)');

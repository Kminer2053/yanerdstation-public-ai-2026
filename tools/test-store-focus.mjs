import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ZONES,spatialRows,zoneSeries} from '../src/spatial-analysis.js';
import {storeDay,conversionText,storeView,MIN_PASSAGES} from '../src/store-focus.js';
import {maskUsage} from '../src/data-quality.js';

// Store focus (역내상권분석): one store's day — passages in front, usage, sales — and the storefront camera.
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const catalog=json('public/data/experience/catalog.json'),network=json('public/data/experience/network.json'),usage=maskUsage(json('public/data/experience/usage.json'),catalog.dates);
network.frontage=json('public/data/experience/store-frontage.json').stores;
const date='2026-07-18',flowsByHour=json('public/data/experience/flows/'+date+'.json'),ctx={catalog,usage,network,flowsByHour,date,hour:12,edgeValues:flowsByHour[12],sales:null};
const store=n=>catalog.facilities.find(f=>f.name===n),seriesOf=n=>zoneSeries(ctx,[{id:store(n).id}])[0];

// Relationship over the day: Pearson r of passages and usage on hours where both are known; peaks; day conversion.
const pearson=(a,b)=>{const m=x=>x.reduce((s,v)=>s+v,0)/x.length,ma=m(a),mb=m(b);let c=0,va=0,vb=0;a.forEach((x,i)=>{c+=(x-ma)*(b[i]-mb);va+=(x-ma)**2;vb+=(b[i]-mb)**2;});return c/Math.sqrt(va*vb);};
{const s=seriesOf('카카오프렌즈'),d=storeDay(s),h=[...Array(24).keys()].filter(h=>Number.isFinite(s.flow[h])&&Number.isFinite(s.usage[h]));
  assert.equal(d.hours,24);assert(Math.abs(d.r-pearson(h.map(h=>s.flow[h]),h.map(h=>s.usage[h])))<1e-12,'r is the Pearson correlation of the hourly series');
  assert.equal(d.peak.flow,s.flow.indexOf(Math.max(...s.flow)));assert.equal(d.peak.usage,s.usage.indexOf(Math.max(...s.usage)));assert.equal(d.peak.sales,-1,'no sales loaded: no sales peak');
  assert(Math.abs(d.conversion-h.reduce((a,h)=>a+s.usage[h],0)/h.reduce((a,h)=>a+s.flow[h],0)*100)<1e-9,'day conversion = day usage ÷ day passages');
  assert.equal(d.ticket,null,'no sales: no ticket size');}
{const s={flow:Array(24).fill(100),usage:Array(24).fill(2),sales:Array(24).fill(10000)},d=storeDay(s);
  assert.equal(d.r,null,'flat series: correlation undefined, not 0');assert.equal(d.conversion,2);assert.equal(d.ticket,5000);}
// A day recorded as all zero by the provider is masked (휴점 확인): no usage, so no relationship is claimed.
{const s=seriesOf('스토리웨이 (지하통로)'),d=storeDay(s);assert(usage.suspect[store('스토리웨이 (지하통로)').id]?.dates.includes(date),'suspect day');
  assert.equal(s.usage,null);assert.equal(d.r,null);assert.equal(d.conversion,null);assert(s.flow,'passages in front are still shown');}
// Off the modelled routes: no passages, no relationship.
{const s=seriesOf('육회바른연어');assert(s.offRoute&&s.flow===null);assert.equal(storeDay(s).r,null);}

// Conversion wording: few passages → none; more uses than modelled passages → capped with the reason.
assert.deepEqual(conversionText(3,MIN_PASSAGES-1),{text:'—',note:'통행이 적은 시간'});
assert.deepEqual(conversionText(null,500),{text:'—',note:'통행이 적은 시간'});
assert.equal(conversionText(250,200).text,'100% 초과');assert.match(conversionText(250,200).note,/모형 밖 유입/);
assert.equal(conversionText(28,4115).text,'0.68%');assert.equal(conversionText(30,200).text,'15.0%');

// Storefront camera: facade photo normal first, else towards the store's walking access point, else the zone front.
const bearing=(a,b)=>{const k=Math.cos(a[1]*Math.PI/180);return (Math.atan2((b[0]-a[0])*k,b[1]-a[1])*180/Math.PI+360)%360;};
{const f=store('카카오프렌즈'),v=storeView(f,300);assert.equal(v.normal,Math.round(f.reference.focus.cameraHeading*10)/10);assert.deepEqual(v.point,[f.reference.lon,f.reference.lat,f.access[2]],'looks at the facade base on the walking level');}
{const f=store('스토리웨이 편의점 · 7,8번 타는곳 남측'),r=f.reference;assert(!Number.isFinite(r.focus?.cameraHeading));
  assert(Math.abs(storeView(f,300).normal-bearing([r.lon,r.lat],f.access))<.06,'no facade photo: faces its access point');}
{const f=store('육회바른연어');assert.equal(storeView(f,300).normal,120,'access at the booth itself: the zone front (300° view → 120° normal)');}
{const f=store('뚜레쥬르');assert.equal(storeView(f).point[2],f.reference.height-1.5,'no access point: facade reference minus eye height');}
let focusable=0;
for(const zone of ZONES)for(const r of spatialRows({...ctx,sales:null},zone)){const f=catalog.facilities.find(f=>f.id===r.id);if(!f?.reference)continue;
  const v=storeView(f,zone.heading||325);assert(Number.isFinite(v.normal)&&v.normal>=0&&v.normal<360&&v.point.every(Number.isFinite),f.name+' storefront view');focusable++;}
console.log('PASS: store focus — day relationship (Pearson r, peaks, conversion, ticket), suspect/off-route days claim nothing, conversion wording, storefront camera for '+focusable+' zone stores');

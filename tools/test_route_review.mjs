import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeFocus, locationPoint, mentionedNodes, pointUrl, numberOrNull, filterDestinations, initialReviewTab } from '../src/route-review-core.js';

const data=JSON.parse(await readFile(new URL('../public/data/route-review/register.json',import.meta.url)));
const current=JSON.parse(await readFile(new URL('../public/data/route-review/current-data.json',import.meta.url)));
const destinations=JSON.parse(await readFile(new URL('../public/data/route-review/destinations.json',import.meta.url)));
const {register:r,matching:m}=data;
assert.equal(r.priority_nodes.length,59);assert.equal(r.locator_register.length,100);
assert.equal(m.directional_route_reviews.length,44);assert.equal(m.gateway_groups.length,15);
assert.equal(r.connector_inventory.length,169);
assert.equal(current.sourceRowCount,53761);assert.equal(current.series.length,44);
const nodes=new Set(r.priority_nodes.map(x=>x.review_id)), locs=new Set(r.locator_register.map(x=>x.locator_id));
assert.equal(nodes.size,59);assert.equal(locs.size,100);
for(const g of m.gateway_groups){for(const id of g.candidate_node_ids)assert.ok(nodes.has(id),id);for(const id of g.source_locator_ids)assert.ok(locs.has(id),id);assert.equal(g.selected_node_id,null);}
for(const x of m.external_location_matching){assert.ok(locs.has(x.locator_id)||nodes.has(x.locator_id),x.locator_id);for(const id of x.nearby_osm_locator_ids)assert.ok(locs.has(id),id);}
for(const x of m.directional_route_reviews){assert.equal(x.user_approved,false);assert.equal(x.routing_enabled,false);assert.equal(x.direction_verified,false);assert.equal(x.walkable_polyline,null);assert.ok(m.modes[x.origin_mode]);assert.ok(m.modes[x.destination_mode]);}
for(const x of r.priority_nodes){assert.equal(x.user_approved,false);assert.equal(x.routing_enabled,false);assert.equal(x.walkable_threshold,null);}
const allPoints=[...r.priority_nodes,...r.locator_register.map(locationPoint)];
for(const p of allPoints){const f=makeFocus(p);assert.ok(f,`${p.review_id} missing focus`);assert.ok(Number.isFinite(f.height));const u=new URL(pointUrl(p,'https://example.test'));assert.equal(u.searchParams.get('imageId'),p.review_id);assert.equal(Number(u.searchParams.get('lon')),p.lon);assert.equal(u.origin,'https://example.test');}
assert.equal(numberOrNull(null),null);assert.equal(numberOrNull(''),null);assert.equal(numberOrNull(0),0);
assert.equal(initialReviewTab('routes',true),'routes');assert.equal(initialReviewTab('nodes',true),'nodes');
assert.equal(initialReviewTab(null,true),'destinations');assert.equal(initialReviewTab('invalid',false),'routes');
assert.equal(makeFocus({lon:null,lat:37.55}),null);
assert.equal(makeFocus({lon:126.97,lat:NaN}),null);
assert.equal(makeFocus({lon:0,lat:0}),null);
assert.equal(makeFocus({lon:126.97,lat:37.55,floor:'UNKNOWN'}).referenceOnly,true);
assert.equal(makeFocus(r.priority_nodes.find(x=>x.review_id==='A-G-076091')).height,-11.07);
assert.deepEqual(mentionedNodes('G1, G10, W-C 부근',r.priority_nodes).map(x=>x.review_id),['G1','W-C']);
for(const value of Object.values(current.modes)){for(const id of value.series)assert.ok(current.series.some(s=>s.id===id),id);}
assert.ok(current.modes.RAIL.series.every(id=>id.startsWith('RAIL-PAX-')&&!id.endsWith('-LOW')));
assert.equal(current.modes.GTX.series.length,0);
assert.ok(current.series.filter(s=>s.id.startsWith('GG-BUS-')).every(s=>s.first_date.startsWith('2025')));

// Lightweight DOM harness: exercises rendering, filters and bridge without a browser.
const elements=new Map(), messages=[], windowListeners=new Map();
class Element {
  value='';innerHTML='';textContent='';dataset={};listeners={};
  classList={toggle(){}};
  addEventListener(type,fn){this.listeners[type]=fn;}
  querySelectorAll(){return [];}
  setAttribute(){}
  showModal(){}
}
globalThis.document={querySelector(selector){if(!elements.has(selector))elements.set(selector,new Element());return elements.get(selector);},querySelectorAll(){return [];}};
globalThis.location={origin:'https://example.test',href:'https://example.test/routes/',hash:''};
globalThis.history={replaceState(){}};
globalThis.window={addEventListener(type,fn){windowListeners.set(type,fn);}};
const iframe=document.querySelector('#stationMap');
iframe.contentWindow={postMessage(message,origin){messages.push({message,origin});}};
globalThis.fetch=async url=>({ok:true,json:async()=>url.endsWith('destinations.json')?destinations:url.endsWith('current-data.json')?current:data});
await import('../src/route-review.js');
await new Promise(resolve=>setImmediate(resolve));
const content=document.querySelector('#content');
assert.equal((content.innerHTML.match(/data-route=/g)||[]).length,44);
assert.equal(messages.length,0,'Do not move before Cesium ready');
windowListeners.get('message')({origin:location.origin,source:iframe.contentWindow,data:{type:'station-one:catalog-map-ready',vworldReady:false}});
assert.equal(messages.length,0);
windowListeners.get('message')({origin:location.origin,source:iframe.contentWindow,data:{type:'station-one:catalog-map-ready',vworldReady:true}});
assert.equal(messages.at(-1).message.focus.imageId,'G1');
const selectTab=value=>document.querySelector('#tabs').listeners.click({target:{closest:()=>({dataset:{tab:value}})}});
selectTab('locations');assert.equal((content.innerHTML.match(/<tr>/g)||[]).length,101);
selectTab('nodes');assert.equal((content.innerHTML.match(/<tr>/g)||[]).length,60);
for(const p of allPoints){
  content.listeners.click({target:{closest:()=>({dataset:{point:p.review_id}})}});
  const last=messages.at(-1);assert.equal(last.origin,location.origin);assert.equal(last.message.focus.imageId,p.review_id);assert.equal(last.message.focus.floor,makeFocus(p).floor);
  windowListeners.get('message')({origin:location.origin,source:iframe.contentWindow,data:{type:'station-one:route-review-applied',requestId:last.message.requestId,ok:true,floor:last.message.focus.floor}});
}
selectTab('routes');document.querySelector('#mode').value='BUS';document.querySelector('#mode').listeners.change();
assert.equal((content.innerHTML.match(/data-route=/g)||[]).length,10);
document.querySelector('#search').value='nothing-exists-here';document.querySelector('#search').listeners.input();
assert.ok(content.innerHTML.includes('검색 결과가 없습니다'));
selectTab('destinations');
assert.equal((content.innerHTML.match(/data-destination=/g)||[]).length,destinations.items.length);
assert.equal(document.querySelector('#modeFilter').hidden,true);
assert.equal(document.querySelector('#destinationFilters').hidden,false);
const items=destinations.items,points=items.flatMap(d=>d.points);
assert.equal(new Set(items.map(x=>x.id)).size,items.length);
assert.equal(new Set(points.map(x=>x.review_id)).size,points.length);
for(const p of points){
  const f=makeFocus(p);assert.ok(f,`Missing destination location ${p.review_id}`);
  assert.ok(p.source_ids.length);assert.ok(p.floor);assert.ok(!f.referenceOnly,`Unknown floor/height ${p.review_id}`);
  content.listeners.click({target:{closest:()=>({dataset:{point:p.review_id}})}});
  const last=messages.at(-1);assert.equal(last.message.focus.imageId,p.review_id);
  assert.equal(last.message.type,f.catalog?'station-one:catalog-focus':'station-one:route-review-focus');
  const url=new URL(pointUrl(p,location.origin));assert.equal(url.searchParams.get('imageId'),p.review_id);
  if(f.catalog){assert.equal(url.searchParams.get('model'),f.model);if(f.targetAssetId)assert.equal(url.searchParams.get('targetAssetId'),f.targetAssetId);
    for(const key of ['surfaceArea','cropWidth','cropHeight'])if(f[key]!==null&&f[key]!==undefined)assert.equal(Number(url.searchParams.get(key)),f[key]);}
  windowListeners.get('message')({origin:location.origin,source:iframe.contentWindow,data:{type:f.catalog?'station-one:catalog-focus-applied':'station-one:route-review-applied',requestId:last.message.requestId,ok:true,floor:f.floor}});
}
assert.equal(filterDestinations(items,{query:'DINGDONG'}).length,1);
assert.equal(filterDestinations(items,{query:'F02WL017-S04'})[0].label,'DINGDONG');
assert.equal(filterDestinations(items,{query:'올리브영'}).length,1);
assert.equal(filterDestinations(items,{query:'코레일 여행센터'}).length,1);
assert.equal(filterDestinations(items,{query:'스토리웨이'}).length,3);
assert.equal(filterDestinations(items,{category:'이동편의',floor:'2F',kind:'shop'}).length,0);
assert.ok(items.find(d=>d.label.includes('화장실')&&!d.points.length));
for(const alias of ['F02WL072-S38','F02WL072-S40','F02WL072-S41','F02WL072-S44','F02WL072-S45','F02WL072-S03','F02WL072-S04','F02WL072-S05','F02WL072-S10'])assert.ok(!points.some(p=>p.review_id===alias));
for(const alias of ['TRUEDAN-FRONT-S01','F02WL072-S11','INFO-BOOTH-01-S01','INFO-CENTER-SOUTH-S01','TRAIN-MATES-FRONT-S01','ZIMCARRY-FRONT-S01'])assert.ok(points.some(p=>p.review_id===alias),`Missing current facility ${alias}`);
document.querySelector('#destinationFloor').value='2F';document.querySelector('#destinationFloor').listeners.change();
assert.equal((content.innerHTML.match(/data-destination=/g)||[]).length,items.filter(d=>d.floor==='2F').length);
document.querySelector('#destinationKind').value='shop';document.querySelector('#destinationKind').listeners.change();
assert.equal((content.innerHTML.match(/data-destination=/g)||[]).length,items.filter(d=>d.floor==='2F'&&d.kind==='shop').length);
selectTab('routes');assert.ok(content.innerHTML.includes('검색 결과가 없습니다'),'Route search survives destination tab');
assert.equal(document.querySelector('#mode').value,'BUS');
console.log(`PASS: ${items.length} destinations, ${points.length} map links, real source IDs, floor/type filters, deduplication, retired exclusions, catalog camera bridge.`);
console.log('PASS: source preservation, 44 routes, 159 mapped points, 15 gateway groups, bridge readiness, filters, July series classes.');

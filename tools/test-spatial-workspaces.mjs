import assert from 'node:assert/strict';
import {mapSource} from '../server/map-source.js';
import {inside,zonePassages,spatialRows} from '../src/spatial-analysis.js';
import {placeMapLabels} from '../src/map-label-layout.js';
const request=(path,options)=>new Request('https://station.test'+path,options);
let calls=0;
const fake=async(url,options)=>{calls++;assert.equal(url,'https://cdn.vworld.kr/TDServer/services/map4/7Iuk64K0/S202103/tileset.json');assert.equal(options.redirect,'error');assert.equal(options.headers.Cookie,undefined);assert.equal(options.headers.Authorization,undefined);return Response.json({root:{children:[{content:{uri:'B_1_2_3.b3dm'}}]}});};
const response=await mapSource(request('/api/map-source/S202103/tileset.json',{headers:{Cookie:'private-session',Authorization:'private-auth'}}),fake);
assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
assert.equal((await response.json()).root.children[0].content.uri,'/api/map-source/S202103/B_1_2_3.b3dm');
for(const p of ['/api/map-source/S202103/secret','/api/map-source/OTHER/tileset.json','/api/map-source/S202103/tileset.json?url=https://evil.test'])assert.equal((await mapSource(request(p),fake)).status,400);
assert.equal((await mapSource(request('/api/map-source/S202103/tileset.json',{method:'POST'}),fake)).status,405);assert.equal(calls,1);
assert.equal(await mapSource(request('/not-map'),fake),null);
assert.equal((await mapSource(request('/api/map-source/S202103/tileset.json'),async()=>new Response('',{status:403}))).status,502);
assert.equal((await mapSource(request('/api/map-source/S202103/tileset.json'),async()=>{throw Object.assign(Error(),{name:'TimeoutError'})})).status,504);
assert.equal((await mapSource(request('/api/map-source/S202103/tileset.json'),async()=>Response.json({root:{content:{uri:'https://evil.test/file'}}}))).status,504);
const zone={floor:'2F',bounds:[126.97,37.55,126.98,37.56]},point=[126.975,37.555,36];
assert(inside(point,zone,'2F'));assert(!inside(point,zone,'1F'));
assert.equal(zonePassages(zone,{routes:[{coordinates:[point,point,point],floors:['2F','2F','2F']},{coordinates:[point,point],floors:['1F','1F']}]},[12,99]),12);
for(const [width,height] of [[1000,600],[390,440]]){
 const boxes=placeMapLabels(Array.from({length:7},()=>({x:width/2,y:height/2})),width,height).filter(Boolean);
 assert(boxes.length>0);
 for(const [i,a]of boxes.entries()){assert(a.x>=0&&a.x+a.w<=width&&a.y>=0&&a.y+a.h<=height);for(const b of boxes.slice(i+1))assert(!(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y));}
}
console.log('PASS: map relay allowlist, auth isolation, no persistence, failure states, same-floor zones, once-per-route aggregation, desktop/mobile label collision layout.');

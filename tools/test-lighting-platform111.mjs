import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stationLightingZone,zoneDaylight,SEOUL_LIGHTING_ZONES as z} from '../app/station-zone-lighting.js';
import {acquirePlatformFilm,PLATFORM111_FILM} from '../app/platform111-playback.js';
import {PLATFORM111,platform111Spans,platform111Homography} from '../app/seoul-platform111.js';
assert.equal(z.slabs.length,137);assert.equal(z.floors.length,457);
assert.equal(stationLightingZone([-66,72,10.6]),'led');
assert.equal(stationLightingZone([-104,48,10.6]),'daylight');
assert.equal(stationLightingZone([-66,72,16.7]),null); // 3F must not inherit 2F lighting.
assert.equal(stationLightingZone([999,999,10.6]),null);
assert.equal(zoneDaylight(0),0);assert.equal(zoneDaylight(23),0);assert(zoneDaylight(12)>.95);
assert(z.slabs.every(t=>t.every(p=>p[2]-z.ceilingDrop>13.3)));
assert.deepEqual(PLATFORM111.tids.photoQuad,[[.58349609375,.3246527777777778],[.96923828125,.3107638888888889],[.9931640625,.5095486111111112],[.5908203125,.5251736111111112]]);
const h=platform111Homography(PLATFORM111.tids.photoQuad);assert(h.flat().every(Number.isFinite));
for(const s of [PLATFORM111.media,PLATFORM111.tids]){const spans=platform111Spans(s);assert(Math.abs(spans.reduce((n,p)=>n+p.physicalLength,0)-(s.end-s.start))<.01);}
for(const url of [PLATFORM111_FILM.poster,PLATFORM111_FILM.mp4,PLATFORM111_FILM.webm])assert(fs.statSync('public'+url).size>10000);
// Decoder lifecycle with no actual network, GPU, or physical camera.
class Video extends EventTarget{constructor(){super();this.dataset={};this.paused=true;this.readyState=0;this.playCount=0;}setAttribute(){}canPlayType(){return 'probably';}load(){}play(){this.paused=false;this.playCount++;return Promise.resolve();}pause(){this.paused=true;}removeAttribute(){}remove(){this.removed=true;}}
const video=new Video(),reduce=new EventTarget();reduce.matches=false;
globalThis.document=new EventTarget();document.hidden=false;document.createElement=()=>video;document.body={append(){}};
globalThis.matchMedia=()=>reduce;
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{connection:{saveData:false}}});
const viewer={scene:{requestRender(){}}};let frames=0;
const a=acquirePlatformFilm(viewer,v=>{if(v)frames++;}),b=acquirePlatformFilm(viewer,()=>{});
assert.equal(video.playCount,0);a.setActive(true);await Promise.resolve();assert.equal(video.playCount,1);assert(video.muted&&video.loop&&video.playsInline);
b.setActive(true);a.setActive(false);assert.equal(video.paused,false);
video.readyState=4;video.dispatchEvent(new Event('loadeddata'));assert(frames>0);
document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));assert.equal(video.paused,true);
document.hidden=false;document.dispatchEvent(new Event('visibilitychange'));await Promise.resolve();assert.equal(video.paused,false);
reduce.matches=true;reduce.dispatchEvent(new Event('change'));assert.equal(video.paused,true);assert.equal(a.motionAllowed,false);
a.destroy();assert(!video.removed);b.destroy();assert(video.removed);
console.log('PASS: 2F LED/daylight/3F boundaries, slab clearance, 111m UV spans, timetable preservation, media files, shared decoder, hidden tab/reduced-motion/disposal.');

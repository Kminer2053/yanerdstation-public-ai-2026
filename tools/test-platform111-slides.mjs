import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import {acquirePlatformSlides,PLATFORM111_SLIDES} from '../app/platform111-slides.js';
import {autoEnvironment,zoneEnvironment} from '../src/feedback-core.js';

const timers=new Map(),doc=new EventTarget(),reduce=new EventTarget();let serial=0,renders=0;
doc.hidden=false;reduce.matches=false;
const runtime={document:doc,reduce,setTimeout(fn,ms){assert.equal(ms,4000);timers.set(++serial,fn);return serial;},clearTimeout(id){timers.delete(id);}};
const viewer={scene:{requestRender(){renders++;}}},left=[],right=[];
const a=acquirePlatformSlides(viewer,i=>left.push(i),runtime),b=acquirePlatformSlides(viewer,i=>right.push(i),runtime);
const tick=()=>{assert.equal(timers.size,1);const [id,fn]=[...timers][0];timers.delete(id);fn();};
assert.equal(timers.size,0);a.setActive(true);b.setActive(true);assert.equal(timers.size,1);
tick();tick();assert.deepEqual(left,[0,1,0]);assert.deepEqual(right,left);assert.equal(renders,2);
a.setActive(false);assert.equal(timers.size,1);b.setActive(false);assert.equal(timers.size,0);
b.setActive(true);doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(timers.size,0);
doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));tick();assert.equal(right.at(-1),1);
reduce.matches=true;reduce.dispatchEvent(new Event('change'));assert.equal(timers.size,0);assert.equal(right.at(-1),0);
reduce.matches=false;reduce.dispatchEvent(new Event('change'));assert.equal(timers.size,1);
a.destroy();b.destroy();assert.equal(timers.size,0);
doc.dispatchEvent(new Event('visibilitychange'));assert.equal(timers.size,0);
for(const path of [PLATFORM111_SLIDES.image,PLATFORM111_SLIDES.text])assert(fs.statSync('public'+path).size>100);
const source=fs.readFileSync('app/seoul-platform111.js','utf8');
assert(!source.includes('acquirePlatformFilm'));assert(!source.includes('setInterval'));
assert(source.includes('fract(st.x*repeatCount)')); // Train logos and text must never be mirrored.
assert(source.includes('frameIndex>0.5?textRepeat:slideRepeat'));
assert.equal(PLATFORM111_SLIDES.textAspect,3);
const photo=await sharp('public'+PLATFORM111_SLIDES.image).metadata();
assert.equal(PLATFORM111_SLIDES.aspect,photo.width/photo.height);
assert(PLATFORM111_SLIDES.image.endsWith('/ktx-poster.webp'));
assert(PLATFORM111_SLIDES.creditHtml.includes('CC BY-SA 4.0'));
assert(source.includes('addCreditToNextFrame(photoCredit)'));
assert(source.includes('slideImage:C.Material.DefaultImageId'));
assert(source.includes('texture(slideImage,uv)'));
assert(!source.includes('uniforms.image=slide')); // Catalog loads cannot replace the slide texture.

const bridge=[126.9708,37.5535,38],hall=[126.9708,37.554,38];
assert.equal(autoEnvironment(bridge),'outdoor');
assert.equal(zoneEnvironment('led',bridge),'indoor'); // Exact roof coverage takes priority.
assert.equal(zoneEnvironment('daylight',hall),'outdoor');
assert.equal(zoneEnvironment(null,bridge),'outdoor');
assert.equal(autoEnvironment([bridge[0],bridge[1],44]),'indoor'); // Other floors unchanged.
assert.equal(autoEnvironment([bridge[0],bridge[1],8]),'indoor');
console.log('PASS: shared 4-second two-frame clock, visibility/reduced motion/cleanup, static assets, upright text, covered LED / open 2F / terrace daylight / other floors.');

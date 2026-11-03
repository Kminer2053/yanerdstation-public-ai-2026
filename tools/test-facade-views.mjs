import assert from 'node:assert/strict';
import fs from 'node:fs';

// Camera corrections from tools/audit-facade-views.mjs must stay sane and point at registered facilities.
const {views,rejected={}}=JSON.parse(fs.readFileSync('app/facade-view-corrections.json','utf8'));
const catalog=JSON.parse(fs.readFileSync('public/data/experience/catalog.json','utf8'));
const byImage=new Map(catalog.facilities.map(f=>[f.source_id,f]));
for(const [imageId,v] of Object.entries(views)){
  const f=byImage.get(imageId);assert(f,imageId+' is not a registered facility image');
  assert(!rejected[imageId],imageId+' is both corrected and rejected');
  const photo=Number.isFinite(f.reference?.focus?.cameraHeading);
  if(photo){assert(Number.isFinite(v.headingOffset)&&Math.abs(v.headingOffset)<=60&&v.heading===undefined,imageId+' photo facade keeps a heading offset from its front');}
  else assert(Number.isFinite(v.heading)&&v.heading>=0&&v.heading<360&&v.headingOffset===undefined,imageId+' point facility uses an absolute heading');
  assert(Number.isFinite(v.pitch)&&v.pitch<=0&&v.pitch>=-60,imageId+' pitch');
  assert(Number.isFinite(v.range)&&v.range>=3&&v.range<=40,imageId+' range');
  assert(v.visibleAfter>=v.visibleBefore&&v.nearAfter<=v.nearBefore,imageId+' correction must not make the view worse');
}
for(const imageId of Object.keys(rejected))assert(byImage.has(imageId),imageId+' rejected but not registered');
console.log('PASS: '+Object.keys(views).length+' facade view corrections are bounded, registered and improving; '+Object.keys(rejected).length+' reviewed rejections kept out');

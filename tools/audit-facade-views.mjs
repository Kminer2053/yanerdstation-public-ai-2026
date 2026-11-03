// Facade ("시설 정면 보기") visibility audit on the local Seoul scene.
// For every catalog facility it flies to the facade view exactly like the service, projects a grid of points on the
// target and reads the depth buffer: a point is hidden when the first surface on that pixel is clearly in front of it;
// structures within 1.5 m of the camera count against the view too. Weak views are re-shot from other angles, zoom
// depths and heights to get around the obstacle, preferring cameras that stand on the walking grid.
// - Photo facades (focus.cameraHeading known): same facade, angles within ±40° of its front, 0.45-1.4x distance.
// - Other facilities (escalators, lifts, ticket machines): no front is known and the point sits inside the object, so
//   reaching the object's own surface (within 2.5 m) counts as seen; any side, 8-30 m, heading stored as absolute.
// Usage: node tools/audit-facade-views.mjs [--base http://127.0.0.1:4175] [--out <dir>] [--apply] [--only <imageId,...>]
//        node tools/audit-facade-views.mjs --apply-from <out>/results.json   (write app/facade-view-corrections.json only)
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import {buildWalkIndex,toLocal,cellAt,snapWalkable} from '../src/crowd-core.js';

const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i>0?process.argv[i+1]:fallback;};
const base=arg('--base','http://127.0.0.1:4175'),out=path.resolve(arg('--out','outputs/facade-audit')),apply=process.argv.includes('--apply');
const only=arg('--only','')?.split(',').filter(Boolean);
const CORRECTIONS='app/facade-view-corrections.json';
const round=(v,d=2)=>+v.toFixed(d);
function writeCorrections(results){
  // An audited "before" view already includes an earlier correction: relative heading offsets add up; the rest is absolute.
  // Views a person rejected after looking at the before/after shots stay rejected on later runs.
  const file=fs.existsSync(CORRECTIONS)?JSON.parse(fs.readFileSync(CORRECTIONS,'utf8')):{},existing=file.views||{},rejected=file.rejected||{},views={...existing};
  for(const r of results){
    if(!r.correction||rejected[r.imageId])continue;const old=existing[r.imageId],c={...r.correction};
    if(Number.isFinite(c.headingOffset))c.headingOffset+=old?.headingOffset||0;
    views[r.imageId]={...c,name:r.name,visibleBefore:round(r.before.visibleRatio),nearBefore:round(r.before.nearRatio),visibleAfter:round(r.after.visibleRatio),nearAfter:round(r.after.nearRatio)};
  }
  fs.writeFileSync(CORRECTIONS,JSON.stringify({note:'시설 정면 보기 카메라 보정값(가림 전수조사 결과). heading(절대)·headingOffset(사진 면 법선 기준)·pitch는 도, range는 m. 원본 등록부는 수정하지 않음.',generated:new Date().toISOString().slice(0,10),views,rejected},null,1)+'\n');
}
const applyFrom=arg('--apply-from','');
if(applyFrom){writeCorrections(JSON.parse(fs.readFileSync(applyFrom,'utf8')).results);console.log('wrote',CORRECTIONS);process.exit(0);}
fs.mkdirSync(path.join(out,'shots'),{recursive:true});
const graph=JSON.parse(fs.readFileSync('public/data/experience/walk-graph.json','utf8')),ix=buildWalkIndex(graph);

const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal','--ignore-gpu-blocklist','--enable-gpu']});
const page=await browser.newPage({viewport:{width:1100,height:700},deviceScaleFactor:1});
await page.goto(base+'/app/?site=S202103&embed=catalog&floor=2F&experience=1&scene=local',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.__STATION_ONE_VWORLD__?.ready&&window.__STATION_ONE_FOCUS_AUDIT__&&window.Cesium,null,{timeout:120000});

if(process.argv.includes('--debug'))await page.evaluate(()=>{window.__auditDebug=true;});
await page.evaluate(()=>{
  const C=window.Cesium,V=()=>window.__STATION_ONE_VWORLD__,A=()=>window.__STATION_ONE_FOCUS_AUDIT__,deg=Math.PI/180;
  const frame=()=>new Promise(r=>{const s=V().viewer.scene,rm=s.postRender.addEventListener(()=>{rm();r();});s.requestRender();});
  async function settle(maxMs=9000){
    const cam=V().viewer.camera,t0=performance.now();let last=null,stable=0;
    while(performance.now()-t0<maxMs){
      await new Promise(r=>setTimeout(r,120));await frame();
      const p=C.Cartesian3.clone(cam.positionWC),moved=last?C.Cartesian3.distance(p,last):1e9;last=p;
      if(moved<.005&&V().tileset?.tilesLoaded!==false){if(++stable>=3)return true;}else stable=0;
    }
    return false;
  }
  // The area that must be visible: the photo surface, or a 2 m wide column from the floor up at the facility point.
  function facade(){
    const F=A().focus(),center=A().center(),cam=V().viewer.camera,m=C.Transforms.eastNorthUpToFixedFrame(center);
    // The app stores a missing facade normal as null, and Number(null) is 0: test the type, not the coercion.
    const E=[m[0],m[1],m[2]],N=[m[4],m[5],m[6]],U=[m[8],m[9],m[10]],photo=typeof F.cameraHeading==='number'&&Number.isFinite(F.cameraHeading);
    let nh=photo?F.cameraHeading*deg:NaN;
    if(!Number.isFinite(nh)){const d=C.Cartesian3.subtract(cam.positionWC,center,new C.Cartesian3());nh=Math.atan2(d.x*E[0]+d.y*E[1]+d.z*E[2],d.x*N[0]+d.y*N[1]+d.z*N[2]);}
    const T=[0,1,2].map(k=>E[k]*Math.cos(nh)-N[k]*Math.sin(nh)),ch=C.Cartographic.fromCartesian(center).height,floor=window.__auditFloor;
    if(!photo)return {center,T,U,w:2,z0:floor+.3-ch,z1:floor+2.5-ch,object:true};
    let w=Number(F.surfaceWidth),h=Number(F.surfaceHeight);
    if(!(w>0&&h>0)){const a=Number(F.surfaceArea),cw=Number(F.cropWidth),chh=Number(F.cropHeight);if(a>0&&cw>0&&chh>0){const k=Math.max(.15,Math.min(8,cw/chh));w=Math.sqrt(a*k);h=Math.sqrt(a/k);}else{w=3;h=2.4;}}
    const top=ch+Math.min(h,5)/2,bottom=Math.max(floor+.2,ch-Math.min(h,5)/2);
    return {center,T,U,w:Math.min(w,12),z0:bottom-ch,z1:Math.max(bottom+.5,top)-ch};
  }
  // Grid over the target (11x6, light 7x4) plus a screen grid (10x7, light 6x4) for structures touching the camera.
  async function probe(light=false){
    const [fx,fy,gx,gy]=light?[7,4,6,4]:[11,6,10,7];
    const v=V(),scene=v.viewer.scene,cam=v.viewer.camera,f=facade(),marker=v.catalogFocus;const wasShown=marker?.show;if(marker)marker.show=false;
    await frame();
    const cw=scene.canvas.clientWidth,chh=scene.canvas.clientHeight,res={total:0,visible:0,occluded:0,out:0,empty:0,near:0,occluders:{}};
    for(let i=0;i<fx;i++)for(let j=0;j<fy;j++){
      const u=-.46+.92*i/(fx-1),z=f.z0+(f.z1-f.z0)*(.06+.88*j/(fy-1));res.total++;
      const P=new C.Cartesian3(f.center.x+f.T[0]*u*f.w+f.U[0]*z,f.center.y+f.T[1]*u*f.w+f.U[1]*z,f.center.z+f.T[2]*u*f.w+f.U[2]*z);
      const w=C.SceneTransforms.worldToWindowCoordinates(scene,P);
      if(!w||w.x<cw*.02||w.x>cw*.98||w.y<chh*.02||w.y>chh*.98){res.out++;continue;}
      const hit=scene.pickPosition(w);
      if(window.__auditDebug&&!light)(res.samples??=[]).push({u:+u.toFixed(2),z:+z.toFixed(2),px:[Math.round(w.x),Math.round(w.y)],dP:+C.Cartesian3.distance(cam.positionWC,P).toFixed(2),dH:hit?+C.Cartesian3.distance(cam.positionWC,hit).toFixed(2):null,hitH:hit?+C.Cartographic.fromCartesian(hit).height.toFixed(2):null});
      if(!hit){res.empty++;res.visible++;continue;}
      // An escalator, lift or machine is a solid (often long) thing around its point: a first surface in the last 28% of
      // the way is the facility or its surroundings; only something standing well in between hides it.
      const dP=C.Cartesian3.distance(cam.positionWC,P),dH=C.Cartesian3.distance(cam.positionWC,hit);
      if(f.object?dH<dP*.72:dH<dP-.35){
        res.occluded++;const picked=light?null:scene.pick(w);
        const key=picked?.getProperty?.('TD_ID')||picked?.getProperty?.('NAME')||picked?.id?.id||picked?.primitive?.constructor?.name||'unknown';
        res.occluders[key]=(res.occluders[key]||0)+1;
      }else res.visible++;
    }
    for(let i=0;i<gx;i++)for(let j=0;j<gy;j++){const hit=scene.pickPosition(new C.Cartesian2(cw*(i+.5)/gx,chh*(j+.5)/gy));if(hit&&C.Cartesian3.distance(hit,cam.positionWC)<1.5)res.near++;}
    if(marker)marker.show=wasShown;await frame();
    const c=C.Cartographic.fromCartesian(cam.positionWC),visible=res.visible/res.total,nearRatio=res.near/(gx*gy);
    return {...res,visibleRatio:visible,nearRatio,score:visible-nearRatio,camera:[C.Math.toDegrees(c.longitude),C.Math.toDegrees(c.latitude),c.height]};
  }
  window.__audit={
    async focus(focus,floorLevel){
      window.__auditFloor=floorLevel;const v=V();v.catalogFocusApplied=false;
      window.postMessage({type:'station-one:catalog-focus',requestId:Date.now(),focus},location.origin);
      const t0=performance.now();while(!v.catalogFocusApplied&&performance.now()-t0<8000)await new Promise(r=>setTimeout(r,80));
      await new Promise(r=>setTimeout(r,950));const settled=await settle(),o=A().offset();
      return {mode:document.getElementById('app')?.dataset.catalogFocusMode||'',settled,base:o?{heading:o.heading,pitch:o.pitch,range:o.range}:null,probe:await probe()};
    },
    async tryView(headingRad,pitchDeg,range,light=false){
      const cam=V().viewer.camera,center=A().center();
      cam.lookAt(center,new C.HeadingPitchRange(headingRad,pitchDeg*deg,range));cam.lookAtTransform(C.Matrix4.IDENTITY);
      await frame();const t0=performance.now();while(V().tileset?.tilesLoaded===false&&performance.now()-t0<1500)await new Promise(r=>setTimeout(r,60));await frame();
      return probe(light);
    },
  };
});

// A camera standing where a person could stand on that floor (not inside a shop, a wall or over a void) is preferred.
function standable(floor,lonlat,level){const [x,y]=toLocal(ix,lonlat[0],lonlat[1]);return cellAt(ix,floor,x,y,level,1.5)>=0;}
const catalog=await (await fetch(base+'/api/catalog')).json();
const facilities=catalog.facilities.filter(f=>f.reference&&(!only?.length||only.includes(f.source_id)||only.includes(f.id)));
const results=[];
for(const [n,f] of facilities.entries()){
  const p=f.reference,focus={floor:f.floor,longitude:p.lon,latitude:p.lat,height:p.height,label:f.name,imageId:f.source_id,...p.focus,sourceKind:p.focus?.sourceKind||'catalog'};
  const photo=Number.isFinite(Number(p.focus?.cameraHeading));
  const [fx,fy]=toLocal(ix,p.lon,p.lat),floorCell=snapWalkable(ix,f.floor,fx,fy,photo?p.height-1.8:p.height-1.58,10),level=floorCell>=0?graph.points[floorCell][4]:p.height-2;
  const before=await page.evaluate(([focus,level])=>window.__audit.focus(focus,level),[focus,level]);
  const shot=path.join('shots',f.source_id+'-before.jpg');await page.screenshot({path:path.join(out,shot),type:'jpeg',quality:70});
  const row={id:f.id,imageId:f.source_id,name:f.name,floor:f.floor,photo,mode:before.mode,settled:before.settled,base:before.base,before:before.probe,beforeShot:shot,standable:standable(f.floor,before.probe.camera,level)};
  row.weak=photo?row.before.visibleRatio<.85||row.before.nearRatio>.02:row.before.visibleRatio<.6||row.before.nearRatio>.05;
  if(before.mode==='surface'&&before.base&&row.weak){
    const basePitch=before.base.pitch*180/Math.PI,baseRange=before.base.range,plan=[];
    // Photo facades keep their front (±40°) and are zoomed 0.45-1.4x; objects without a front may be seen from any side.
    if(photo)for(const dh of [0,-10,10,-20,20,-30,30,-40,40])for(const rf of [1,.8,.6,.45,1.2,1.4])for(const pd of [-3,-12,-22]){
      if(dh||rf!==1||Math.abs(pd-basePitch)>=.5)plan.push({dh,pitch:pd,range:round(Math.max(3,baseRange*rf)),cost:Math.abs(dh)/10+Math.abs(rf-1)*2+Math.abs(pd-basePitch)/12});
    }else for(const dh of [0,45,-45,90,-90,135,-135,180])for(const range of [baseRange,18,12,8])for(const pd of [-22,-35,-50]){
      if(dh||range!==baseRange||Math.abs(pd-basePitch)>=.5)plan.push({dh,pitch:pd,range:round(range),cost:Math.abs(dh)/60+Math.abs(Math.log(range/14))*.6+Math.abs(pd+30)/30});
    }
    // Least intrusive first; stop at the first nearly perfect view (then also the least intrusive one).
    const tried=[];
    for(const c of plan.sort((a,b)=>a.cost-b.cost)){
      const heading=before.base.heading+c.dh*Math.PI/180,r=await page.evaluate(([h,pd,range])=>window.__audit.tryView(h,pd,range,true),[heading,c.pitch,c.range]);
      const t={...c,heading,score:r.score,visibleRatio:r.visibleRatio,nearRatio:r.nearRatio,occluded:r.occluded,out:r.out,standable:standable(f.floor,r.camera,level)};
      tried.push(t);if(t.visibleRatio>=.97&&t.nearRatio<=.01&&t.standable)break;
    }
    const rank=t=>t.score+(t.standable?.04:0),top=Math.max(0,...tried.map(rank));
    const best=tried.filter(t=>rank(t)>=top-.03).sort((a,b)=>a.cost-b.cost)[0];
    row.search={tried:tried.length,bestScore:round(top),top:[...tried].sort((a,b)=>rank(b)-rank(a)).slice(0,5)};
    // Decide on the full-resolution re-measure of the chosen view, not on the quick search probe.
    const after=best&&await page.evaluate(([h,pd,range])=>window.__audit.tryView(h,pd,range),[best.heading,best.pitch,best.range]);
    if(after&&after.score>=row.before.score+.04&&after.visibleRatio>=row.before.visibleRatio-.02){
      row.correction=photo?{headingOffset:best.dh,pitch:best.pitch,range:best.range}:{heading:round((((best.heading*180/Math.PI)%360)+360)%360,1),pitch:best.pitch,range:best.range};
      row.after=after;row.afterShot=path.join('shots',f.source_id+'-after.jpg');await page.screenshot({path:path.join(out,row.afterShot),type:'jpeg',quality:70});
    }
  }
  results.push(row);
  console.log(String(n+1).padStart(3),f.source_id.padEnd(26),f.floor.padEnd(3),before.mode.padEnd(18),photo?'photo':'point','visible',row.before.visibleRatio.toFixed(2),'near',row.before.nearRatio.toFixed(2),row.weak?'WEAK':'ok  ',row.correction?'→ visible '+row.after.visibleRatio.toFixed(2)+' near '+row.after.nearRatio.toFixed(2)+' '+JSON.stringify(row.correction):'',f.name);
}
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({generated:new Date().toISOString(),base,thresholds:{photoFacade:'visible<0.85 or near>0.02',otherFacility:'visible<0.6 or near>0.05 (target zone)'},results},null,1));
if(apply)writeCorrections(results);
const weak=results.filter(r=>r.weak),fixed=results.filter(r=>r.correction);
console.log('\nfacilities',results.length,'| weak views',weak.length,'(photo facades',weak.filter(r=>r.photo).length+')','| corrected',fixed.length,'| weak without a better view:',weak.filter(r=>!r.correction).map(r=>r.name).join(', ')||'none');
await browser.close();

import { chromium } from "playwright";
const browser=await chromium.launch({headless:true,channel:"chrome",args:["--enable-webgl","--ignore-gpu-blocklist"]});
try{
  const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto(process.argv[2]||"http://127.0.0.1:4174/app/?site=S202103&asset=information-zone",{waitUntil:"domcontentloaded",timeout:60000});
  await page.waitForFunction(()=>window.__STATION_ONE_VWORLD__?.ready&&window.__STATION_ONE_VWORLD__?.informationZone,{timeout:60000});
  await page.evaluate(()=>window.__STATION_ONE_VWORLD__.informationZone.focus(0));
  await page.waitForFunction(()=>window.__STATION_ONE_VWORLD__.tileset.tilesLoaded,{timeout:60000});
  await page.screenshot({path:"/tmp/station-s04-information-zone-after.png"});
  console.log(JSON.stringify(await page.evaluate(()=>{
    const v=window.__STATION_ONE_VWORLD__,C=window.Cesium,now=C.JulianDate.now();
    const frame=C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(126.97082,37.55363,27.2));
    const inverse=C.Matrix4.inverseTransformation(frame,new C.Matrix4());
    return {ready:v.ready,tilesLoaded:v.tileset.tilesLoaded,facilities:v.informationZone.source.entities.values.filter(e=>e.wall).map(e=>({id:e.id,positions:e.wall.positions.getValue(now).map(p=>{const q=C.Matrix4.multiplyByPoint(inverse,p,new C.Cartesian3());return [q.x,q.y,q.z];})})),entityCount:v.informationZone.source.entities.values.length};
  }),null,2));
  console.log(JSON.stringify({pageErrors:errors}));
  if(errors.length) process.exitCode=1;
}finally{await browser.close();}

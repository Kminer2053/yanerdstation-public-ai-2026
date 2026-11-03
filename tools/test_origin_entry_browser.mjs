import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4196';
const out=process.argv[3]||'/private/tmp/station-origin-qa';
const bridgeFixture=process.argv.includes('--bridge-fixture');
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const errors=[];
async function configure(page){
  page.on('pageerror',e=>errors.push(e.message));
  if(!bridgeFixture)return;
  // A named contract fixture, never a substitute for visual verification of live VWorld geometry.
  await page.route('**/app/?**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="ko"><meta charset="utf-8"><body style="background:#071820;color:#bfe5e4;font:16px sans-serif;padding:24px"><h2>지도 메시지 계약 테스트</h2><p>테스트용 연결부입니다. 실제 3D 지도 화면이 아닙니다.</p><script>
    window.messages=[];
    addEventListener('message',e=>{if(e.origin!==location.origin)return;messages.push(e.data);if(e.data.type==='station-one:point-review-layer')parent.postMessage({type:'station-one:point-review-layer-applied',ok:true,floor:e.data.floor,count:e.data.features.length},location.origin)});
    parent.postMessage({type:'station-one:catalog-map-ready',vworldReady:true},location.origin);
  </script></body></html>`}));
}
try{
  const page=await browser.newPage({viewport:{width:1500,height:1050}});
  await configure(page);
  await page.goto(base+'/routes/?view=points&origins=1',{waitUntil:'domcontentloaded'});
  await page.locator('.origin-card').last().waitFor({timeout:30000});
  assert.equal(await page.locator('.origin-card').count(),48);
  await page.locator('#pointView').click();
  assert.equal(await page.locator('#count-od').textContent(),'11');
  await page.locator('#originView').click();
  await page.locator('[data-select="ENTRY-M-G-075872"]').click();
  assert.equal(await page.locator('#pointFloor').inputValue(),'B1');
  assert.match(await page.locator('#selection').innerText(),/ENTRY-M-G-075872/);
  await page.locator('[data-select="ENTRY-O-3390512293"]').first().click();
  assert.equal(await page.locator('#pointFloor').inputValue(),'2F','Unknown-floor references must synchronize the display floor with the reference camera');
  if(bridgeFixture){
    const map=page.frames().find(f=>f.url().includes('/app/'));
    await map.waitForFunction(()=>window.messages.some(m=>m.focus?.imageId==='ENTRY-O-3390512293'));
    const messages=await map.evaluate(()=>window.messages);
    const focusIndex=messages.findLastIndex(m=>m.focus?.imageId==='ENTRY-O-3390512293');
    assert.equal(messages[focusIndex].focus.referenceOnly,true);
    assert.equal(messages.slice(focusIndex+1).find(m=>m.type==='station-one:point-review-layer').floor,'2F');
  }
  await page.locator('[data-select="ENTRY-M-G-075872"]').click();
  await page.waitForFunction(()=>document.querySelector('#mapStatus').textContent.includes('후보 표시'),null,{timeout:60000});
  const mapStatus=await page.locator('#mapStatus').innerText();
  await page.screenshot({path:out+'/desktop-B1.png'});
  await page.locator('#pointSearch').fill('GTX');
  assert.equal(await page.locator('.origin-card').count(),1);
  assert.match(await page.locator('.origin-card').innerText(),/접속부 위치 확인 필요/);
  assert.equal(await page.locator('.origin-entries [data-select]').count(),0);
  await page.locator('#pointSearch').fill('없는원점');
  assert.equal(await page.locator('.origin-card').count(),0);
  await page.locator('#pointSearch').fill('서울스퀘어');
  assert.equal(await page.locator('.origin-card').count(),2);
  await page.locator('#pointSearch').fill('공항철도 서울역');
  await page.locator('[data-select="ENTRY-A-G-076224"]').click();
  assert.equal(await page.locator('#pointFloor').inputValue(),'B3');
  await page.locator('#pointSearch').fill('');
  await page.locator('[data-select="ENTRY-G1"]').first().click();
  assert.equal(await page.locator('#pointFloor').inputValue(),'2F');
  await page.locator('#pointSearch').fill('02003');
  await page.screenshot({path:out+'/desktop-east.png'});
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#exportReview').click()]);
  await download.saveAs(out+'/review-export.json');
  const saved=JSON.parse(fs.readFileSync(out+'/review-export.json'));
  assert.equal(saved.origin_entry_review.origins.length,48);
  assert.equal(saved.routing_enabled,false);
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await configure(mobile);
  await mobile.goto(base+'/routes/?view=points&origins=1',{waitUntil:'domcontentloaded'});
  await mobile.locator('.origin-card').last().waitFor({timeout:30000});
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await mobile.screenshot({path:out+'/mobile-top.png'});
  await mobile.locator('#pointSearch').fill('GTX');
  await mobile.locator('.origin-card').scrollIntoViewIfNeeded();
  await mobile.screenshot({path:out+'/mobile-GTX.png'});
  assert.equal(await mobile.locator('.origin-card').count(),1);
  assert.deepEqual(errors,[],'No uncaught browser errors');
  const result={status:'PASS',testScope:bridgeFixture?'UI and iframe message contract only; live 3D not verified':'UI with live 3D connection',originCount:48,green2F:11,floorClicks:['B1','B3','2F'],mapStatus,errors,screenshots:out};
  fs.writeFileSync(out+'/result.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
}finally{await browser.close();}

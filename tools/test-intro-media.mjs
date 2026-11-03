import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';

// Project intro (index.html): every demo video the page asks for exists in both cuts with a poster, starts playing
// before it has fully downloaded (moov before mdat), and the worker serves it in byte ranges (Safari/iOS need 206).
const html=fs.readFileSync('index.html','utf8'),script=fs.readFileSync('src/presentation.js','utf8');
// Reuse the complete manager diagram, with a reproducible, explicitly dated snapshot and zoom fallback.
const evidence=html.match(/<section class="slide" id="evidence">([\s\S]*?)<\/section>/)?.[1];
assert(evidence,'data evidence slide exists');
assert(evidence.includes('aria-labelledby="pipelineTitle" aria-describedby="pipelineNote"'),'diagram has a text title and description');
assert(evidence.includes('href="/media/intro/data-pipeline.svg"'),'full diagram opens without JavaScript');
assert(html.includes('id="pipelineDialog"')&&html.includes('id="pipelineZoom"'),'diagram supports a labelled zoom viewer');
for(const label of ['관측','가공','추정','확정','모형','산출','2026.07.18 12:00','실시간 현황 아님','고유 방문자 수가 아닙니다','시뮬레이션'])assert(evidence.includes(label),'diagram context retains '+label);
assert(!evidence.includes('data-flow-step'),'simplified diagram removed');
const diagram=fs.readFileSync('public/media/intro/data-pipeline.svg','utf8');
assert.equal((diagram.match(/class="dg-node"/g)||[]).length,21,'all original nodes retained');
assert.equal((diagram.match(/class="dg-edge"/g)||[]).length,24,'all original connectors retained');
for(const label of ['① 원천 자료','② 지점·자료 집계','③ 이동 배분 모형','④ 파생 지표','⑤ 서비스 산출'])assert(diagram.includes(label),'original column '+label);
assert(!/<script\b|<image\b|<foreignObject\b/.test(diagram),'self-contained vector asset, no active or embedded image content');
execFileSync(process.execPath,['tools/build-intro-diagram.mjs','--check'],{stdio:'pipe'});
console.log('PASS: original evidence diagram — 5 columns, 21 nodes, 24 links, reproducible snapshot and zoom viewer');
const keys=new Set([...html.matchAll(/data-demo="([a-z]+)"/g)].map(m=>m[1]));
for(const m of script.matchAll(/^\s*([a-z]+):'[^']+',?$/gm))keys.add(m[1]);
assert.deepEqual([...keys].sort(),['business','editor','hero','layers','manager','promo','visitor'],'demo keys in the page');
assert(/data-demo="promo" data-promo muted loop playsinline controls preload="none"/.test(html),'promo has muted inline playback and native controls');
assert(script.includes('bindScrollVideo(')&&script.includes('video[data-demo]:not([data-promo])'),'promo scroll lifecycle is separate from click-to-zoom demos');
const box=(buf,type)=>{for(let i=0;i+8<=buf.length;){const size=buf.readUInt32BE(i),t=buf.toString('latin1',i+4,i+8);if(t===type)return i;if(size<8)return -1;i+=size;}return -1;};
let bytes=0;
for(const k of keys){
  for(const cut of ['1280','720']){
    const f='public/media/intro/'+k+'-'+cut+'.mp4',buf=fs.readFileSync(f);bytes+=buf.length;
    assert.equal(buf.toString('latin1',4,8),'ftyp',f+' is MP4');
    const moov=box(buf,'moov'),mdat=box(buf,'mdat');assert(moov>0&&mdat>0&&moov<mdat,f+' has moov before mdat (faststart)');
    assert(buf.length<(k==='promo'?20e6:8e6),f+' stays within web media budget');
  }
  assert(fs.statSync('public/media/intro/'+k+'.jpg').size>10000,k+' poster');
  assert(html.includes('/media/intro/'+k+'.jpg')||script.includes("'/media/intro/'+key+'.jpg'"),k+' poster referenced');
}
assert(bytes<60e6,'all intro videos together stay under 60 MB ('+(bytes/1e6).toFixed(1)+' MB)');

// Worker: ranges from the bundled file, whole file without a Range header, 416 outside, only intro MP4 names.
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'station-intro-test-'));
await build({entryPoints:['server/index.js'],outfile:path.join(tmp,'worker.mjs'),platform:'node',format:'esm',bundle:true,logLevel:'silent'});
const worker=(await import(pathToFileURL(path.join(tmp,'worker.mjs')))).default;
const env={ASSETS:{async fetch(r){const f=path.resolve('public','.'+new URL(r.url).pathname);return fs.existsSync(f)&&fs.statSync(f).isFile()?new Response(fs.readFileSync(f)):new Response('not found',{status:404})}}};
const file=fs.readFileSync('public/media/intro/hero-720.mp4'),size=file.length;
const get=(p,headers={},method='GET')=>worker.fetch(new Request('https://yanerdstation.test'+p,{headers,method}),env);
const whole=await get('/api/media/intro/hero-720.mp4?v=1');
assert.equal(whole.status,200);assert.equal(whole.headers.get('Content-Type'),'video/mp4');assert.equal(whole.headers.get('Accept-Ranges'),'bytes');assert.equal((await whole.arrayBuffer()).byteLength,size);
const first=await get('/api/media/intro/hero-720.mp4',{Range:'bytes=0-1'});
const promo=await get('/api/media/intro/promo-720.mp4',{Range:'bytes=0-1'});
assert.equal(promo.status,206);assert.equal(promo.headers.get('Content-Type'),'video/mp4');
assert.equal((await promo.arrayBuffer()).byteLength,2,'promo supports Safari byte-range loading');
assert.equal(first.status,206);assert.equal(first.headers.get('Content-Range'),'bytes 0-1/'+size);assert.deepEqual(new Uint8Array(await first.arrayBuffer()),new Uint8Array(file.subarray(0,2)));
const open=await get('/api/media/intro/hero-720.mp4',{Range:'bytes=1000-'});
assert.equal(open.status,206);assert.equal(open.headers.get('Content-Length'),String(size-1000));assert.equal((await open.arrayBuffer()).byteLength,size-1000);
const tail=await get('/api/media/intro/hero-720.mp4',{Range:'bytes=-500'});
assert.equal(tail.status,206);assert.equal(tail.headers.get('Content-Range'),'bytes '+(size-500)+'-'+(size-1)+'/'+size);
const capped=await get('/api/media/intro/hero-720.mp4',{Range:'bytes=10-'+(size+5000)});assert.equal(capped.headers.get('Content-Range'),'bytes 10-'+(size-1)+'/'+size);
assert.equal((await get('/api/media/intro/hero-720.mp4',{Range:'bytes='+(size+1)+'-'})).status,416);
assert.equal((await get('/api/media/intro/hero-720.mp4',{Range:'bytes=-'})).status,416);
const head=await get('/api/media/intro/hero-720.mp4',{},'HEAD');assert.equal(head.status,200);assert.equal(head.headers.get('Content-Length'),String(size));
assert.equal((await get('/api/media/intro/missing-720.mp4')).status,404);
assert.equal((await get('/api/media/intro/hero-720.mp4',{},'POST')).status,405);
for(const bad of ['/api/media/intro/../data/experience/catalog.json','/api/media/data/x.mp4','/api/media/intro/HERO.mp4'])assert.notEqual((await get(bad)).headers.get('Content-Type'),'video/mp4',bad+' is not served as intro media');
console.log('PASS: intro page — '+keys.size+' demo videos in 1280/720 cuts with posters ('+(bytes/1e6).toFixed(1)+' MB, faststart), worker byte ranges (200/206/416/HEAD/404/405) for Safari/iOS');

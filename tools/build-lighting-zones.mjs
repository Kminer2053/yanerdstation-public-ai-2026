// Derive a small lighting overlay, not a replacement map or walkability dataset.
// Usage: node tools/build-lighting-zones.mjs /path/to/DigitalTwin_Station
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const root=path.resolve(process.argv[2]||'..');
const require=createRequire(path.join(root,'package.json'));
const draco=await require('./tmp/vworld-seoul-full-catalog/vendor/node_modules/draco3dgltf/draco3dgltf.js').createDecoderModule({});
const code=fs.readFileSync(path.join(root,'tools/build_vworld_image_catalog.mjs'),'utf8');
const origin={lon:126.97082,lat:37.55363,height:27.2};
const api=new Function('fs','crypto','draco','SITE_ORIGIN','imageId','featureKey',code.slice(code.indexOf('const sha256 ='),code.indexOf('async function imagePreview'))+';return {parseB3dm,meshTransforms,identityMatrix,decodeDracoPrimitive,readAccessor,transformPoint,ecefToEnu};')(fs,crypto,draco,origin,()=>'',()=> '');
const slabs=[],floors=[],directory=path.join(root,'tmp/vworld-seoul-full-catalog/tiles');
for(const filename of fs.readdirSync(directory).filter(f=>/^B_1_.*\.bin$/.test(f)).sort()){
 const p=api.parseB3dm(path.join(directory,filename));
 if(!p.batchTable.MODEL_NAME?.some(n=>/^F0[23]FL/.test(n)))continue;
 const transforms=api.meshTransforms(p.gltf),rtc=p.featureTable.RTC_CENTER;
 for(const [mi,mesh] of p.gltf.meshes.entries())for(const primitive of mesh.primitives){
  const d=api.decodeDracoPrimitive(p.gltf,p.binary,primitive),positions=d?.positions??api.readAccessor(p.gltf,p.binary,primitive.attributes.POSITION),batches=d?.batchIds??api.readAccessor(p.gltf,p.binary,primitive.attributes._BATCHID),indices=d?.indices??api.readAccessor(p.gltf,p.binary,primitive.indices)?.flat();
  if(!positions||!indices)continue;
  for(const m of transforms.get(mi)??[api.identityMatrix()]){
   const enu=positions.map(v=>{const q=api.ecefToEnu(api.transformPoint(m,v).map((a,i)=>a+rtc[i]));return [q.east,q.north,q.up];});
   for(let i=0;i<indices.length;i+=3){
    const ix=indices.slice(i,i+3),id=Math.round(batches?.[ix[0]]?.[0]??mi),model=p.batchTable.MODEL_NAME[id];
    if(!/^F0[23]FL/.test(model))continue;
    const vs=ix.map(j=>enu[j]),[a,b,c]=vs,u=b.map((v,k)=>v-a[k]),v=c.map((x,k)=>x-a[k]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    if(n[2]/Math.hypot(...n)<.98)continue;
    if(model.startsWith('F03')&&vs.every(v=>v[2]>14.8&&v[2]<15.4))slabs.push(vs);
    if(model.startsWith('F02')&&vs.every(v=>v[2]>8.7&&v[2]<9.3))floors.push(vs);
   }
  }
 }
}
const round=rows=>rows.map(t=>t.map(v=>v.map(n=>+n.toFixed(3))));
if(slabs.length<20||floors.length<100)throw Error('Incomplete station geometry');
const all=floors.flat(),bounds=[Math.floor(Math.min(...all.map(v=>v[0])))-1,Math.floor(Math.min(...all.map(v=>v[1])))-1,Math.ceil(Math.max(...all.map(v=>v[0])))+1,Math.ceil(Math.max(...all.map(v=>v[1])))+1];
const result={version:1,origin:[origin.lon,origin.lat,origin.height],bounds,ceilingDrop:1.4,panelSpacing:3.6,panelSize:.66,slabs:round(slabs),floors:round(floors),basis:'3F F03FL001 상향 바닥 투영 + 2F 바닥. 개구부 보존. 사진을 참고한 LED·천장 마감의 간격과 높이는 시각화 추정이며 실측 조도·시공도면 아님.'};
fs.writeFileSync(new URL('../app/seoul-lighting-zones.json',import.meta.url),JSON.stringify(result)+'\n');
console.log(JSON.stringify({slabs:slabs.length,floors:floors.length,bounds,ceilingUp:slabs[0][0][2]-result.ceilingDrop}));

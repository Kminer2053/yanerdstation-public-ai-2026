import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {retiredWhole,retiredTriangle,visibleFragments,clipPolygon} from './point-retirement.mjs';
import {photoboothPoint,PHOTOBOOTH} from '../app/seoul-photobooth.js';
import {OPENING_GUARDRAIL} from '../app/seoul-opening-guardrail.js';
import {informationZoneCatalogPoint} from '../app/seoul-information-zone.js';

// Reuse the exact, provenance-checked mesh extraction used to create these
// candidate points. Execute only its read-only extraction section, never the
// grid-generation/file-writing section. No source tiles or assets are modified.
export async function loadWalkability(workspace,grid){
  const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
  for(const source of grid.customSources)if(hash(fs.readFileSync(new URL('../'+source.file,import.meta.url)))!==source.sha256)throw Error(`격자 생성 이후 구조물 변경: ${source.file}`);
  const require=createRequire(path.join(workspace,'package.json'));
  const draco=await require('./tmp/vworld-seoul-full-catalog/vendor/node_modules/draco3dgltf/draco3dgltf.js').createDecoderModule({});
  const code=fs.readFileSync(path.join(workspace,'tools/build_vworld_image_catalog.mjs'),'utf8');
  const api=new Function('fs','crypto','draco','SITE_ORIGIN','imageId','featureKey',code.slice(code.indexOf('const sha256 ='),code.indexOf('async function imagePreview'))+';return {parseB3dm,meshTransforms,identityMatrix,decodeDracoPrimitive,readAccessor,transformPoint,ecefToEnu};')(fs,crypto,draco,grid.origin,()=>'',()=> '');
  const generator=fs.readFileSync(new URL('./build_all_point_grid.mjs',import.meta.url),'utf8');
  const start=generator.indexOf('const spacing=2,'),end=generator.indexOf('const anchor=api.geodeticToEcef');
  if(start<0||end<start)throw Error('격자 추출 코드 경계를 확인하세요.');
  const extract=new Function('fs','path','crypto','root','api','retiredWhole','retiredTriangle','visibleFragments','photoboothPoint','PHOTOBOOTH','OPENING_GUARDRAIL','informationZoneCatalogPoint',generator.slice(start,end)+';return {byFloor,treads,index,support,near,inside,custom,sourceFiles};');
  const mesh=extract(fs,path,crypto,workspace,api,retiredWhole,retiredTriangle,visibleFragments,photoboothPoint,PHOTOBOOTH,OPENING_GUARDRAIL,informationZoneCatalogPoint);
  if(JSON.stringify(mesh.sourceFiles)!==JSON.stringify(grid.sourceFiles))throw Error('격자와 원본 모델 스냅샷 버전이 다릅니다.');
  const floorIndices=new Map(Object.entries(mesh.byFloor).map(([floor,d])=>[floor,mesh.index(d.surfaces)]));
  const treadIndices=new Map([...mesh.treads].map(([id,t])=>[id,mesh.index(t.rows)]));
  const obstacles=mesh.index(Object.values(mesh.byFloor).flatMap(d=>d.obstacles),grid.clearance_m);
  let checked=0,rejected=0;
  // First failing check of a walking segment (floor support, body clearance, custom footprint, obstacle in the
  // body band), or null when walkable. `all` lists every obstacle model at the failing sample, for diagnosis.
  function explain(a,b,{all=false}={}){
    if(a.floor!==b.floor)return {check:'floor'};
    const tread=a.point_kind==='connector_tread'||b.point_kind==='connector_tread';
    const clearance=tread?.12:grid.clearance_m,verticalTolerance=tread?.65:.35;
    const supportIndices=[floorIndices.get(a.floor),...[...new Set([...(a.source_ids||[]),...(b.source_ids||[])])].map(id=>treadIndices.get(id)).filter(Boolean)];
    const supportAt=(p,z)=>supportIndices.some(idx=>idx&&mesh.support(p,idx(p)).some(s=>Math.abs(s.z-z)<=verticalTolerance));
    const length=Math.hypot(...a.enu.map((x,i)=>x-b.enu[i])),samples=Math.max(2,Math.ceil(length/.2));
    const blocks=o=>{
      const low=z0+(tread?.5:.15),high=z0+1.85;
      if(o.maxZ<low||o.minZ>high)return false;
      const clipped=clipPolygon(clipPolygon(o.vs,v=>v[2]-low),v=>high-v[2]);
      return clipped.length&&mesh.near(p0,clipped,clearance);
    };
    let p0,z0;
    for(let i=1;i<samples;i++){
      const t=i/samples,p=a.enu.map((v,k)=>v+(b.enu[k]-v)*t),z=p[2],at={t,at:p};
      if(!supportAt(p,z))return {check:'support',...at};
      if(!tread&&[0,Math.PI/2,Math.PI,Math.PI*1.5].some(angle=>!supportAt([p[0]+Math.cos(angle)*clearance,p[1]+Math.sin(angle)*clearance],z)))return {check:'clearance',...at};
      const custom=mesh.custom.find(c=>c.floor===a.floor&&mesh.near(p,c.vertices,clearance));if(custom)return {check:'custom',id:custom.id,...at};
      p0=p;z0=z;const hits=all?obstacles(p).filter(blocks):[obstacles(p).find(blocks)].filter(Boolean);
      if(hits.length)return {check:'obstacle',models:[...new Set(hits.map(o=>o.model))],...at};
    }
    return null;
  }
  function segment(a,b){checked++;const reason=explain(a,b);if(reason&&reason.check!=='floor')rejected++;return !reason;}
  return {segment,explain,stats:()=>({checked,rejected}),method:'mesh support + retired-aware obstacle sweep, 0.2m samples'};
}

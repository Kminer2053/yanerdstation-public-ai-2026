// Derived, public-only experience assets. The approved originals are never rewritten.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import sharp from 'sharp';
import {ShapeUtils,Vector2} from 'three';
import {matchingLegacyReplacementCrop,isCoplanarSurfacePlacement} from '../src/replacement-surface-contract.js';
import {normalizeCoplanarSurfaceUV,coplanarUVContractInfo,approvedImageOffsetECEF,normalizeApprovedFrameUV,approvedFrameImageOffsetECEF} from './commons-coplanar-uv.mjs';
import {F02WL072_FRAME,isF02wl072FrameReplacement} from '../app/f02wl072-frame.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),round=n=>Math.round(n*1000)/1000,roundUV=n=>Math.round(n*1e6)/1e6;
const graph=read('public/data/experience/walk-graph.json'),catalog=read('public/data/experience/catalog.json'),frozen=read('public/data/jury-frozen/approved-facades.json');
const lighting=read('app/seoul-lighting-zones.json'),seed=read('server/data/workbench-seed.json');
const selectedFloors=new Set(['2F','3F']);
const spawn=graph.points.find(p=>p[0]==='GRID-2F--2-30');if(!spawn)throw Error('Verified central hall spawn missing');
const east0=spawn[5],north0=spawn[6],up0=spawn[7],ground=spawn[4],origin=graph.origin;
// Match the grid generator's WGS84 ECEF -> ENU frame; a fixed metres/degree
// approximation shifts facade/access positions by up to 30 cm in this hall.
function ecef(lonDeg,latDeg,height){
 const lon=lonDeg*Math.PI/180,lat=latDeg*Math.PI/180,sin=Math.sin(lat),cos=Math.cos(lat),n=6378137/Math.sqrt(1-6.69437999014e-3*sin*sin);
 return [(n+height)*cos*Math.cos(lon),(n+height)*cos*Math.sin(lon),(n*(1-6.69437999014e-3)+height)*sin];
}
const anchor=ecef(origin.lon,origin.lat,origin.height),lon0=origin.lon*Math.PI/180,lat0=origin.lat*Math.PI/180;
function localECEF(point){
 const [dx,dy,dz]=point.map((v,i)=>v-anchor[i]);
 const east=-Math.sin(lon0)*dx+Math.cos(lon0)*dy,north=-Math.sin(lat0)*Math.cos(lon0)*dx-Math.sin(lat0)*Math.sin(lon0)*dy+Math.cos(lat0)*dz,up=Math.cos(lat0)*Math.cos(lon0)*dx+Math.cos(lat0)*Math.sin(lon0)*dy+Math.sin(lat0)*dz;
 return [round(east-east0),round(up-up0),round(north0-north)];
}
const local=([lon,lat,height])=>localECEF(ecef(lon,lat,height));
function localOffset(p){
 const [dx,dy,dz]=approvedImageOffsetECEF(p);
 return [-Math.sin(lon0)*dx+Math.cos(lon0)*dy,Math.cos(lat0)*Math.cos(lon0)*dx+Math.cos(lat0)*Math.sin(lon0)*dy+Math.sin(lat0)*dz,Math.sin(lat0)*Math.cos(lon0)*dx+Math.sin(lat0)*Math.sin(lon0)*dy-Math.cos(lat0)*dz];
}
const graphLocal=p=>[round(p[5]-east0),round(p[7]-up0),round(north0-p[6])];
for(const p of graph.points.filter(p=>selectedFloors.has(p[1])&&p[0].startsWith('GRID-'))){
 const a=local(p.slice(2,5)),b=graphLocal(p);if(a.some((v,i)=>Math.abs(v-b[i])>.002))throw Error(`WGS84/graph frame mismatch at ${p[0]}`);
}
const nodes=graph.points.map((p,i)=>({p,i})).filter(({p})=>selectedFloors.has(p[1])&&p[0].startsWith('GRID-')),remap=new Map(nodes.map((n,i)=>[n.i,i]));
const points=nodes.map(({p})=>graphLocal(p)),pointIds=nodes.map(({p})=>p[0]),pointFloors=nodes.map(({p})=>p[1]),nodeById=new Map(pointIds.map((id,i)=>[id,i]));
const edges=nodes.map(({i,p})=>graph.adj[i].filter(e=>!e[2]&&remap.has(e[0])&&graph.points[e[0]][1]===p[1]).map(e=>remap.get(e[0])));
const connectionById=new Map(graph.connections.map(c=>[c.id,c])),pairMap=new Map();
for(const [{p,i},node] of nodes.map((n,i)=>[n,i]))for(const edge of graph.adj[i]){
 const other=remap.get(edge[0]);if(other===undefined||!edge[2]||pointFloors[other]===p[1])continue;
 const a=Math.min(node,other),b=Math.max(node,other),key=edge[2]+'|'+a+'|'+b;
 if(!pairMap.has(key))pairMap.set(key,{sourceId:edge[2],a,b,ab:false,ba:false});pairMap.get(key)[node===a?'ab':'ba']=true;
}
const connections=[];
for(const pair of pairMap.values()){
 const c=connectionById.get(pair.sourceId);if(!c)throw Error('Compiled connection metadata missing: '+pair.sourceId);
 const both=pair.ab&&pair.ba,originalFrom=nodeById.get(c.from),originalTo=nodeById.get(c.to),hasOriginalPair=(originalFrom===pair.a&&originalTo===pair.b)||(originalFrom===pair.b&&originalTo===pair.a),from=both?(hasOriginalPair?originalFrom:pair.a):(pair.ab?pair.a:pair.b),to=both?(hasOriginalPair?originalTo:pair.b):(pair.ab?pair.b:pair.a);
 // An elevator's independently registered stops can produce multiple pairs;
 // use the compiled directed edges rather than inventing floor stops.
 const pairCount=[...pairMap.values()].filter(p=>p.sourceId===pair.sourceId).length,id=pairCount===1?c.id:c.id+':'+pointIds[from]+':'+pointIds[to];
 const actualpath=Array.isArray(c.coordinates)&&c.kind!=='elevator'?c.coordinates.map(local):[points[from],points[to]];
 if(c.from&&c.from!==pointIds[from]&&c.kind!=='elevator')actualpath.reverse();
 connections.push({id,sourceId:c.id,type:c.kind,name:c.name,sourceStatus:c.status,direction:both?'both':'forward',from:{floor:pointFloors[from],point:points[from],node:from},to:{floor:pointFloors[to],point:points[to],node:to},actualpath,...(c.kind==='elevator'?{stopGroupId:c.id,stops:(c.stops||[]).filter(id=>nodeById.has(id)).map(id=>{const node=nodeById.get(id);return {floor:pointFloors[node],point:points[node],node};})}:{})});
}
const out='public/data/commons';fs.mkdirSync(out,{recursive:true});
const xzs=points.map(p=>[p[0],p[2]]),extent=[Math.min(...xzs.map(p=>p[0]))-1,Math.min(...xzs.map(p=>p[1]))-1,Math.max(...xzs.map(p=>p[0]))+1,Math.max(...xzs.map(p=>p[1]))+1];
const floors={};
for(const floor of selectedFloors){
 const ids=points.map((_,i)=>i).filter(i=>pointFloors[i]===floor),ys=ids.map(i=>points[i][1]).sort((a,b)=>a-b),pool=new Set(ids),seen=new Set(),components=[];
 for(const node of ids){if(seen.has(node))continue;const q=[node];seen.add(node);for(let k=0;k<q.length;k++)for(const j of edges[q[k]])if(pool.has(j)&&!seen.has(j)){seen.add(j);q.push(j);}components.push(q);}
 components.sort((a,b)=>b.length-a.length);const ref=floor==='2F'?[10,20]:[0,0],safe=[...components[0]].sort((a,b)=>(points[a][0]-ref[0])**2+(points[a][2]-ref[1])**2-((points[b][0]-ref[0])**2+(points[b][2]-ref[1])**2))[0];
 const box=[0,1,2].map(k=>Math.min(...ids.map(i=>points[i][k]))).concat([0,1,2].map(k=>Math.max(...ids.map(i=>points[i][k]))));
 floors[floor]={height:round(ys[Math.floor(ys.length/2)]),heightRange:[ys[0],ys.at(-1)],extent:[box[0]-1,box[2]-1,box[3]+1,box[5]+1],bounds:box,pointCount:ids.length,spawn:points[safe],spawnNode:safe,spawnPointId:pointIds[safe],componentCount:components.length,largestComponentSize:components[0].length,componentSizes:components.map(c=>c.length)};
}
const visibleBounds=[extent[0]-20,-.8,extent[1]-20,extent[2]+20,26,extent[3]+20];
function surface(s,p){
 if(isCoplanarSurfacePlacement(p)){
  const offset=approvedImageOffsetECEF(p),normalized=normalizeCoplanarSurfaceUV(p);
  return {vs:p.corners_wgs84.map(c=>localECEF(ecef(...c).map((v,i)=>v+offset[i]))),coords:normalized.coords,indices:normalized.indices,basis:'approved-coplanar'};
 }
 const w=Number(p.surface_width_m||s.surface_width_m),h=Number(p.surface_height_m||s.surface_height_m),longitude=Number(p.longitude??s.longitude),latitude=Number(p.latitude??s.latitude),height=Number(p.height_m??s.height_m),heading=Number(p.camera_heading_deg??s.camera_heading_deg);
 if(!(w>0&&h>0)||![longitude,latitude,height,heading].every(Number.isFinite))return null;
 const offset=approvedImageOffsetECEF({longitude,latitude,camera_heading_deg:heading}),c=localECEF(ecef(longitude,latitude,height).map((v,i)=>v+offset[i])),a=heading*Math.PI/180,right=[-Math.cos(a),0,-Math.sin(a)];
 return {vs:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>[round(c[0]+right[0]*w*x/2),round(c[1]+h*y/2),round(c[2]+right[2]*w*x/2)]),coords:[[0,0],[1,0],[1,1],[0,1]],basis:'approved-slot-dimensions'};
}
const approved=frozen.replacements.filter(r=>r.is_active&&r.review_status==='approved'&&['2F','3F'].includes(r.slot.floor));
const legacyFile=out+'/hall-legacy-surfaces.json',cachedLegacy=fs.existsSync(legacyFile)?read(legacyFile):null,legacy=cachedLegacy?.schema===2?cachedLegacy:{schema:2,revision:seed.revision,origin:{...origin,east0,north0,up0},surfaces:{},sourceCounts:{},basis:'Observed source triangle components matched to the approved slot source UV region signature using the original connected-surface contract; no inferred faces.'};
const workspace=path.resolve(process.env.STATION_SOURCE_WORKSPACE||'..'),slotPath=path.join(workspace,'outputs/20260831_vworld_seoul_image_catalog/object-texture-slots.json');
let sourceApi=null,sourceSlots=null;const tileCache=new Map();let recoveredLegacy=false;
async function recoverSurface(s){
 if(legacy.surfaces[s.slot_alias])return legacy.surfaces[s.slot_alias];
 if(!fs.existsSync(slotPath))return [];
 sourceSlots??=new Map(read(slotPath).map(s=>[s.slot_alias,s]));const original=sourceSlots.get(s.slot_alias);
 if(!original?.source_feature_key||!original.source_image_id)return [];
 if(!sourceApi){
  const require=createRequire(path.join(workspace,'package.json')),draco=await require('./tmp/vworld-seoul-full-catalog/vendor/node_modules/draco3dgltf/draco3dgltf.js').createDecoderModule({}),code=fs.readFileSync(path.join(workspace,'tools/build_vworld_image_catalog.mjs'),'utf8');
  sourceApi=new Function('fs','crypto','draco','SITE_ORIGIN','imageId','featureKey',code.slice(code.indexOf('const sha256 ='),code.indexOf('async function imagePreview'))+';return {parseB3dm,meshTransforms,identityMatrix,decodeDracoPrimitive,readAccessor,transformPoint,ecefToEnu,transformedUv,unitNormal,connectedSurfaceComponents};')(fs,crypto,draco,origin,()=>'',()=> '');
 }
 const [tile,feature]=original.source_feature_key.split(':F'),imageId=Number(original.source_image_id.split(':I')[1]);
 if(!tileCache.has(tile)){
  const p=sourceApi.parseB3dm(path.join(workspace,'tmp/vworld-seoul-full-catalog/tiles',tile+'.bin')),transforms=sourceApi.meshTransforms(p.gltf),rtc=p.featureTable.RTC_CENTER,triangles=[];
  for(const [mi,mesh]of p.gltf.meshes.entries())for(const [pi,primitive] of mesh.primitives.entries()){
   const d=sourceApi.decodeDracoPrimitive(p.gltf,p.binary,primitive),positions=d?.positions??sourceApi.readAccessor(p.gltf,p.binary,primitive.attributes.POSITION),batches=d?.batchIds??sourceApi.readAccessor(p.gltf,p.binary,primitive.attributes._BATCHID),ix=d?.indices??sourceApi.readAccessor(p.gltf,p.binary,primitive.indices)?.flat(),info=p.gltf.materials?.[primitive.material]?.pbrMetallicRoughness?.baseColorTexture,tex=p.gltf.textures?.[info?.index],image=tex?.extensions?.KHR_texture_basisu?.source??tex?.source,texSet=info?.extensions?.KHR_texture_transform?.texCoord??info?.texCoord??0,uv=texSet===1?(d?.texCoords1??sourceApi.readAccessor(p.gltf,p.binary,primitive.attributes.TEXCOORD_1)):(d?.texCoords0??sourceApi.readAccessor(p.gltf,p.binary,primitive.attributes.TEXCOORD_0));
   if(!positions||!ix||!uv)continue;
   for(const [ti,transform]of (transforms.get(mi)||[sourceApi.identityMatrix()]).entries()){
    const world=positions.map(v=>sourceApi.transformPoint(transform,v)),verts=world.map(v=>{const p=sourceApi.ecefToEnu(v.map((n,k)=>n+rtc[k]));return [round(p.east-east0),round(p.up-up0),round(north0-p.north)];});
    for(let i=0;i<ix.length;i+=3){const ids=ix.slice(i,i+3),points=ids.map(j=>world[j]),uvs=ids.map(j=>sourceApi.transformedUv(uv[j],info));triangles.push({feature:Math.round(batches?.[ids[0]]?.[0]??mi),image,material:primitive.material,vs:ids.map(j=>verts[j]),uv:uvs,uvs,points,normal:sourceApi.unitNormal(...points),vertex_keys:ids.map(j=>`${mi}:${pi}:${ti}:${j}`)});}
   }
  }
  tileCache.set(tile,triangles);
 }
 const {u_min,u_max,v_min,v_max}=original,candidates=tileCache.get(tile).filter(t=>t.feature===Number(feature)&&t.image===imageId),byMaterial=new Map();
 for(const t of candidates){if(!byMaterial.has(t.material))byMaterial.set(t.material,[]);byMaterial.get(t.material).push(t);}
 const selected=[];
 for(const [material,triangles]of byMaterial){
  const merged=[];
  for(const component of sourceApi.connectedSurfaceComponents(triangles)){
   const uvs=component.flatMap(t=>t.uv),box=[Math.min(...uvs.map(p=>p[0])),Math.min(...uvs.map(p=>p[1])),Math.max(...uvs.map(p=>p[0])),Math.max(...uvs.map(p=>p[1]))].map(v=>Math.max(0,Math.min(1,v)));
   if(box[2]-box[0]<1e-7||box[3]-box[1]<1e-7)continue;
   const old=merged.find(c=>c.box.every((v,i)=>Math.abs(v-box[i])<=.002)||Math.max(0,Math.min(c.box[2],box[2])-Math.max(c.box[0],box[0]))*Math.max(0,Math.min(c.box[3],box[3])-Math.max(c.box[1],box[1]))/Math.max((c.box[2]-c.box[0])*(c.box[3]-c.box[1]),(box[2]-box[0])*(box[3]-box[1]),1e-12)>=.96);
   if(old){old.box=[Math.min(old.box[0],box[0]),Math.min(old.box[1],box[1]),Math.max(old.box[2],box[2]),Math.max(old.box[3],box[3])];old.triangles.push(...component);}else merged.push({box,triangles:component.slice()});
  }
  for(const group of merged){const signature=crypto.createHash('sha256').update([imageId,material??'none',...group.box.map(v=>v.toFixed(6))].join('|')).digest('hex').slice(0,20);if(signature===original.source_region_signature)selected.push(...group.triangles);}
 }
 if(selected.length!==Number(original.triangle_count)){console.warn(JSON.stringify({legacySurfaceCountMismatch:s.slot_alias,expected:original.triangle_count,recovered:selected.length}));return [];}
 const result=selected.map(t=>({vs:t.vs,coords:t.uv.map(([u,v])=>[Math.max(0,Math.min(1,(u-u_min)/(u_max-u_min))),1-Math.max(0,Math.min(1,(v-v_min)/(v_max-v_min)))]),basis:'approved-legacy-source-component'}));
 if(result.length){legacy.surfaces[s.slot_alias]=result;legacy.sourceCounts[s.slot_alias]={expected:Number(original.triangle_count),recovered:result.length,signature:original.source_region_signature};recoveredLegacy=true;}return result;
}
const rows=[],audit={approvedRows:approved.length,explicitRows:0,sourceRecoveredRows:0,slotDimensionRows:0,includedRows:0,included2F:0,included3F:0,noSurface:[],outsideBounds:[]};
for(const r of approved){const s=r.slot;let surfaces=isF02wl072FrameReplacement(r)?F02WL072_FRAME.surfaces.map(p=>{
 const offset=approvedFrameImageOffsetECEF(p),normalized=normalizeApprovedFrameUV(p);
 return {vs:p.corners.map(c=>localECEF(ecef(...c).map((v,i)=>v+offset[i]))),coords:normalized.coords,indices:normalized.indices,basis:'approved-exact-frame'};
}):(s.surface_placements||[]).map(p=>surface(s,p)).filter(Boolean);
 if(surfaces.length)audit.explicitRows++;
 else{surfaces=await recoverSurface(s);if(surfaces.length){const offset=localOffset(s);surfaces=surfaces.map(f=>({...f,vs:f.vs.map(v=>v.map((n,i)=>round(n+offset[i])))}));audit.sourceRecoveredRows++;}else{const fallback=surface(s,s);if(fallback){surfaces=[fallback];audit.slotDimensionRows++;}}}
 if(!surfaces.length){audit.noSurface.push(s.slot_alias);continue;}
 rows.push({replacement:r,surfaces});audit.includedRows++;audit[s.floor==='2F'?'included2F':'included3F']++;
}
if(recoveredLegacy)fs.writeFileSync(legacyFile,JSON.stringify(legacy));
console.log(JSON.stringify({facadeCoverage:audit}));
const atlasSize=2048,previewSize=rows.length<=49?256:192,gutter=2,tile=previewSize+gutter*2,columns=Math.floor(atlasSize/tile),composites=[],facades=[],detailCache=new Map();let inputBytes=0;
if(rows.length>columns*columns)throw Error('Approved facade atlas budget exceeded');
fs.mkdirSync(out+'/facades',{recursive:true});
for(const [i,{replacement:r,surfaces}] of rows.entries()){
 const s=r.slot,file=path.join('public',r.image_url),crop=matchingLegacyReplacementCrop(s,r);inputBytes+=fs.statSync(file).size;
 let image=sharp(file);if(crop)image=image.extract({left:crop.left,top:crop.top,width:crop.width,height:crop.height});
 const detailDigest=crypto.createHash('sha256').update(r.sha256||fs.readFileSync(file)).update(JSON.stringify(crop)).update('1536x1024-q88-v1').digest('hex').slice(0,32);
 let detailImage=detailCache.get(detailDigest);
 if(!detailImage){
  const detailFile=out+'/facades/'+detailDigest+'.webp';
  const info=fs.existsSync(detailFile)?{...(await sharp(detailFile).metadata()),size:fs.statSync(detailFile).size}:await image.clone().resize(1536,1024,{fit:'inside',withoutEnlargement:true}).webp({quality:88,effort:4}).toFile(detailFile);
  detailImage={url:'/data/commons/facades/'+detailDigest+'.webp',width:info.width,height:info.height,bytes:info.size};detailCache.set(detailDigest,detailImage);
  }
 const {data,info}=await image.clone().resize(previewSize,previewSize,{fit:'inside',withoutEnlargement:true}).extend({top:gutter,bottom:gutter,left:gutter,right:gutter,extendWith:'copy'}).png().toBuffer({resolveWithObject:true});
 const width=info.width-gutter*2,height=info.height-gutter*2,left=(i%columns)*tile+gutter,top=Math.floor(i/columns)*tile+gutter;composites.push({input:data,left:left-gutter,top:top-gutter});
 const positions=[],uv=[],detailUV=[],indices=[];
 for(const {vs,coords,indices:surfaceIndices} of surfaces){
  const offset=positions.length/3;positions.push(...vs.flat());
  for(const [u,v] of coords){uv.push((left+u*width)/atlasSize,1-(top+(1-v)*height)/atlasSize);detailUV.push(u,v);}
  if(surfaceIndices)indices.push(...surfaceIndices.map(n=>n+offset));
  else for(const triangle of ShapeUtils.triangulateShape(coords.map(([u,v])=>new Vector2(u,v)),[]))indices.push(...triangle.map(n=>n+offset));
 }
 if(!positions.length)continue;
 const facility=catalog.facilities.find(f=>f.source_id===s.slot_alias);
 facades.push({alias:s.slot_alias,floor:s.floor,facilityId:facility?.id||null,name:facility?.name||r.current_store_name,positions,uv:uv.map(roundUV),detailUV:detailUV.map(roundUV),indices,sourceImage:r.image_url,detailImage,geometryBasis:[...new Set(surfaces.map(f=>f.basis))]});
}
await sharp({create:{width:atlasSize,height:atlasSize,channels:3,background:'#b5aea2'}}).composite(composites).webp({quality:80,effort:6}).toFile(out+'/hall-atlas.webp');
const facilities=catalog.facilities.filter(f=>selectedFloors.has(f.floor)&&f.reference).map(f=>({id:f.id,name:f.name,floor:f.floor,category:f.category,hours:f.hours||'확인 필요',notes:f.notes||'',point:local([f.reference.lon,f.reference.lat,f.reference.height]),access:Array.isArray(f.access)?local(f.access):null,accessNode:nodeById.get(f.access_id)??null,alias:f.source_id,reference:f.reference,products:(f.products||[]).slice(0,3).map(p=>({name:p.name,price:p.price,price_text:p.price_text}))}));
const ceilings=lighting.slabs.filter(t=>t.some(p=>p[0]-east0>=extent[0]&&p[0]-east0<=extent[2]&&north0-p[1]>=extent[1]&&north0-p[1]<=extent[3])).map(t=>t.map(p=>[round(p[0]-east0),round(p[2]-lighting.ceilingDrop-up0),round(north0-p[1])]));
const hash=crypto.createHash('sha256').update(JSON.stringify({points,edges,pointFloors,pointIds,floors,connections,facades,facilities,ceilings})).digest('hex').slice(0,12);
const uvContract=coplanarUVContractInfo();
const manifest={schema:1,version:hash,revision:seed.revision,site:'S202103',floor:'2F',zone:'station-2f-3f',name:'서울역 2·3층',basis:'등록 기준본의 경량 재구성 · 현장 실측 및 실시간 혼잡 아님',origin:{...origin,east0,north0,up0,ground},spawn:floors['2F'].spawn,extent,visibleBounds,floors,walk:{step:2,points,edges,floors:pointFloors,pointIds},connections,facades,facilities,ceilings,atlas:'/data/commons/hall-atlas.webp',facadeCoverage:audit,facadeUVContract:{engineVersion:uvContract.engineVersion,engineSHA256:uvContract.engineSHA256,imageOffset:uvContract.imageOffset,...uvContract.counts},atlasSize,previewSize};
fs.writeFileSync(out+'/hall.json',JSON.stringify(manifest));
console.log(JSON.stringify({version:hash,walkCells:points.length,facades:facades.length,facilities:facilities.length,connections:connections.length,floors,manifestBytes:fs.statSync(out+'/hall.json').size,atlasBytes:fs.statSync(out+'/hall-atlas.webp').size,sourcePhotoBytes:inputBytes,detailFiles:detailCache.size,detailBytes:[...detailCache.values()].reduce((n,r)=>n+r.bytes,0),facadeCoverage:audit}));

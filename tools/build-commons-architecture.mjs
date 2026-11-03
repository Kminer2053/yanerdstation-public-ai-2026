// Derive a bounded architectural shell from the already cached, observed VWorld
// snapshot. No source downloads or source changes. Texture sources are locally
// decoded, digest-deduplicated and repacked into a bounded downsampled atlas.
// Usage (from service): node tools/build-commons-architecture.mjs [source-workspace]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {createRequire} from 'node:module';
import {retiredWhole,retiredTriangle,visibleFragments,clipPolygon,retirementFiles} from './point-retirement.mjs';

const root=path.resolve(process.argv[2]||'..');
const hall=JSON.parse(fs.readFileSync('public/data/commons/hall.json','utf8'));
const source=path.join(root,'tmp/vworld-seoul-full-catalog/tiles');
const require=createRequire(path.join(root,'package.json'));
const draco=await require('./tmp/vworld-seoul-full-catalog/vendor/node_modules/draco3dgltf/draco3dgltf.js').createDecoderModule({});
const parserFile=path.join(root,'tools/build_vworld_image_catalog.mjs');
const parser=fs.readFileSync(parserFile,'utf8');
const api=new Function('fs','crypto','draco','SITE_ORIGIN','imageId','featureKey',parser.slice(parser.indexOf('const sha256 ='),parser.indexOf('async function imagePreview'))+';return {parseB3dm,meshTransforms,identityMatrix,decodeDracoPrimitive,readAccessor,transformPoint,ecefToEnu,transformedUv};')(fs,crypto,draco,hall.origin,()=>'',()=> '');
const imageRoot=path.join(root,'outputs/20260831_vworld_seoul_image_catalog');
const imageRows=JSON.parse(fs.readFileSync(path.join(imageRoot,'image-catalog.json'),'utf8'));
const imageById=new Map(imageRows.map(r=>[r.tile+':'+r.image_index,r]));
const {east0,north0,up0}=hall.origin;
if(![east0,north0,up0].every(Number.isFinite))throw Error('Build the ENU-aligned hall manifest first');
const margin=20,bounds=hall.visibleBounds??[hall.extent[0]-margin,-.8,hall.extent[1]-margin,hall.extent[2]+margin,26,hall.extent[3]+margin];
const navigationFloors=['2F','3F'],barrierHeights=Object.fromEntries(navigationFloors.map(floor=>{
 const height=hall.floors?.[floor]?.height;if(!Number.isFinite(height))throw Error('Missing navigation floor height: '+floor);return [floor,height+1];
}));
const toLocal=([e,n,u])=>[e-east0,u-up0,north0-n];
const material={
 columns:{color:'#d5d4c8',roughness:.86,opacity:1,transparent:false},
 roof:{color:'#d7deda',roughness:.78,opacity:1,transparent:false},
 floors:{color:'#b9c0b8',roughness:.93,opacity:1,transparent:false},
 walls:{color:'#b5bcb5',roughness:.88,opacity:1,transparent:false},
 details:{color:'#8e9b99',roughness:.66,opacity:1,transparent:false},
 glass:{color:'#b9d9da',roughness:.2,opacity:.25,transparent:true},
};
const groups=new Map();
function groupFor(floor,kind){
 const name=floor+':'+kind;if(!groups.has(name))groups.set(name,{name,floor,kind,roofContext:!navigationFloors.includes(floor),material:material[kind],positions:[],uv:[],indices:[],vertices:new Map(),triangles:new Set(),models:new Set(),faces:[]});return groups.get(name);
}
const counters={tilesScanned:0,tilesDecoded:0,sourceTriangles:0,outsideTriangles:0,hiddenModelTriangles:0,retiredTriangles:0,visibleTriangles:0,degenerateTriangles:0,duplicateTriangles:0,texturedTriangles:0,untexturedTriangles:0,repeatAverageTriangles:0};
const sources=[],modelSummary=new Map(),textureSources=new Map(),barrierMaps=new Map(navigationFloors.map(floor=>[floor,new Map()]));
const isModelAllowed=(p,id)=>['2F','3F','4F','RF'].includes(p.batchTable.FLOOR?.[id])&&/^(?:F0[1-4])(?:PL|CL|FL|WL|DR|FC|MV|WN|WD)/.test(p.batchTable.MODEL_NAME?.[id]||'');
const kindFor=(model,mat)=>{
 const pbr=mat?.pbrMetallicRoughness;
 if(mat?.alphaMode==='BLEND'||Number(pbr?.baseColorFactor?.[3]??1)<.8)return 'glass';
 const kind=model.slice(3,5);
 return kind==='PL'?'columns':kind==='CL'?'roof':kind==='FL'?'floors':kind==='WL'||kind==='DR'?'walls':'details';
};
const outside=vs=>[0,1,2].some(a=>vs.every(v=>v[a]<bounds[a])||vs.every(v=>v[a]>bounds[a+3]));
const clip=vs=>{
 let poly=vs;
 for(let a=0;a<3&&poly.length;a++){poly=clipPolygon(poly,p=>p[a]-bounds[a]);poly=clipPolygon(poly,p=>bounds[a+3]-p[a]);}
 return poly;
};
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
function interpolateUV(point,triangle,uv){
 if(!uv?.every(p=>p?.every(Number.isFinite)))return null;
 const [a,b,c]=triangle,e=b.map((v,i)=>v-a[i]),f=c.map((v,i)=>v-a[i]),q=point.map((v,i)=>v-a[i]),ee=dot(e,e),ef=dot(e,f),ff=dot(f,f),den=ee*ff-ef*ef;
 if(Math.abs(den)<1e-16)return null;
 const u=(ff*dot(q,e)-ef*dot(q,f))/den,v=(ee*dot(q,f)-ef*dot(q,e))/den;
 return [0,1].map(k=>uv[0][k]+u*(uv[1][k]-uv[0][k])+v*(uv[2][k]-uv[0][k]));
}
function sourceTexture(p,primitive,filename){
 const mat=p.gltf.materials?.[primitive.material],info=mat?.pbrMetallicRoughness?.baseColorTexture,texture=p.gltf.textures?.[info?.index],image=texture?.extensions?.KHR_texture_basisu?.source??texture?.source;
 const row=imageById.get(filename.replace('.bin','')+':'+image);
 if(!row||row.placeholder)return null;
 const tint=(mat?.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1]).slice(0,3),key=row.image_sha256+':'+tint.join(',');
 if(!textureSources.has(key))textureSources.set(key,{key,row,tint,score:0,used:0,file:path.join(imageRoot,row.mime_type==='image/ktx2'?row.preview_path:row.asset_path)});
 return {key,info,texCoord:info.extensions?.KHR_texture_transform?.texCoord??info.texCoord??0,sampler:p.gltf.samplers?.[texture.sampler]||{}};
}
function sourceBarrier(points,group){
 if(group.kind==='roof'||group.kind==='floors')return;
 for(const floor of navigationFloors){
  const plane=barrierHeights[floor],epsilon=1e-6,hits=[];
  if(points.every(p=>Math.abs(p[1]-plane)<epsilon))continue;
  for(let i=0;i<3;i++){
   const a=points[i],b=points[(i+1)%3],da=a[1]-plane,db=b[1]-plane;
   if(Math.abs(da)<epsilon)hits.push([a[0],a[2]]);
   if(da*db<0){const t=da/(da-db);hits.push([a[0]+(b[0]-a[0])*t,a[2]+(b[2]-a[2])*t]);}
  }
  const unique=[...new Map(hits.map(p=>{const q=p.map(v=>Math.round(v*1000)/1000);return [q.join(','),q];})).values()];
  if(unique.length!==2||Math.hypot(unique[0][0]-unique[1][0],unique[0][1]-unique[1][1])<.003)continue;
  unique.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const segment=unique.flat();barrierMaps.get(floor).set(segment.join(','),segment);
 }
}
function addTriangle(group,vs,model,coords,texture){
 const points=vs.map(p=>p.map(v=>Math.round(v*1000)/1000));
 const [a,b,c]=points,u=b.map((v,i)=>v-a[i]),v=c.map((value,i)=>value-a[i]);
 const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 if(Math.hypot(...cross)<1e-6){counters.degenerateTriangles++;return;}
 const keys=points.map(p=>p.join(',')),triangle=keys.slice().sort().join('|');
 if(group.triangles.has(triangle)){counters.duplicateTriangles++;return;}
 group.triangles.add(triangle);group.models.add(model);
 group.faces.push({points,coords,texture});sourceBarrier(points,group);
 if(texture&&coords.every(Boolean)){
  const src=textureSources.get(texture.key),center=points[0].map((_,i)=>(points[0][i]+points[1][i]+points[2][i])/3);
  src.used++;src.score+=Math.hypot(...cross)/(15+Math.hypot(center[0],center[2]))*(group.kind==='columns'?2:1);
 }
 counters.visibleTriangles++;
 const stats=modelSummary.get(model)||{model,floor:group.floor,group:group.name,triangles:0};stats.triangles++;modelSummary.set(model,stats);
}

for(const filename of fs.readdirSync(source).filter(n=>/^B_1_.*\.bin$/.test(n)).sort()){
 counters.tilesScanned++;
 const file=path.join(source,filename),p=api.parseB3dm(file);
 if(!p.batchTable.MODEL_NAME?.some((_,id)=>isModelAllowed(p,id)))continue;
 counters.tilesDecoded++;let used=false;
 const transforms=api.meshTransforms(p.gltf),rtc=p.featureTable.RTC_CENTER||[0,0,0];
 for(const [mi,mesh] of p.gltf.meshes.entries())for(const primitive of mesh.primitives){
  const decoded=api.decodeDracoPrimitive(p.gltf,p.binary,primitive);
  const positions=decoded?.positions??api.readAccessor(p.gltf,p.binary,primitive.attributes.POSITION),batches=decoded?.batchIds??api.readAccessor(p.gltf,p.binary,primitive.attributes._BATCHID),uv=decoded?.texCoords0??api.readAccessor(p.gltf,p.binary,primitive.attributes.TEXCOORD_0),indices=decoded?.indices??api.readAccessor(p.gltf,p.binary,primitive.indices)?.flat();
  if(!positions||!indices)continue;
  const mat=p.gltf.materials?.[primitive.material],texture=sourceTexture(p,primitive,filename);
  const textureUV=texture?.texCoord===1?(decoded?.texCoords1??api.readAccessor(p.gltf,p.binary,primitive.attributes.TEXCOORD_1)):uv;
  for(const transform of transforms.get(mi)||[api.identityMatrix()]){
   const enu=positions.map(v=>{const q=api.ecefToEnu(api.transformPoint(transform,v).map((a,i)=>a+rtc[i]));return [q.east,q.north,q.up];});
   for(let i=0;i<indices.length;i+=3){
    const ids=indices.slice(i,i+3),id=Math.round(batches?.[ids[0]]?.[0]??mi);
    if(!isModelAllowed(p,id))continue;
    counters.sourceTriangles++;
    const model=p.batchTable.MODEL_NAME[id],floor=p.batchTable.FLOOR[id],td=p.batchTable.TD_ID?.[id],vs=ids.map(j=>enu[j]),local=vs.map(toLocal);
    if(outside(local)){counters.outsideTriangles++;continue;}
    if(retiredWhole({FLOOR:floor,MODEL_NAME:model,TD_ID:td})){counters.hiddenModelTriangles++;continue;}
    if(retiredTriangle(vs,ids.map(j=>uv?.[j]))){counters.retiredTriangles++;continue;}
    const group=groupFor(floor,kindFor(model,mat));
    const sourceUV=ids.map(j=>api.transformedUv(textureUV?.[j],texture?.info));
    for(const fragment of visibleFragments(vs)){
     const polygon=clip(fragment.map(toLocal));
     for(let n=1;n<polygon.length-1;n++){const face=[polygon[0],polygon[n],polygon[n+1]];addTriangle(group,face,model,face.map(point=>interpolateUV(point,local,sourceUV)),texture);used=true;}
    }
   }
  }
 }
 if(used)sources.push({tile:filename,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
}
// Atlas UVs cannot repeat across neighbouring tiles. Only a triangle that stays
// within one original repeat cell can be wrapped safely; genuinely tiled faces
// use the source image's average colour instead of folding vertex UVs.
function normalizeUV(coords,sampler){
 if(!coords?.every(p=>p?.every(Number.isFinite)))return null;
 const result=coords.map(p=>p.slice());
 for(let axis=0;axis<2;axis++){
  const values=coords.map(p=>p[axis]),min=Math.min(...values),max=Math.max(...values),wrap=(axis?sampler.wrapT:sampler.wrapS)??10497;
  if(min>=-1e-5&&max<=1+1e-5){result.forEach(p=>p[axis]=Math.max(0,Math.min(1,p[axis])));continue;}
  if(wrap===33071){result.forEach(p=>p[axis]=Math.max(0,Math.min(1,p[axis])));continue;}
  const cell=Math.floor(min+1e-5);if(Math.floor(max-1e-5)!==cell)return null;
  result.forEach(p=>{p[axis]=Math.max(0,Math.min(1,p[axis]-cell));if(wrap===33648&&Math.abs(cell%2)===1)p[axis]=1-p[axis];});
 }
 return result;
}
const swatches=new Map();
for(const g of groups.values())for(const face of g.faces){
 const texture=face.texture,source=texture&&textureSources.get(texture.key),normalized=texture&&normalizeUV(face.coords,texture.sampler);
 if(source&&normalized){face.imageKey='image:'+source.key;face.normalizedUV=normalized;source.mapped=(source.mapped||0)+1;counters.texturedTriangles++;}
 else if(source&&face.coords.every(Boolean)){face.imageKey='average:'+source.key;source.averaged=(source.averaged||0)+1;counters.repeatAverageTriangles++;}
 else{face.imageKey='flat:'+g.name;swatches.set(face.imageKey,g.material.color);counters.untexturedTriangles++;}
}
const records=[];
for(const src of textureSources.values()){
 if(!src.mapped&&!src.averaged)continue;
 let image=sharp(src.file).removeAlpha();if(src.tint.some(v=>Math.abs(v-1)>1e-6))image=image.linear(src.tint,[0,0,0]);
 const raw=await image.clone().resize(32,32,{fit:'fill'}).raw().toBuffer({resolveWithObject:true});
 const average=[0,1,2].map(c=>{let sum=0;for(let i=c;i<raw.data.length;i+=raw.info.channels)sum+=raw.data[i];return Math.round(sum/(raw.data.length/raw.info.channels));});
 if(src.averaged)records.push({key:'average:'+src.key,size:8,color:{r:average[0],g:average[1],b:average[2]},source:src});
 if(src.mapped)records.push({key:'image:'+src.key,size:Math.min(96,src.row.width_px,src.row.height_px),source:src,score:src.score});
}
for(const [key,color]of swatches)records.push({key,size:8,color});
const atlasSize=2048,gutter=2;
function pack(records,sizes){
 let free=[{x:0,y:0,w:atlasSize,h:atlasSize}];const placed=new Map();
 for(const r of [...records].sort((a,b)=>(sizes.get(b.key)||b.size)-(sizes.get(a.key)||a.size)||a.key.localeCompare(b.key))){
  const size=sizes.get(r.key)||r.size,w=size+gutter*2,h=w;let best=null;
  for(const f of free)if(f.w>=w&&f.h>=h){const score=Math.min(f.w-w,f.h-h)*atlasSize+Math.max(f.w-w,f.h-h);if(!best||score<best.score)best={x:f.x,y:f.y,w,h,size,score};}
  if(!best)return null;
  const split=[];for(const f of free){
   if(best.x>=f.x+f.w||best.x+best.w<=f.x||best.y>=f.y+f.h||best.y+best.h<=f.y){split.push(f);continue;}
   if(best.x>f.x)split.push({x:f.x,y:f.y,w:best.x-f.x,h:f.h});
   if(best.x+best.w<f.x+f.w)split.push({x:best.x+best.w,y:f.y,w:f.x+f.w-best.x-best.w,h:f.h});
   if(best.y>f.y)split.push({x:f.x,y:f.y,w:f.w,h:best.y-f.y});
   if(best.y+best.h<f.y+f.h)split.push({x:f.x,y:best.y+best.h,w:f.w,h:f.y+f.h-best.y-best.h});
  }
  free=split.filter((f,i)=>!split.some((o,j)=>i!==j&&o.x<=f.x&&o.y<=f.y&&o.x+o.w>=f.x+f.w&&o.y+o.h>=f.y+f.h&&(j<i||o.x!==f.x||o.y!==f.y||o.w!==f.w||o.h!==f.h)));
  placed.set(r.key,{left:best.x+gutter,top:best.y+gutter,size});
 }
 return placed;
}
const highPriority=records.filter(r=>r.source&&r.key.startsWith('image:')&&Math.min(r.source.row.width_px,r.source.row.height_px)>=256).sort((a,b)=>b.score-a.score);
const baseline=pack(records,new Map());if(!baseline)throw Error('96px texture atlas budget exceeded');
let atlasPositions=baseline,heroCount=0;
for(const count of [24,16,8]){const sizes=new Map(highPriority.slice(0,count).map(r=>[r.key,256])),candidate=pack(records,sizes);if(candidate){atlasPositions=candidate;heroCount=Math.min(count,highPriority.length);break;}}
async function renderAtlas(positions){
 const composites=[];
 for(const r of records){const tile=positions.get(r.key);let image=r.color?sharp({create:{width:tile.size,height:tile.size,channels:3,background:r.color}}):sharp(r.source.file).removeAlpha().resize(tile.size,tile.size,{fit:'fill'});
  if(!r.color&&r.source.tint.some(v=>Math.abs(v-1)>1e-6))image=image.linear(r.source.tint,[0,0,0]);
  const input=await image.extend({top:gutter,bottom:gutter,left:gutter,right:gutter,extendWith:'copy'}).png().toBuffer();composites.push({input,left:tile.left-gutter,top:tile.top-gutter});}
 return sharp({create:{width:atlasSize,height:atlasSize,channels:3,background:'#c6c9c3'}}).composite(composites).webp({quality:82,effort:6}).toBuffer();
}
const baselineAtlas=await renderAtlas(baseline),atlasBytes=heroCount?await renderAtlas(atlasPositions):baselineAtlas;
if(atlasBytes.length>2_000_000)throw Error('Encoded texture atlas exceeds 2 MB');
const atlasStats={width:atlasSize,height:atlasSize,bytes:atlasBytes.length,gpuBytesWithMipmaps:Math.ceil(atlasSize*atlasSize*4*4/3),sourceImageReferences:records.filter(r=>r.key.startsWith('image:')).reduce((s,r)=>s+r.source.mapped,0),uniqueSourceImages:records.filter(r=>r.key.startsWith('image:')).length,averageSwatches:records.filter(r=>r.key.startsWith('average:')).length,baseTileSize:96,hero256Tiles:heroCount,baseline96Bytes:baselineAtlas.length,gutter,uvOrigin:'source glTF top-left -> Three atlas bottom-left',repeatPolicy:'wrap only triangles contained by one repeat cell; multi-cell triangles use source mean colour'};
console.log(JSON.stringify({textureAtlas:atlasStats,barriersByFloor:Object.fromEntries([...barrierMaps].map(([floor,map])=>[floor,map.size])),texturedTriangles:counters.texturedTriangles,repeatAverageTriangles:counters.repeatAverageTriangles}));
for(const g of groups.values())for(const face of g.faces){
 const tile=atlasPositions.get(face.imageKey),coords=face.normalizedUV||[[.5,.5],[.5,.5],[.5,.5]];
 face.detailOffset=g.indices.length;
 for(let i=0;i<3;i++){
  const source=coords[i],uv=[(tile.left+source[0]*tile.size)/atlasSize,1-(tile.top+source[1]*tile.size)/atlasSize].map(v=>Math.round(v*1e6)/1e6),point=face.points[i],key=point.join(',')+'|'+uv.join(',');
  let n=g.vertices.get(key);if(n===undefined){n=g.positions.length/3;g.vertices.set(key,n);g.positions.push(...point);g.uv.push(...uv);}g.indices.push(n);
 }
}
const chunks=[],metadata=[];let byteOffset=0;
for(const g of groups.values()){
 if(!g.indices.length)continue;
 const positions=Buffer.alloc(g.positions.length*4),uv=Buffer.alloc(g.uv.length*4),indices=Buffer.alloc(g.indices.length*4);
 g.positions.forEach((v,i)=>positions.writeFloatLE(v,i*4));g.uv.forEach((v,i)=>uv.writeFloatLE(v,i*4));g.indices.forEach((v,i)=>indices.writeUInt32LE(v,i*4));
 const entry={name:g.name,floor:g.floor,kind:g.kind,roofContext:g.roofContext,material:{...g.material,color:'#ffffff'},positions:{byteOffset,count:g.positions.length},uv:{byteOffset:byteOffset+positions.length,count:g.uv.length},indices:{byteOffset:byteOffset+positions.length+uv.length,count:g.indices.length},vertexCount:g.positions.length/3,triangleCount:g.indices.length/3,models:[...g.models].sort()};
 chunks.push(positions,uv,indices);byteOffset+=positions.length+uv.length+indices.length;metadata.push(entry);
}
const binary=Buffer.concat(chunks),barriersByFloor=Object.fromEntries([...barrierMaps].map(([floor,map])=>[floor,[...map.values()]])),barriers=[],version=crypto.createHash('sha256').update(binary).update(atlasBytes).update(JSON.stringify({metadata,barriers,barriersByFloor})).digest('hex').slice(0,12);
if(binary.length>8_000_000||counters.visibleTriangles>180_000||metadata.length>20)throw Error(`Architecture budget exceeded: ${binary.length} bytes / ${counters.visibleTriangles} triangles / ${metadata.length} draw calls`);
if(!metadata.some(g=>g.kind==='columns')||!metadata.some(g=>g.kind==='roof')||!metadata.some(g=>g.kind==='floors'))throw Error('Incomplete observed architectural shell');
// A page contains only triangles that used a real source image. It reuses the
// base position buffer, while its atlas rectangle permits exact UV inversion.
// Repeated faces represented by an average swatch deliberately stay in the base.
const detailMap=new Map();
for(const g of groups.values())for(const face of g.faces){
 if(!face.imageKey.startsWith('image:'))continue;
 let page=detailMap.get(face.imageKey);
 if(!page){const source=textureSources.get(face.imageKey.slice(6));page={source,tile:atlasPositions.get(face.imageKey),bounds:[Infinity,Infinity,-Infinity,-Infinity],parts:new Map()};detailMap.set(face.imageKey,page);}
 let part=page.parts.get(g.name);if(!part){part={group:g.name,ranges:[]};page.parts.set(g.name,part);}
 const previous=part.ranges.at(-1);if(previous&&previous[0]+previous[1]===face.detailOffset)previous[1]+=3;else part.ranges.push([face.detailOffset,3]);
 for(const [x,,z] of face.points){page.bounds[0]=Math.min(page.bounds[0],x);page.bounds[1]=Math.min(page.bounds[1],z);page.bounds[2]=Math.max(page.bounds[2],x);page.bounds[3]=Math.max(page.bounds[3],z);}
}
const out='public/data/commons',detailDirectory=out+'/detail';fs.mkdirSync(detailDirectory,{recursive:true});
const previousManifest=fs.existsSync(out+'/architecture.json')?JSON.parse(fs.readFileSync(out+'/architecture.json','utf8')):null,detailPages=[];
for(const [key,page] of [...detailMap].sort(([a],[b])=>a.localeCompare(b))){
 let image=sharp(page.source.file).removeAlpha().resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true});if(page.source.tint.some(v=>Math.abs(v-1)>1e-6))image=image.linear(page.source.tint,[0,0,0]);
 const {data,info}=await image.webp({quality:85,effort:5}).toBuffer({resolveWithObject:true}),id=crypto.createHash('sha256').update(key).update(data).digest('hex').slice(0,24),url='/data/commons/detail/'+id+'.webp';fs.writeFileSync('public'+url,data);
 detailPages.push({id,url,bounds:page.bounds,tile:{left:page.tile.left,top:page.tile.top,size:page.tile.size},width:info.width,height:info.height,bytes:data.length,parts:[...page.parts.values()]});
}
const detailStats={pages:detailPages.length,bytes:detailPages.reduce((sum,page)=>sum+page.bytes,0),triangles:detailPages.reduce((sum,page)=>sum+page.parts.reduce((n,part)=>n+part.ranges.reduce((count,[,length])=>count+length/3,0),0),0),maxDimension:1024,quality:85},detailVersion=crypto.createHash('sha256').update(JSON.stringify(detailPages)).digest('hex').slice(0,12);
if(detailStats.bytes>10_000_000)console.warn('Near-detail pages exceed the 10 MB transfer target: '+detailStats.bytes);
const manifest={schema:2,version,hallVersion:hall.version,url:'/data/commons/architecture.bin',texture:'/data/commons/architecture-atlas.webp',atlas:atlasStats,barriers,barriersByFloor,barrierHeights,detailPages,detailVersion,detailStats,attribution:'공간정보 오픈플랫폼 VWorld · 서울역KTX 실내지도 관측 캐시(2026-08-31)',origin:hall.origin,bounds,groups:metadata,totals:{...counters,vertices:metadata.reduce((s,g)=>s+g.vertexCount,0),binaryBytes:binary.length,drawCalls:metadata.length,barrierSegments:0,totalBarrierSegments:[...barrierMaps.values()].reduce((sum,map)=>sum+map.size,0),barrierSegmentsByFloor:Object.fromEntries([...barrierMaps].map(([floor,map])=>[floor,map.size])),trianglesByFloor:Object.fromEntries([...new Set(metadata.map(g=>g.floor))].map(floor=>[floor,metadata.filter(g=>g.floor===floor).reduce((sum,g)=>sum+g.triangleCount,0)]))},source:{lod:'B_1',snapshotDate:'2026-08-31',tiles:sources,retirementFiles},models:[...modelSummary.values()].sort((a,b)=>a.model.localeCompare(b.model)),basis:'실제 관측된 원본 구조와 원본 텍스처를 전체 2·3층 보행공간 외곽 20m까지 경량 재가공. 승인 숨김·철거·부분 제거를 적용. 1mm 정점 병합, 공통 2048px 아틀라스의 96/256px 원본 이미지, 근거리 원본비율 유지 최대1024px 이미지, 각 층 보행면 중앙높이+1m 원본 구조 교차선의 충돌 경계 사용. 반복 UV가 여러 타일을 가로지르면 원본 평균색으로 대체해 파사드 왜곡을 방지. 현재 공사 상태·재질 광택은 현장 실측 보증 아님. 최신 승인 파사드는 별도 hall 레이어를 우선 사용.'};
fs.writeFileSync(out+'/architecture-atlas.webp',atlasBytes);fs.writeFileSync(out+'/architecture.bin',binary);fs.writeFileSync(out+'/architecture.json',JSON.stringify(manifest));
const retainedDetails=new Set(detailPages.map(page=>page.url));for(const page of previousManifest?.detailPages||[])if(/^\/data\/commons\/detail\/[a-f0-9]{24}\.webp$/.test(page.url)&&!retainedDetails.has(page.url))fs.rmSync('public'+page.url,{force:true});
console.log(JSON.stringify({version,detailVersion,detailStats,hallVersion:hall.version,groups:metadata.map(g=>({name:g.name,vertices:g.vertexCount,triangles:g.triangleCount,models:g.models.length})),...manifest.totals,jsonBytes:fs.statSync(out+'/architecture.json').size}));

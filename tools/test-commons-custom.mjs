// Audit the reviewed currentisation source inventory against the lightweight
// export. In particular, an approved photo alone is not proof that a new
// fixture's enclosure, supports, raised sign and walk barrier were included.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import * as T from 'three';
import {createCustomWorld} from '../src/commons-custom.js';
import {TRAIN_MATES,TRAIN_MATES_SURFACES,buildTrainMates} from '../app/seoul-train-mates.js';
import {INFORMATION_FACILITIES,createSeoulInformationZone} from '../app/seoul-information-zone.js';
import {S11_SHOPS,createS11Booths} from '../app/seoul-s11-booths.js';
import {TRUEDAN,TRUEDAN_FACADE} from '../app/seoul-truedan.js';
import {INFORMATION_CENTER,INFORMATION_CENTER_SURFACES,createInformationCenter} from '../app/seoul-information-center.js';
import {PHOTOBOOTH,createPhotobooth} from '../app/seoul-photobooth.js';
import {OPENING_GUARDRAIL,openingGuardrailPlan,createOpeningGuardrail} from '../app/seoul-opening-guardrail.js';

const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),
 custom=read('public/data/commons/custom.json'),hall=read('public/data/commons/hall.json'),catalog=read('public/data/experience/catalog.json'),
 assets=new Map(custom.assets.map(a=>[a.id,a])),photos=new Map(custom.photos.map(p=>[p.id,p]));
assert.equal(custom.hallVersion,hall.version,'Rebuild custom export after hall changes');
assert.deepEqual(custom.origin,hall.origin,'All room layers must share one rigid origin');
const expectedAssets=[TRAIN_MATES.id,...INFORMATION_FACILITIES.map(a=>a.id),...S11_SHOPS.map(a=>a.id),TRUEDAN.id,INFORMATION_CENTER.id,PHOTOBOOTH.id,OPENING_GUARDRAIL.id];
assert.deepEqual([...assets.keys()].sort(),expectedAssets.sort(),'Every original app fixture, and no unapproved draft, is present');
assert.equal(assets.size,12);
const expectedPhotos=[TRAIN_MATES_SURFACES[0].alias+':body',TRAIN_MATES_SURFACES[0].alias+':sign',TRAIN_MATES_SURFACES[1].alias,TRAIN_MATES_SURFACES[2].alias,...INFORMATION_FACILITIES.map(a=>a.slotAlias),...S11_SHOPS.map(a=>a.alias),...INFORMATION_CENTER_SURFACES.map(s=>s.alias+':body'),INFORMATION_CENTER_SURFACES[1].alias+':sign',PHOTOBOOTH.surface.alias];
assert.deepEqual([...photos.keys()].sort(),expectedPhotos.sort(),'Every reviewed body/side/raised-sign photograph is represented');
assert.equal(photos.size,17);
assert(hall.facades.some(p=>p.alias===TRUEDAN_FACADE.slotAlias),'Full approved TRUEDAN front is kept by hall');
const frame=hall.facades.find(p=>p.alias==='F02WL072-FRAME-S01');
assert.equal(frame?.positions.length,6*4*3,'Six original frame face overlays, not an invented extra box');
assert.equal(frame?.indices.length,6*2*3);
assert.equal(hall.facades.find(p=>p.alias==='ZIMCARRY-FRONT-S01')?.indices.length,6);
assert.equal(hall.facades.find(p=>p.alias==='ZIMCARRY-BODY-S01')?.indices.length,4*6);
assert(!assets.has('F02WL072-FRAME-S01')&&!assets.has('ZIMCARRY-SEOUL-2F'),'Already exported currentisation must not be duplicated');
assert(custom.sourceCoverage.some(c=>c.id==='toolkit-approved-additions'&&c.handledBy==='no-public-approved-records-observed'));

let triangleCount=0;
const meshTriangles=new Map();
for(const group of custom.groups){
 assert.equal(group.positions.length%3,0);assert.equal(group.indices.length%3,0);
 assert(group.positions.every(Number.isFinite));assert(group.indices.every(i=>Number.isInteger(i)&&i>=0&&i<group.positions.length/3));
 if(group.kind==='photo'){assert.equal(group.uv.length,group.positions.length/3*2);assert(group.uv.every(v=>v>=0&&v<=1));}
 let end=0;
 for(const range of group.pickRanges){assert.equal(range.start,end,'Picking ranges cover every triangle without overlap');assert(range.count>0&&assets.has(range.assetId));end+=range.count;meshTriangles.set(range.assetId,(meshTriangles.get(range.assetId)||0)+range.count);}
 assert.equal(end,group.indices.length/3);triangleCount+=end;
}
assert.equal(triangleCount,custom.totals.triangles);assert(triangleCount<10_000);
for(const asset of assets.values()){
 assert(meshTriangles.get(asset.id)>0,asset.id+' has visible source geometry');
 assert(['2F','3F'].includes(asset.floor));assert(asset.position.every(Number.isFinite));
 const exact=catalog.facilities.find(f=>asset.aliases.includes(f.source_id)||f.reference?.focus?.targetAssetId===asset.id);
 assert.equal(asset.facilityId,exact?.id||null,'Only exact registered IDs are matched');
 const hallFacility=hall.facilities.find(f=>f.id===asset.facilityId);
 if(hallFacility){assert.deepEqual(asset.access,hallFacility.access);assert.equal(asset.accessNode,hallFacility.accessNode);}
 if(asset.access){assert(asset.access.every(v=>Number.isFinite(v)&&Math.abs(v)<250),'Access coordinates are room-local metres');assert.equal(hall.walk.floors[asset.accessNode],asset.floor);assert.deepEqual(asset.access,hall.walk.points[asset.accessNode]);assert.equal(asset.accessPointId,hall.walk.pointIds[asset.accessNode]);assert.deepEqual(asset.reference.accessWgs84,exact.access);}
 else assert.equal(asset.accessNode,null,'An absent walking entrance must not be guessed');
}
assert.equal(custom.assets.filter(a=>a.facilityId).length,7);
assert.equal(custom.assets.filter(a=>a.access).length,6);
// TRAIN MATES is authored in its own ENU origin. This registered facade-centre
// comparison catches the old ~100m displacement without duplicating its transform.
const train=assets.get(TRAIN_MATES.id),trainHall=hall.facilities.find(f=>f.id===train.facilityId),trainBody=photos.get(TRAIN_MATES_SURFACES[0].alias+':body');
const centre=[0,1,2].map(axis=>[0,1,2,3].reduce((sum,i)=>sum+trainBody.positions[i*3+axis],0)/4);
assert(Math.hypot(centre[0]-trainHall.point[0],centre[2]-trainHall.point[2])<.01,'TRAIN MATES source origin correctly converted');

const uniqueImages=new Map();
for(const p of photos.values()){
 assert(assets.has(p.assetId));assert.equal(p.floor,assets.get(p.assetId).floor);assert.equal(p.positions.length,12);assert.deepEqual(p.indices,[0,1,2,0,2,3]);assert.deepEqual(p.detailUV,[0,0,1,0,1,1,0,1]);
 const [x,y,w,h]=p.sourceCrop;assert(x>=0&&y>=0&&w>0&&h>0&&x+w<1.00001&&y+h<1.00001);
 assert(fs.existsSync('public'+p.sourceImage));assert(p.detailImage.url.startsWith('/data/commons/custom-images/'));uniqueImages.set(p.detailImage.url,p.detailImage);
}
for(const [url,metadata] of uniqueImages){const bytes=fs.readFileSync('public'+url),actual=await sharp(bytes).metadata();assert.equal(actual.width,metadata.width);assert.equal(actual.height,metadata.height);assert.equal(bytes.length,metadata.bytes);assert(actual.width<=1536&&actual.height<=1024);}
assert.equal(uniqueImages.size,14);const atlas=await sharp('public'+custom.atlas).metadata();assert.equal(atlas.width,2048);assert.equal(atlas.height,2048);
assert.equal(custom.totals.atlasBytes,fs.statSync('public'+custom.atlas).size);
assert.equal(custom.totals.detailBytes,[...uniqueImages.values()].reduce((sum,p)=>sum+p.bytes,0));
for(const [floor,segments] of Object.entries(custom.barriersByFloor)){assert(segments.length>0);assert(segments.every(s=>s.length===4&&s.every(Number.isFinite)));assert.equal(segments.length,custom.totals.barrierSegments[floor]);}
const inside=(x,z,polygon)=>{let result=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;};
const occupied=(point,floor)=>custom.footprintsByFloor[floor].some(polygon=>inside(point[0],point[2],polygon));
for(const [floor,polygons] of Object.entries(custom.footprintsByFloor)){assert(polygons.length>0);assert(polygons.every(p=>p.length===4&&p.every(v=>v.length===2&&v.every(Number.isFinite))));assert.equal(polygons.length,custom.totals.footprintPolygons[floor]);}
for(const id of [INFORMATION_CENTER.id,PHOTOBOOTH.id,...S11_SHOPS.map(a=>a.id),INFORMATION_FACILITIES[0].id]){const a=assets.get(id);assert(occupied(a.position,a.floor),id+' closed source enclosure excludes its interior GRID nodes');}
assert(!occupied(train.position,'2F'),'TRAIN MATES open interior is not filled by a guessed footprint');
const west=photos.get(TRAIN_MATES_SURFACES[2].alias),doorPoint=[0,1,2].map(axis=>west.positions[axis]+(west.positions[3+axis]-west.positions[axis])*1231/1681);
assert(!occupied(doorPoint,'2F'),'TRAIN MATES actual west doorway stays open');
assert(!occupied(assets.get(INFORMATION_FACILITIES.find(a=>a.type==='train_departure_display').id).position,'2F'),'Elevated TIDS body does not become a ground-level obstacle');
const guardrailTriangles=meshTriangles.get(OPENING_GUARDRAIL.id),plan=openingGuardrailPlan();
assert.equal(guardrailTriangles,(plan.spans.length*3+plan.posts.length)*12,'All original narrow glass spans, rails and posts are retained');

// Execute the original app constructors, capturing their Cesium inputs rather
// than rebuilding an expected fixture from Commons' own exported arrays.
// The mock implements coordinate arithmetic, not a second station renderer.
function sourceReplay(){
 const e2=6.69437999014e-3,rad=Math.PI/180;
 function fromDegrees(lon,lat,h){lon*=rad;lat*=rad;const s=Math.sin(lat),c=Math.cos(lat),n=6378137/Math.sqrt(1-e2*s*s);return new V3((n+h)*c*Math.cos(lon),(n+h)*c*Math.sin(lon),(n*(1-e2)+h)*s);}
 function cartographic(p){const longitude=Math.atan2(p.y,p.x),r=Math.hypot(p.x,p.y);let latitude=Math.atan2(p.z,r*(1-e2)),height=0;for(let i=0;i<10;i++){const n=6378137/Math.sqrt(1-e2*Math.sin(latitude)**2);height=r/Math.cos(latitude)-n;latitude=Math.atan2(p.z,r*(1-e2*n/(n+height)));}return {longitude,latitude,height};}
 function enu(p){const {longitude:a,latitude:b}=cartographic(p);return new T.Matrix4().makeBasis(new T.Vector3(-Math.sin(a),Math.cos(a),0),new T.Vector3(-Math.sin(b)*Math.cos(a),-Math.sin(b)*Math.sin(a),Math.cos(b)),new T.Vector3(Math.cos(b)*Math.cos(a),Math.cos(b)*Math.sin(a),Math.sin(b))).setPosition(p);}
 class V3 extends T.Vector3 {static fromDegrees(...p){return fromDegrees(...p);}static subtract(a,b,out){return out.subVectors(a,b);}static cross(a,b,out){return out.crossVectors(a,b);}static normalize(a,out){return out.copy(a).normalize();}}
 class M4 extends T.Matrix4 {static multiply(a,b,out){return out.multiplyMatrices(a,b);}static multiplyByPoint(m,p,out){return out.copy(p).applyMatrix4(m);}static getMatrix3(m,out){return out.setFromMatrix4(m);}static fromRotationTranslation(m,p=new V3()){return new M4().setFromMatrix3(m).setPosition(p);}}
 class M3 extends T.Matrix3 {static fromRotationZ(a){return new M3().set(Math.cos(a),-Math.sin(a),0,Math.sin(a),Math.cos(a),0,0,0,1);}}
 class Q extends T.Quaternion {static fromRotationMatrix(m){return new Q().setFromRotationMatrix(new T.Matrix4().setFromMatrix3(m));}}
 class Record {constructor(properties={}){Object.assign(this,properties);}}
 class Collection {constructor(){this.values=[];}add(value){this.values.push(value);return value;}remove(){return true;}}
 class DataSource {constructor(name){this.name=name;this.entities=new Collection();}}
 class Material {constructor({fabric}){Object.assign(this,fabric);}}
 class Appearance extends Record {static MaterialSupport={TEXTURED:{vertexFormat:'textured'}};}
 class Hierarchy {constructor(positions){this.positions=positions;}}
 const color=css=>({css,withAlpha(alpha){return {...this,alpha};}}),primitives=new Collection(),sources=new Collection();
 const C={Cartesian3:V3,Cartesian2:T.Vector2,Matrix4:M4,Matrix3:M3,Quaternion:Q,Cartographic:{fromCartesian:cartographic},Math:{toRadians:n=>n*rad},Transforms:{eastNorthUpToFixedFrame:enu,headingPitchRollQuaternion(p,hpr){return new Q().setFromRotationMatrix(enu(p)).multiply(new Q().setFromAxisAngle(new V3(0,0,1),-hpr.heading));}},HeadingPitchRoll:class {constructor(heading,pitch,roll){Object.assign(this,{heading,pitch,roll});}},Color:{fromCssColorString:color,WHITE:color('#ffffff')},CustomDataSource:DataSource,PrimitiveCollection:Collection,Material,MaterialAppearance:Appearance,PolygonHierarchy:Hierarchy,CoplanarPolygonGeometry:Record,Geometry:Record,GeometryAttribute:Record,GeometryInstance:Record,Primitive:Record,Entity:Record,ImageMaterialProperty:Record,DistanceDisplayCondition:class {},BoundingSphere:{fromPoints:()=>({})},ComponentDatatype:{DOUBLE:'double',FLOAT:'float'},PrimitiveType:{TRIANGLES:'triangles'},ShadowMode:{ENABLED:1,DISABLED:0}};
 const viewer={dataSources:sources,scene:{primitives,requestRender(){}}},anchor=fromDegrees(hall.origin.lon,hall.origin.lat,hall.origin.height),inverse=enu(anchor).invert(),toRoom=p=>{const q=p.clone().applyMatrix4(inverse);return [q.x-hall.origin.east0,q.z-hall.origin.up0,hall.origin.north0-q.y];};
 return {C,viewer,toRoom,fromDegrees,enu,sources,primitives,DataSource};
}
const replay=sourceReplay(),sourceControllers=[];
const trainFrame=replay.enu(replay.fromDegrees(...TRAIN_MATES.origin)),sourceTrain=new replay.DataSource('train');replay.sources.add(sourceTrain);
sourceControllers.push(buildTrainMates(replay.C,replay.viewer,sourceTrain,TRAIN_MATES,(_C,...p)=>new T.Vector3(...p).applyMatrix4(trainFrame)));
sourceControllers.push(await createSeoulInformationZone(replay.C,replay.viewer,{},'S202103',{maskManagedExternally:true}));
sourceControllers.push(await createS11Booths(replay.C,replay.viewer,'S202103'));
sourceControllers.push(await createInformationCenter(replay.C,replay.viewer,'S202103'));
sourceControllers.push(await createPhotobooth(replay.C,replay.viewer,'S202103'));
sourceControllers.push(await createOpeningGuardrail(replay.C,replay.viewer,'S202103'));
const approved=read('public/data/jury-frozen/approved-facades.json').replacements.filter(r=>r.is_active&&r.review_status==='approved'),customApproved=approved.filter(r=>custom.assets.some(a=>a.aliases.includes(r.slot?.slot_alias)));
// At this frozen revision, only TRUEDAN has an uploaded override, already in
// hall.facades. All seventeen other planes really use the app's default PNGs.
assert.deepEqual(customApproved.map(r=>r.slot.slot_alias),[TRUEDAN_FACADE.slotAlias],'New approved custom photos require replaying their original replacement contract');
for(const controller of sourceControllers)controller.setReplacements?.(approved);
const recordedPhotos=[],recordedBoxes=[];
for(const source of replay.sources.values)for(const entity of source.entities.values){
 if(entity.box)recordedBoxes.push(entity);
 if(entity.wall){const wall=entity.wall,left=wall.positions[0],right=wall.positions[1],up=new T.Vector3().setFromMatrixColumn(replay.enu(left),2),h=wall.maximumHeights[0]-wall.minimumHeights[0];recordedPhotos.push({entity,engineKind:'wall',wall,points:[left,right,right.clone().addScaledVector(up,h),left.clone().addScaledVector(up,h)],uv:[0,0,1,0,1,1,0,1],image:wall.material.image,crop:[0,0,1,1]});}
}
for(const collection of replay.primitives.values)for(const primitive of collection.values){
 const {geometry,id:entity}=primitive.geometryInstances,uniforms=primitive.appearance.material.uniforms;
 const points=geometry.polygonHierarchy?.positions||Array.from({length:geometry.attributes.position.values.length/3},(_,i)=>new T.Vector3(...geometry.attributes.position.values.slice(i*3,i*3+3))),coordinates=geometry.textureCoordinates?.positions;
 recordedPhotos.push({entity,engineKind:coordinates?'coplanar':'direct',shader:primitive.appearance.material.type,shaderSource:primitive.appearance.material.source,uniforms,points,uv:coordinates?coordinates.flatMap(p=>[p.x,p.y]):Array.from(geometry.attributes.st.values),image:uniforms.image,crop:uniforms.cropMin?[uniforms.cropMin.x,uniforms.cropMin.y,uniforms.cropSpan.x,uniforms.cropSpan.y]:[0,0,1,1]});
}
const closeArrays=(actual,expected,epsilon,message)=>{assert.equal(actual.length,expected.length,message);assert(actual.every((v,i)=>Math.abs(v-expected[i])<=epsilon),message+' (maximum error '+Math.max(...actual.map((v,i)=>Math.abs(v-expected[i])))+')');};
const replayedPhotos=new Set();
for(const source of recordedPhotos){
 const alias=source.entity.properties.replacementSlot,candidates=custom.photos.filter(p=>p.sourceAlias===alias),part=source.entity.id.includes('sign')?'sign':'body',photo=candidates.length===1?candidates[0]:candidates.find(p=>p.id.endsWith(':'+part));
 assert(photo,'Original app photo must have a Commons plane: '+alias);source.photo=photo;replayedPhotos.add(photo.id);
 closeArrays(photo.positions,source.points.flatMap(replay.toRoom),.002,'Original constructor vertices '+photo.id);closeArrays(photo.detailUV,source.uv,1e-7,'Original constructor input UV '+photo.id);assert.equal(photo.sourceImage,source.image,'Original app photograph '+photo.id);
}
assert.equal(replayedPhotos.size,17);
// Optional official-engine regression: COMMONS_CESIUM_ENGINE points to the
// unmodified browser bundle used by the original app. Remap generated ST by
// physical ECEF position; passing input UV through unchanged misses Cesium's
// coplanar winding reversal (notably TRAIN MATES' east face).
let cesiumEngine={status:'not-run',reason:'Set COMMONS_CESIUM_ENGINE to the official Cesium 1.142 bundle'};
if(process.env.COMMONS_CESIUM_ENGINE){
 const context={console,setTimeout,clearTimeout,URL,Blob,atob,btoa,performance,TextDecoder,TextEncoder,TransformStream,ReadableStream,WritableStream,AbortController,AbortSignal};context.global=context;vm.createContext(context);vm.runInContext(fs.readFileSync(process.env.COMMONS_CESIUM_ENGINE,'utf8'),context,{timeout:5000});const C=context.Cesium;assert.equal(C.VERSION,'1.142.0');
 // Instantiate the official Texture with a call-recording GL adapter: use its
 // actual default, rather than assuming the upload convention from a comment.
 const glConstants=new Map(),gl=new Proxy({},{get(_target,key){if(typeof key!=='string')return undefined;if(key.toUpperCase()===key){if(!glConstants.has(key))glConstants.set(key,glConstants.size+100);return glConstants.get(key);}return ()=>({});}}),engineTexture=new C.Texture({context:{_gl:gl},width:1,height:1});assert.equal(engineTexture.flipY,true);engineTexture.destroy();assert.equal(new T.Texture().flipY,true);
 const rows=[],mismatches=[];
 for(const source of recordedPhotos){
  const points=source.points.map(p=>new C.Cartesian3(p.x,p.y,p.z));let geometry;
  if(source.engineKind==='coplanar')geometry=C.CoplanarPolygonGeometry.createGeometry(new C.CoplanarPolygonGeometry({polygonHierarchy:new C.PolygonHierarchy(points),textureCoordinates:new C.PolygonHierarchy(Array.from({length:source.uv.length/2},(_,i)=>new C.Cartesian2(...source.uv.slice(i*2,i*2+2)))),vertexFormat:C.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat}));
  else if(source.engineKind==='wall')geometry=C.WallGeometry.createGeometry(new C.WallGeometry({positions:source.wall.positions.map(p=>new C.Cartesian3(p.x,p.y,p.z)),minimumHeights:source.wall.minimumHeights,maximumHeights:source.wall.maximumHeights,vertexFormat:C.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat}));
  else geometry=new C.Geometry({attributes:{position:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.DOUBLE,componentsPerAttribute:3,values:new Float64Array(source.points.flatMap(p=>[p.x,p.y,p.z]))}),st:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.FLOAT,componentsPerAttribute:2,values:new Float32Array(source.uv)})},indices:new Uint16Array([0,1,2,0,2,3]),primitiveType:C.PrimitiveType.TRIANGLES});
  const positions=geometry.attributes.position.values,st=geometry.attributes.st.values,corners=new Map(),order=[];
  for(let i=0;i<positions.length/3;i++){
   const p=new C.Cartesian3(...positions.slice(i*3,i*3+3));let corner=-1,distance=Infinity;for(let j=0;j<points.length;j++){const d=C.Cartesian3.distance(p,points[j]);if(d<distance){distance=d;corner=j;}}
   if(distance>.002)continue;order.push(corner);const s=st[i*2],t=st[i*2+1],[x,y,w,h]=source.crop;
   // Cesium Texture defaults flipY=true. These are top-left source-image
   // fractions after the actual source shader's crop/flip operations.
   const shader=(source.shaderSource||'').replace(/\s/g,'');let pixel;
   if(source.shader==='TrainMatesPhoto'||source.shader==='InformationCenterPhoto'){assert(shader.includes('1.0-cropMin.y-(1.0-'),'Known original cropped shader contract');pixel=[x+s*w,y+(source.uniforms.flipV?t:1-t)*h];}
   else if(source.shader==='S11Facade'){assert(shader.includes('photoUv=vec2(materialInput.st.x,1.0-materialInput.st.y)')&&shader.includes('cropMin+photoUv*cropSpan'),'Known original S11 shader contract');pixel=[x+s*w,1-y-(1-t)*h];}
   else{assert(source.engineKind==='wall'||shader.includes('texture(image,materialInput.st)'),'Known original full-image shader contract');pixel=[s,1-t];}
   if(corners.has(corner))closeArrays(pixel,corners.get(corner),1e-6,'Repeated wall corner has consistent pixels');else corners.set(corner,pixel);
  }
  assert.equal(corners.size,4,'Official engine retains all four physical photo corners');
  const photo=source.photo,commonsPixels=Array.from({length:4},(_,i)=>[photo.sourceCrop[0]+photo.detailUV[i*2]*photo.sourceCrop[2],photo.sourceCrop[1]+(1-photo.detailUV[i*2+1])*photo.sourceCrop[3]]),enginePixels=Array.from({length:4},(_,i)=>corners.get(i)),error=Math.max(...enginePixels.flatMap((p,i)=>p.map((v,k)=>Math.abs(v-commonsPixels[i][k]))));
  const row={id:photo.id,kind:source.engineKind,outputCornerOrder:order,flipV:source.uniforms?.flipV||0,enginePixels,commonsPixels,maxError:error};rows.push(row);if(error>1e-6)mismatches.push(row);
 }
 cesiumEngine={status:mismatches.length?'mismatch':'passed',version:C.VERSION,photos:rows.length,trainSides:rows.filter(r=>r.id==='TRAIN-MATES-RIGHT-S01'||r.id==='TRAIN-MATES-LEFT-S01'),mismatches};
 console.log(JSON.stringify({cesiumEngine}));
 assert.equal(mismatches.length,0,'Physical corner pixels must match the original Cesium geometry plus shader, not raw input ST');
}
// A current source filename alone does not prove that its deployed derivative
// was rebuilt after a photo change. Reproduce each original-validated crop and
// compare its actual WebP payload, catching stale or swapped derivative files.
let sourcePhotoPayloads=0;
for(const [url] of uniqueImages){
 const photo=custom.photos.find(p=>p.detailImage.url===url),image=sharp('public'+photo.sourceImage),meta=await image.metadata(),[x,y,w,h]=photo.sourceCrop;
 const region={left:Math.round(x*meta.width),top:Math.round(y*meta.height),width:Math.max(1,Math.round(w*meta.width)),height:Math.max(1,Math.round(h*meta.height))};region.width=Math.min(region.width,meta.width-region.left);region.height=Math.min(region.height,meta.height-region.top);
 const expected=await image.extract(region).resize(1536,1024,{fit:'inside',withoutEnlargement:true}).webp({quality:88,effort:6}).toBuffer();
 assert(expected.equals(fs.readFileSync('public'+url)),'Current source PNG and approved crop reproduce photo payload '+photo.id);sourcePhotoPayloads++;
}
const verticesByAsset=new Map(custom.assets.map(asset=>[asset.id,[]]));
for(const group of custom.groups.filter(g=>g.kind!=='photo'))for(const range of group.pickRanges)for(const i of new Set(group.indices.slice(range.start*3,(range.start+range.count)*3)))verticesByAsset.get(range.assetId).push(group.positions.slice(i*3,i*3+3));
for(const box of recordedBoxes){
 const id=box.properties.facilityAssetId||box.properties.assetId||box.properties.targetAssetId,vertices=verticesByAsset.get(id);assert(vertices?.length,'Original source box is rendered: '+id);
 for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5]){const d=box.box.dimensions,p=new T.Vector3(d.x*x,d.y*y,d.z*z).applyQuaternion(box.orientation).add(box.position),expected=replay.toRoom(p);assert(vertices.some(v=>Math.hypot(...v.map((n,i)=>n-expected[i]))<.003),'Original box corner in rendered body: '+box.id);}
}

// Exercise the real Three world factory. Only image transport is mocked; mesh
// creation, material state, bounding volumes, floor visibility and raycasting
// all execute the exact production renderer module with the exported data.
const originalLoad=T.TextureLoader.prototype.loadAsync,atlasTexture=new T.Texture();let textureLoads=0,atlasDisposals=0,world;
atlasTexture.addEventListener('dispose',()=>atlasDisposals++);T.TextureLoader.prototype.loadAsync=async function(url){assert.equal(url,custom.atlas+'?v='+custom.version);textureLoads++;return atlasTexture;};
try{
 const scene=new T.Scene();world=await createCustomWorld({scene,custom});assert.equal(world.meshes.length,custom.groups.length);assert.equal(textureLoads,1);assert.equal(scene.children.length,custom.groups.length);
 for(let i=0;i<custom.groups.length;i++){const source=custom.groups[i],mesh=world.meshes[i];assert(mesh.visible&&mesh.parent===scene);assert.equal(mesh.geometry.drawRange.start,0);assert.equal(mesh.geometry.drawRange.count,Infinity);assert(mesh.geometry.boundingSphere.radius>0);closeArrays([...mesh.geometry.attributes.position.array],source.positions,1e-5,'GPU float positions '+source.name);assert.deepEqual([...mesh.geometry.index.array],source.indices);assert.equal(mesh.material.side,T.DoubleSide);assert(mesh.material.visible&&mesh.material.opacity>0&&mesh.material.depthTest);if(source.kind==='photo'){assert(mesh.material.isMeshBasicMaterial);assert.equal(mesh.material.map,atlasTexture);closeArrays([...mesh.geometry.attributes.uv.array],source.uv,1e-7,'GPU photo UV '+source.name);}else assert(mesh.material.isMeshStandardMaterial);}
 const rayAt=(points,index=[0,1,2])=>{const [a,b,c]=index.map(i=>new T.Vector3(...points.slice(i*3,i*3+3))),normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize(),centre=a.clone().add(b).add(c).multiplyScalar(1/3);return new T.Raycaster(centre.addScaledVector(normal,.001),normal.negate(),0,.002);};
 for(const photo of custom.photos)assert.equal(world.pick(rayAt(photo.positions))?.assetId,photo.assetId,'Real world photo is selectable '+photo.id);
 for(const asset of custom.assets){const group=custom.groups.find(g=>g.kind!=='photo'&&g.pickRanges.some(r=>r.assetId===asset.id)),range=group.pickRanges.find(r=>r.assetId===asset.id);assert.equal(world.pick(rayAt(group.positions,group.indices.slice(range.start*3,range.start*3+3)))?.assetId,asset.id,'Real world body is selectable '+asset.id);}
 for(const floor of ['2F','3F']){world.setVisibility(floor,true);assert(world.meshes.every(m=>m.visible===(m.userData.customFloor===floor)));for(const p of custom.photos.filter(p=>p.floor!==floor))assert.equal(world.pick(rayAt(p.positions)),null,'Hidden floor must not intercept a pick');}
 world.setVisibility('2F',false);assert(world.meshes.every(m=>m.visible),'Walking mode renders both physical floors');
 let geometryDisposals=0,materialDisposals=0;const materials=new Set(world.meshes.map(m=>m.material));for(const mesh of world.meshes)mesh.geometry.addEventListener('dispose',()=>geometryDisposals++);for(const material of materials)material.addEventListener('dispose',()=>materialDisposals++);world.dispose();world.dispose();assert.equal(scene.children.length,0);assert.equal(geometryDisposals,custom.groups.length);assert.equal(materialDisposals,materials.size);assert.equal(atlasDisposals,1);assert.equal(world.pick(new T.Raycaster()),null);
}finally{world?.dispose();T.TextureLoader.prototype.loadAsync=originalLoad;}
console.log(JSON.stringify({ok:true,version:custom.version,hallVersion:hall.version,assets:assets.size,photos:photos.size,sourceConstructorPhotos:replayedPhotos.size,cesiumEngine:{status:cesiumEngine.status,photos:cesiumEngine.photos},sourcePhotoPayloads,sourceConstructorBoxes:recordedBoxes.length,threeWorldMeshes:custom.groups.length,catalogMatches:7,walkingEntrances:6,triangles:triangleCount,atlasBytes:custom.totals.atlasBytes,detailBytes:custom.totals.detailBytes,footprintPolygons:custom.totals.footprintPolygons}));

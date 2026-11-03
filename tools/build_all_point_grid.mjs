// Offline candidate generation. Never enables routing or mutates station assets.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {retirementFiles,retiredWhole,retiredTriangle,visibleFragments,clipPolygon} from './point-retirement.mjs';
import {photoboothPoint,PHOTOBOOTH} from '../app/seoul-photobooth.js';
import {OPENING_GUARDRAIL} from '../app/seoul-opening-guardrail.js';
import {informationZoneCatalogPoint} from '../app/seoul-information-zone.js';
const root=process.argv[2];if(!root)throw Error('Pass source workspace with cached VWorld tiles');
const require=createRequire(path.join(root,'package.json'));
const draco=await require('./tmp/vworld-seoul-full-catalog/vendor/node_modules/draco3dgltf/draco3dgltf.js').createDecoderModule({});
const code=fs.readFileSync(path.join(root,'tools/build_vworld_image_catalog.mjs'),'utf8');
const origin={lon:126.97082,lat:37.55363,height:27.2};
const api=new Function('fs','crypto','draco','SITE_ORIGIN','imageId','featureKey',code.slice(code.indexOf('const sha256 ='),code.indexOf('async function imagePreview'))+';return {parseB3dm,meshTransforms,identityMatrix,decodeDracoPrimitive,readAccessor,transformPoint,ecefToEnu,ecefToGeodetic,geodeticToEcef};')(fs,crypto,draco,origin,()=>'',()=> '');
const spacing=2,clearance=.35,byFloor=Object.fromEntries(['B7','B6','B3','B2','B1','1F','2F','3F','4F','RF'].map(f=>[f,{surfaces:[],obstacles:[],models:new Set(),retired:0}]));
const excludedModels={F01FL008:'선로·자갈층 (사진 확인)',B07FL002:'승강장보다 1.72m 아래의 선로·기반 구조층'};
// Audited tread/body models; other MV models contain rails, caps, and moving walkways.
const treadModels=new Set(Object.entries({F01:[1,2,4,5,6,7,10,11],F02:[2,6,7],F03:[3],B07:[1,2,5,6,7],B06:[1,4,5],B03:[1,2,5,8,9],B02:[1,2,4,9,10,11,12,13,14,16,17,19],B01:[1,3,7,10,11,12,15,17,18,20,28,29,30]}).flatMap(([prefix,ids])=>ids.map(n=>`${prefix}MV${String(n).padStart(3,'0')}`)));
const treads=new Map();
const directory=path.join(root,'tmp/vworld-seoul-full-catalog/tiles'),sourceFiles=[],hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const bounds=vs=>[Math.min(...vs.map(v=>v[0])),Math.min(...vs.map(v=>v[1])),Math.max(...vs.map(v=>v[0])),Math.max(...vs.map(v=>v[1]))];
function normalZ(vs){const [a,b,c]=vs,u=b.map((v,i)=>v-a[i]),v=c.map((x,i)=>x-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];return n[2]/Math.hypot(...n);}
function broadTread(vs){const [a,b,c]=vs,area=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));return normalZ(vs)>=.98&&area/Math.max(...vs.map((v,i)=>Math.hypot(v[0]-vs[(i+1)%3][0],v[1]-vs[(i+1)%3][1])))>=.12;}
for(const filename of fs.readdirSync(directory).filter(f=>/^B_1_.*\.bin$/.test(f)).sort()){
 const file=path.join(directory,filename),p=api.parseB3dm(file);if(!p.batchTable.FLOOR?.some(f=>byFloor[f]))continue;
 sourceFiles.push({file:filename,sha256:hash(fs.readFileSync(file))});
 const transforms=api.meshTransforms(p.gltf),rtc=p.featureTable.RTC_CENTER;
 for(const [mi,mesh] of p.gltf.meshes.entries())for(const primitive of mesh.primitives){
  const d=api.decodeDracoPrimitive(p.gltf,p.binary,primitive),positions=d?.positions??api.readAccessor(p.gltf,p.binary,primitive.attributes.POSITION),batches=d?.batchIds??api.readAccessor(p.gltf,p.binary,primitive.attributes._BATCHID),tex=d?.texCoords0??api.readAccessor(p.gltf,p.binary,primitive.attributes.TEXCOORD_0),indices=d?.indices??api.readAccessor(p.gltf,p.binary,primitive.indices)?.flat();
  if(!positions||!indices)continue;
  for(const m of transforms.get(mi)??[api.identityMatrix()]){
   const enu=positions.map(v=>{const q=api.ecefToEnu(api.transformPoint(m,v).map((a,i)=>a+rtc[i]));return [q.east,q.north,q.up];});
   for(let i=0;i<indices.length;i+=3){
    const ix=indices.slice(i,i+3),id=Math.round(batches?.[ix[0]]?.[0]??mi),floor=p.batchTable.FLOOR[id],target=byFloor[floor];if(!target)continue;
    const model=p.batchTable.MODEL_NAME[id],vs=ix.map(j=>enu[j]);
    if(/^([FB]\d{2})FL/.test(model)){
     if(!excludedModels[model]&&normalZ(vs)>.85){target.surfaces.push({vs,model});target.models.add(model);}
     target.obstacles.push({vs,model,minZ:Math.min(...vs.map(v=>v[2])),maxZ:Math.max(...vs.map(v=>v[2]))});
    }
    else{
     if(retiredWhole({FLOOR:floor,MODEL_NAME:model,TD_ID:p.batchTable.TD_ID?.[id]})||retiredTriangle(vs,ix.map(j=>tex?.[j]))){target.retired++;continue;}
     const polys=visibleFragments(vs);if(!polys.length){target.retired++;continue;}
     if(treadModels.has(model)&&broadTread(vs)){if(!treads.has(model))treads.set(model,{floor,rows:[]});treads.get(model).rows.push({vs,model});}
     for(const vs of polys)target.obstacles.push({vs,model,minZ:Math.min(...vs.map(v=>v[2])),maxZ:Math.max(...vs.map(v=>v[2]))});
    }
   }
  }
 }
}
const custom=[
 {id:'SEOUL-2F-INFORMATION-CENTER-01',floor:'2F',vertices:[[-5.69916827,45.69294401],[5.37895916,45.88157068],[5.21146873,55.71835716],[-5.86665870,55.52973049]]},
 {id:'SEOUL-2F-TRUEDAN',floor:'2F',vertices:[[14.15333762,-3.35892470],[20.10582999,-2.60537672],[19.60145521,1.37882484],[13.64896284,.62527686]]},
 {id:'S11-BOOTH-PAIR',floor:'2F',vertices:[[-49.17512461,-2.29537015],[-39.46707611,-3.93115501],[-38.87806944,-.43552087],[-48.58611793,1.20026399]]},
 {id:'TRAIN-MATES-SEOUL-2F',floor:'2F',vertices:[[-66.43337960,57.57765332],[-57.23016933,54.23337689],[-55.65639219,58.56429937],[-64.85960246,61.90857580]]},
 {id:'ZIMCARRY-SEOUL-2F',floor:'2F',vertices:[[-91.5678369444994,7.7944608957286095],[-91.46551029047798,.22015500288433604],[-91.30552488945449,.22231635879081926],[-91.40785154347591,7.7966222516350925]]},
];
const rectangle=(x0,y0,x1,y1,convert=p=>p)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(convert);
for(const [i,r] of [[-5.675,-1.7,-3.425,-.2],[-1.07,-.62,-.23,-.26],[-1.87,-.62,-1.03,-.26],[-7.53,-.58,-6.17,-.24],...[-6.63,-2.47].flatMap(x=>[-1.55,-3.1].map(y=>[x-.07,y-.07,x+.07,y+.07]))].entries())custom.push({id:`INFORMATION-ZONE-${i}`,floor:'2F',vertices:rectangle(...r,p=>informationZoneCatalogPoint(...p,0).slice(0,2))});
if(PHOTOBOOTH.enabled)custom.push({id:PHOTOBOOTH.id,floor:PHOTOBOOTH.floor,vertices:rectangle(-PHOTOBOOTH.width/2,-PHOTOBOOTH.depth,PHOTOBOOTH.width/2,0,p=>photoboothPoint(...p).slice(0,2))});
if(OPENING_GUARDRAIL.enabled)for(let i=1;i<OPENING_GUARDRAIL.centerline.length;i++){
 const a=OPENING_GUARDRAIL.centerline[i-1],b=OPENING_GUARDRAIL.centerline[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[1]-a[1])/len*.032,dy=-(b[0]-a[0])/len*.032;
 custom.push({id:`OPENING-GUARDRAIL-${i}`,floor:'3F',vertices:[[a[0]+dx,a[1]+dy],[b[0]+dx,b[1]+dy],[b[0]-dx,b[1]-dy],[a[0]-dx,a[1]-dy]]});
}
for(const c of custom)if(!c.vertices.flat().every(Number.isFinite))throw Error(`Invalid footprint ${c.id}`);
const inside=(p,vs)=>{let hit=false;for(let i=0,j=vs.length-1;i<vs.length;j=i++){const a=vs[i],b=vs[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
function segmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
const near=(p,vs,r)=>inside(p,vs)||vs.some((v,i)=>segmentDistance(p,v,vs[(i+1)%vs.length])<=r);
function index(rows,margin=0){const bins=new Map();for(const row of rows){const [x0,y0,x1,y1]=bounds(row.vs);for(let x=Math.floor((x0-margin)/4);x<=Math.floor((x1+margin)/4);x++)for(let y=Math.floor((y0-margin)/4);y<=Math.floor((y1+margin)/4);y++){const key=`${x},${y}`;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(row);}}return p=>bins.get(`${Math.floor(p[0]/4)},${Math.floor(p[1]/4)}`)||[];}
function support(p,rows){const matches=[];for(const {vs,model} of rows){const [a,b,c]=vs,den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-9)continue;const u=((b[1]-c[1])*(p[0]-c[0])+(c[0]-b[0])*(p[1]-c[1]))/den,v=((c[1]-a[1])*(p[0]-c[0])+(a[0]-c[0])*(p[1]-c[1]))/den;
 if(u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8){const z=u*a[2]+v*b[2]+(1-u-v)*c[2],same=matches.find(x=>Math.abs(x.z-z)<.3);if(same)same.models.add(model);else matches.push({z,models:new Set([model])});}}return matches.sort((a,b)=>a.z-b.z);}
const anchor=api.geodeticToEcef(origin.lon,origin.lat,origin.height),lon=origin.lon*Math.PI/180,lat=origin.lat*Math.PI/180;
function toGeo([e,n,u]){return api.ecefToGeodetic([anchor[0]-Math.sin(lon)*e-Math.sin(lat)*Math.cos(lon)*n+Math.cos(lat)*Math.cos(lon)*u,anchor[1]+Math.cos(lon)*e-Math.sin(lat)*Math.sin(lon)*n+Math.cos(lat)*Math.sin(lon)*u,anchor[2]+Math.cos(lat)*n+Math.sin(lat)*u]);}
const points=[],floorSummaries={};
for(const [floor,data] of Object.entries(byFloor)){
 const rejected={no_floor:0,edge:0,obstacle:0,custom:0},start=points.length;
 if(data.surfaces.length){const floorIndex=index(data.surfaces),obstacleIndex=index(data.obstacles,clearance),localCustom=custom.filter(c=>c.floor===floor),[xmin,ymin,xmax,ymax]=bounds(data.surfaces.flatMap(x=>x.vs));
  for(let ix=Math.ceil(xmin/spacing);ix<=Math.floor(xmax/spacing);ix++)for(let iy=Math.ceil(ymin/spacing);iy<=Math.floor(ymax/spacing);iy++){
   const p=[ix*spacing,iy*spacing],levels=support(p,floorIndex(p));if(!levels.length){rejected.no_floor++;continue;}
   for(const [level,{z,models}] of levels.entries()){
    if(Array.from({length:16},(_,i)=>[p[0]+Math.cos(i*Math.PI/8)*clearance,p[1]+Math.sin(i*Math.PI/8)*clearance]).some(q=>!support(q,floorIndex(q)).some(s=>Math.abs(s.z-z)<.35))){rejected.edge++;continue;}
    if(obstacleIndex(p).some(o=>{if(o.maxZ<z+.15||o.minZ>z+1.95)return false;const clipped=clipPolygon(clipPolygon(o.vs,v=>v[2]-(z+.15)),v=>z+1.95-v[2]);return clipped.length&&near(p,clipped,clearance);})){rejected.obstacle++;continue;}
    if(localCustom.some(c=>near(p,c.vertices,clearance))){rejected.custom++;continue;}
    const geo=toGeo([...p,z]);points.push({review_id:`GRID-${floor}-${ix}-${iy}${level?'-L'+level:''}`,label:`${floor} 격자 (${ix}, ${iy})${level?' / 높이 '+level:''}`,floor,enu:[...p,Number(z.toFixed(5))],lon:geo.lon,lat:geo.lat,model_walk_ground_z:geo.height,source_ids:[...models],source_basis:'층별 상향 바닥 + 철거 제외 + 현재 장애물 검사',user_approved:false,routing_enabled:false});
   }
  }
 }
 floorSummaries[floor]={points:points.length-start,source_models:[...data.models],floor_triangles:data.surfaces.length,obstacle_polygons:data.obstacles.length,retired_triangles:data.retired,rejected,status:data.surfaces.length?'model_checked_candidates':'floor_geometry_unavailable'};console.log(floor,JSON.stringify(floorSummaries[floor]));
}
// Fine tread grid: retain the exposed top at each XY, never internal sloping bodies.
const movement=[],movementSummary={},treadSpacing=.5;
const upperCaps={'B7':-39.66,'B6':-21.66,'B3':-15.06,'1F':9.20,'2F':15.32,'3F':20.67};
for(const [model,{floor,rows}] of treads){
 const idx=index(rows),selfIndex=index(byFloor[floor].obstacles.filter(o=>o.model===model)),obstacleIndex=index(byFloor[floor].obstacles.filter(o=>o.model!==model),.12),[x0,y0,x1,y1]=bounds(rows.flatMap(r=>r.vs));
 // Multiple underground systems share floor labels: infer local cap from nearby slabs.
 const localSlabs=Object.values(byFloor).flatMap(d=>d.surfaces).filter(r=>{const b=bounds(r.vs);return b[0]<x1+4&&b[2]>x0-4&&b[1]<y1+4&&b[3]>y0-4;});
 const meshMax=Math.max(...rows.flatMap(r=>r.vs.map(v=>v[2]))),slabHeights=localSlabs.flatMap(r=>r.vs.map(v=>v[2])).filter(z=>z<=meshMax+.3&&z>=meshMax-2);
 const cap=upperCaps[floor]??(slabHeights.length?Math.max(...slabHeights)+.20:meshMax);
 const start=movement.length;
 for(let ix=Math.ceil(x0/treadSpacing);ix<=Math.floor(x1/treadSpacing);ix++)for(let iy=Math.ceil(y0/treadSpacing);iy<=Math.floor(y1/treadSpacing);iy++){
  const p=[ix*treadSpacing,iy*treadSpacing],s=support(p,idx(p)).filter(q=>q.z<=cap).at(-1);if(!s)continue;
  const z=s.z;
  // A cap rejected as support must still block the body's hidden surface below it.
  if(selfIndex(p).some(o=>{if(o.maxZ<z+.5||o.minZ>z+1.85)return false;const clipped=clipPolygon(clipPolygon(o.vs,v=>v[2]-(z+.5)),v=>z+1.85-v[2]);return clipped.length>=3&&inside(p,clipped);} ))continue;
  if(obstacleIndex(p).some(o=>{if(o.maxZ<z+.28||o.minZ>z+1.85)return false;const clipped=clipPolygon(clipPolygon(o.vs,v=>v[2]-(z+.28)),v=>z+1.85-v[2]);return clipped.length&&near(p,clipped,.12);} ))continue;
  if(custom.some(c=>c.floor===floor&&near(p,c.vertices,.12)))continue;
  const g=toGeo([...p,z]);movement.push({review_id:`TREAD-${model}-${ix}-${iy}`,label:`${floor} 계단·ES 이동면 ${model} (${ix}, ${iy})`,floor,enu:[...p,Number(z.toFixed(5))],lon:g.lon,lat:g.lat,model_walk_ground_z:g.height,source_ids:[model],point_kind:'connector_tread',source_basis:'검사된 MV 디딤판 상면 · 높이별 이동점 후보',direction:'unverified',landing_verified:false,user_approved:false,routing_enabled:false});
 }
 movementSummary[model]={floor,points:movement.length-start,cap_up:cap};
}
points.push(...movement);
// Model FLOOR is a visibility tag, not a collision boundary: another floor's
// stairs/slab can pass through the same space. Reject hidden lower surfaces.
const worldObstacles=index(Object.values(byFloor).flatMap(d=>d.obstacles));
const headroomRejected=Object.fromEntries(Object.keys(byFloor).map(f=>[f,0]));
for(let i=points.length-1;i>=0;i--){const p=points[i],z=p.enu[2];
 if(worldObstacles(p.enu).some(o=>{if(o.maxZ<z+.5||o.minZ>z+1.85)return false;const clipped=clipPolygon(clipPolygon(o.vs,v=>v[2]-(z+.5)),v=>z+1.85-v[2]);return clipped.length>=3&&inside(p.enu,clipped);} )){headroomRejected[p.floor]++;points.splice(i,1);}
}
for(const f of Object.keys(floorSummaries)){const ps=points.filter(p=>p.floor===f);floorSummaries[f].floor_grid_points=ps.filter(p=>p.point_kind!=='connector_tread').length;floorSummaries[f].tread_points=ps.filter(p=>p.point_kind==='connector_tread').length;floorSummaries[f].points=ps.length;floorSummaries[f].headroom_rejected=headroomRejected[f];}
for(const [model,s] of Object.entries(movementSummary))s.points=points.filter(p=>p.point_kind==='connector_tread'&&p.source_ids.includes(model)).length;
const footprintFiles=['seoul-information-center.json','seoul-information-center.js','seoul-truedan.js','seoul-s11-booths.js','seoul-information-zone.js','seoul-train-mates.js','seoul-photobooth.js','seoul-photobooth.json','seoul-opening-guardrail.json',...retirementFiles];
const customSources=[...new Set(footprintFiles)].map(file=>({file:`app/${file}`,sha256:hash(fs.readFileSync(new URL(`../app/${file}`,import.meta.url)))}));
for(const file of ['tools/build_all_point_grid.mjs','tools/point-retirement.mjs'])customSources.push({file,sha256:hash(fs.readFileSync(new URL('../'+file,import.meta.url)))});
const revision=hash(JSON.stringify({sourceFiles,customSources,custom,spacing,clearance,excludedModels,treadModels:[...treadModels],movementSummary}));
const result={schema_version:2,site:'S202103',status:'model_checked_candidates',spacing_m:spacing,tread_spacing_m:treadSpacing,movementSummary,clearance_m:clearance,source_revision:revision,origin,sourceFiles,customSources,customFootprints:custom,excludedModels,floors:floorSummaries,
 limitations:['9개 모델 층의 바닥 검사. RF는 보행 바닥 데이터가 없어 임의 생성하지 않음.','선로·자갈층, 지붕·천장·바닥 하부·개구부 제외.', '철거 숨김 규칙 적용 후 현존 시설 검사. 2m 격자·0.35m 여유·바닥 위 0.15–1.95m 장애물 검사. 좁은 통로·문턱·통제구역은 현장 검수 필요.','추가 시설은 배포 기본 위치 기준. 브라우저별 임시 배치 변경 미포함.','자동 생성 후보. 통행성 확정이나 층간 연결·경로 생성은 수행하지 않음.'],points};
fs.writeFileSync(new URL('../public/data/route-review/grid-all.json',import.meta.url),JSON.stringify(result)+'\n');
fs.writeFileSync(new URL('../public/data/route-review/grid-2f.json',import.meta.url),JSON.stringify({...result,floor:'2F',points:points.filter(p=>p.floor==='2F')})+'\n');
console.log(JSON.stringify({total:points.length,sourceRevision:revision}));

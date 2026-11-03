// Reuse only the current, reviewed app-asset definitions. This does not accept
// report drafts, guess missing structures, or alter the source station model.
import fs from 'node:fs';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {TRAIN_MATES,TRAIN_MATES_SURFACES,TRAIN_MATES_WEST_ENTRANCE,trainMatesPoint} from '../app/seoul-train-mates.js';
import {INFORMATION_ZONE,INFORMATION_FACILITIES,informationZoneCatalogPoint} from '../app/seoul-information-zone.js';
import {S11_ZONE,S11_SHOPS,s11Point} from '../app/seoul-s11-booths.js';
import {TRUEDAN,TRUEDAN_FACADE,truedanCatalogPoint} from '../app/seoul-truedan.js';
import {INFORMATION_CENTER,INFORMATION_CENTER_SURFACES,informationCenterPoint,informationCenterQuad} from '../app/seoul-information-center.js';
import {PHOTOBOOTH,photoboothPoint,photoboothQuad} from '../app/seoul-photobooth.js';
import {OPENING_GUARDRAIL,openingGuardrailPlan} from '../app/seoul-opening-guardrail.js';

const out='public/data/commons',hall=JSON.parse(fs.readFileSync(out+'/hall.json','utf8')),catalog=JSON.parse(fs.readFileSync('public/data/experience/catalog.json','utf8')),frozen=JSON.parse(fs.readFileSync('public/data/jury-frozen/approved-facades.json','utf8'));
const replacements=new Map(frozen.replacements.filter(r=>r.is_active&&r.review_status==='approved').map(r=>[r.slot.slot_alias,r]));
const r3=n=>Math.round(n*1000)/1000,r6=n=>Math.round(n*1e6)/1e6,assets=[],groups=new Map(),photos=[],photoSources=new Map(),coverage=[],barriersByFloor={'2F':new Map(),'3F':new Map()},footprintsByFloor={'2F':new Map(),'3F':new Map()};
fs.mkdirSync(out+'/custom-images',{recursive:true});
const o=hall.origin,anchor=[o.lon,o.lat,o.height];
function ecef([lon,lat,h]){lon*=Math.PI/180;lat*=Math.PI/180;const s=Math.sin(lat),c=Math.cos(lat),n=6378137/Math.sqrt(1-6.69437999014e-3*s*s);return [(n+h)*c*Math.cos(lon),(n+h)*c*Math.sin(lon),(n*(1-6.69437999014e-3)+h)*s];}
function frame([lon,lat]){lon*=Math.PI/180;lat*=Math.PI/180;return [[-Math.sin(lon),Math.cos(lon),0],[-Math.sin(lat)*Math.cos(lon),-Math.sin(lat)*Math.sin(lon),Math.cos(lat)],[Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)]];}
const anchorECEF=ecef(anchor),anchorBasis=frame(anchor),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
function catalogEnu(point,origin=anchor){if(origin.every((v,i)=>Math.abs(v-anchor[i])<1e-11))return point;const a=ecef(origin),basis=frame(origin),p=a.map((v,i)=>v+basis.reduce((s,b,k)=>s+b[i]*point[k],0)-anchorECEF[i]);return anchorBasis.map(b=>dot(p,b));}
function render(point,origin=anchor){const [e,n,u]=catalogEnu(point,origin);return [r3(e-o.east0),r3(u-o.up0),r3(o.north0-n)];}
const floorHeight=floor=>{const f=hall.floors?.[floor];if(Number.isFinite(f?.ground))return f.ground;if(Number.isFinite(f?.height))return f.height;const ys=hall.walk.points.filter((_,i)=>hall.walk.floors?.[i]===floor).map(p=>p[1]).sort((a,b)=>a-b);return ys.length?ys[Math.floor(ys.length/2)]:floor==='3F'?PHOTOBOOTH.frontCenterEnu[2]-o.up0:0;};
const group=(floor,color,opacity=1,kind=opacity<1?'glass':'solid')=>{const key=[floor,kind,color,opacity].join(':');if(!groups.has(key))groups.set(key,{name:key,kind,floor,color,opacity,positions:[],uv:[],indices:[],pickRanges:[]});return groups.get(key);};
function pickRange(g,assetId,start,count){const last=g.pickRanges.at(-1);if(last?.assetId===assetId&&last.start+last.count===start)last.count+=count;else g.pickRanges.push({start,count,assetId});}
function barrier(points,floor){const y=floorHeight(floor)+1,eps=1e-6,hits=[];if(points.every(p=>Math.abs(p[1]-y)<eps))return;for(let i=0;i<3;i++){const a=points[i],b=points[(i+1)%3],da=a[1]-y,db=b[1]-y;if(Math.abs(da)<eps)hits.push([a[0],a[2]]);if(da*db<0){const t=da/(da-db);hits.push([a[0]+(b[0]-a[0])*t,a[2]+(b[2]-a[2])*t]);}}const unique=[...new Map(hits.map(p=>{const q=p.map(r3);return [q.join(','),q];})).values()];if(unique.length!==2||Math.hypot(unique[0][0]-unique[1][0],unique[0][1]-unique[1][1])<.003)return;unique.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);barriersByFloor[floor].set(unique.flat().join(','),unique.flat());}
function polygon(asset,points,color,opacity=1){const g=group(asset.floor,color,opacity),start=g.indices.length/3,offset=g.positions.length/3;g.positions.push(...points.flat());for(let i=1;i<points.length-1;i++){g.indices.push(offset,offset+i,offset+i+1);barrier([points[0],points[i],points[i+1]],asset.floor);}pickRange(g,asset.id,start,points.length-2);}
function box(asset,point,x,y,z,w,d,h,color,opacity=1){if(!(w>0&&d>0&&h>0))throw Error('Invalid reviewed box '+asset.id);const v=[[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,c])=>point(x+a*w/2,y+b*d/2,z+c*h));for(const face of [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7],[3,2,1,0]])polygon(asset,face.map(i=>v[i]),color,opacity);const plane=floorHeight(asset.floor)+1;if(Math.min(...v.map(p=>p[1]))<=plane&&Math.max(...v.map(p=>p[1]))>=plane){const footprint=v.slice(0,4).map(p=>[p[0],p[2]]);footprintsByFloor[asset.floor].set(footprint.flat().join(','),footprint);}}
function nearestWalkNode(point,floor){let node=null,distance=Infinity;for(let i=0;i<hall.walk.points.length;i++){if(hall.walk.floors[i]!==floor)continue;const p=hall.walk.points[i],d=Math.hypot(p[0]-point[0],p[2]-point[2]);if(d<distance){node=i;distance=d;}}return node;}
function register(id,name,floor,sourceFile,aliases,position,size){
 const matched=catalog.facilities.find(f=>aliases.includes(f.source_id)||f.reference?.focus?.targetAssetId===id),hallFacility=matched&&hall.facilities.find(f=>f.id===matched.id),access=hallFacility?.access||(!hallFacility&&matched?.access?render([0,0,0],matched.access):null),accessNode=access?(hallFacility?.accessNode??nearestWalkNode(access,floor)):null,reference=matched?{...matched.reference,...(matched.access?{accessWgs84:matched.access}:{})}:null;
 const a={id,name:matched?.name||name,floor,kind:'reviewed-app-asset',sourceFile,aliases,facilityId:matched?.id||null,position,size,reference,access,accessNode,accessPointId:accessNode===null?null:hall.walk.pointIds[accessNode],surveyed:false};assets.push(a);return a;
}
function photo(asset,alias,points,defaultImage,crop=[0,0,1,1],{id=alias,allowHall=true}={}){
 if(allowHall&&hall.facades.some(f=>f.alias===alias)){coverage.push({id,assetId:asset.id,alias,handledBy:'hall-approved-facade'});return;}
 const replacement=replacements.get(alias),image=replacement?.image_url||defaultImage;if(!image)throw Error('Missing reviewed photo '+alias);
 const key=crypto.createHash('sha256').update(image+':'+crop.join(',')).digest('hex');if(!photoSources.has(key))photoSources.set(key,{key,image,crop});photos.push({id,alias:id,sourceAlias:alias,assetId:asset.id,facilityId:asset.facilityId,name:asset.name,floor:asset.floor,positions:points.flat(),indices:points.length===3?[0,1,2]:[0,1,2,0,2,3],detailUV:points.length===3?[0,0,1,0,1,1]:[0,0,1,0,1,1,0,1],sourceImage:image,sourceCrop:crop,sourceKey:key});
}

// TRAIN MATES uses a different ENU origin than the catalogue. Preserve that
// rigid frame exactly and convert through ECEF before entering the shared room.
{
 const a=TRAIN_MATES,w=a.width/2,d=a.depth/2,h=a.height,point=(x,y,z)=>render(trainMatesPoint(a,x,y,z),a.origin),asset=register(a.id,a.name,a.floor,'app/seoul-train-mates.js',TRAIN_MATES_SURFACES.map(s=>s.alias),point(0,0,0),[a.width,a.depth,h+a.signHeight]);
 const door=TRAIN_MATES_WEST_ENTRANCE,lo=door.centerY-door.width/2,hi=door.centerY+door.width/2;
 for(const b of [[0,d-.04,0,a.width,.08,h],[-w+.06,(-d+lo)/2,0,.08,d+lo,h],[-w+.06,(d+hi)/2,0,.08,d-hi,h],[-w+.06,door.centerY,door.height,.08,door.width,h-door.height]])box(asset,point,...b,'#536c63');
 for(const y of [lo,hi])box(asset,point,-w+.05,y,0,.08,.055,door.height,'#91a99f');box(asset,point,-w+.05,door.centerY,door.height-.055,.08,door.width,.055,'#91a99f');
 box(asset,point,0,-d+.04,h-.08,a.width,.08,.08,'#628077');box(asset,point,w-.04,0,h-.08,.08,a.depth,.08,'#628077');
 const [front,east,west]=TRAIN_MATES_SURFACES,left=-w+a.width*505/2042,right=-w+a.width*1538/2042;
 photo(asset,front.alias,[[-w,-d,0],[w,-d,0],[w,-d,h],[-w,-d,h]].map(p=>point(...p)),front.image,[0,120/770,1,650/770],{id:front.alias+':body'});
 photo(asset,front.alias,[[left,-d,h],[right,-d,h],[right,-d,h+a.signHeight],[left,-d,h+a.signHeight]].map(p=>point(...p)),front.image,[506/2042,6/770,1030/2042,111/770],{id:front.alias+':sign'});
 // Explicit bottom-left to top-left quads keep both side photographs upright.
 photo(asset,east.alias,[[w,-d,0],[w,d,0],[w,d,h],[w,-d,h]].map(p=>point(...p)),east.image);
 photo(asset,west.alias,[[-w,d,0],[-w,-d,0],[-w,-d,h],[-w,d,h]].map(p=>point(...p)),west.image);
 coverage.push({id:a.id,module:'app/seoul-train-mates.js',contract:'exact source boxes, open west doorway, raised half-width sign and same side photograph without mirrored letters',origin:a.origin});
}
// Five separate information facilities and the photographed canopy supports.
{
 const point=(x,y,z)=>render(informationZoneCatalogPoint(x,y,z)),white='#f4f5f1',blue='#083f93',dark='#141b20',silver='#9da9ac';
 for(const a of INFORMATION_FACILITIES){const asset=register(a.id,a.label,'2F','app/seoul-information-zone.js',[a.slotAlias],point(a.x,a.frontY-a.depth/2,a.baseZ),[a.width,a.depth,a.height]),y=a.frontY-a.depth/2;
  if(a.type==='information_booth'){box(asset,point,a.x,y,a.baseZ,a.width,a.depth,a.height,white);box(asset,point,a.x,a.frontY-.035,a.baseZ,a.width,.07,.67,blue);box(asset,point,a.x,y,a.baseZ+a.height,a.width+.12,a.depth+.12,.1,silver);}
  if(a.type==='train_departure_display'){box(asset,point,a.x,y,a.baseZ,a.width,a.depth,a.height,dark);for(const x of [a.x-2.08,a.x+2.08]){for(const y of [-1.55,-3.10])box(asset,point,x,y,.02,.14,.14,2.98,silver);box(asset,point,x,-2.325,2.96,.18,1.72,.18,silver);}for(const y of [-1.55,-3.10])box(asset,point,a.x,y,2.96,4.42,.20,.18,silver);for(const x of [a.x-1.38,a.x+1.38])box(asset,point,x,a.frontY-.16,3.10,.12,.12,a.baseZ-3.10,dark);}
  if(a.type==='guide_board'){box(asset,point,a.x,y,a.baseZ,a.width,a.depth,a.height,dark);box(asset,point,a.x,y,a.baseZ-.01,a.width+.16,a.depth+.18,.08,silver);}
  if(a.type==='information_tv'){box(asset,point,a.x,y,a.baseZ,a.width,a.depth,a.height,dark);box(asset,point,a.x,a.frontY-.11,.04,.1,.1,a.baseZ-.04,dark);box(asset,point,a.x,a.frontY-.11,.02,.58,.34,.06,dark);}
  const z=a.baseZ+(a.surface.baseOffset||0),w=a.surface.width/2,h=a.surface.height;photo(asset,a.slotAlias,[[a.x+w,a.frontY+.015,z],[a.x-w,a.frontY+.015,z],[a.x-w,a.frontY+.015,z+h],[a.x+w,a.frontY+.015,z+h]].map(p=>point(...p)),a.defaultImage);
 }
 coverage.push({id:INFORMATION_ZONE.id,module:'app/seoul-information-zone.js',contract:'five source fixtures and their exact support/canopy parts; removed original S04 booth is not recreated'});
}
// Existing relocated booth plus the adjacent newly added shop.
// Original CoplanarPolygonGeometry reverses these faces' corner order. Its
// generated ST, the S11 shader's (1-st.y), and Cesium's default flipY=true
// together address the PNG's bottom 709 rows, not its top 709 rows.
for(const shop of S11_SHOPS){const a=S11_ZONE,point=(x,y,z)=>render(s11Point(x,y,z)),asset=register(shop.id,shop.label,'2F','app/seoul-s11-booths.js',[shop.alias],point(shop.eastX-shop.width/2,-a.depth/2,0),[shop.width,a.depth,a.height]);box(asset,point,shop.eastX-shop.width/2,-a.depth/2,0,shop.width,a.depth,a.height,'#525a5b');photo(asset,shop.alias,[[shop.eastX,0.018,0],[shop.eastX-shop.width,0.018,0],[shop.eastX-shop.width,.018,a.height],[shop.eastX,.018,a.height]].map(p=>point(...p)),a.image,replacements.has(shop.alias)?[0,0,1,1]:[shop.imageX/a.atlasWidth,1-a.facadeHeightPx/a.atlasHeight,shop.imageWidth/a.atlasWidth,a.facadeHeightPx/a.atlasHeight]);coverage.push({id:shop.id,module:'app/seoul-s11-booths.js',contract:'reviewed relocation and original engine/ST/shader/flipY-composed physical photo crop; original retired booth stays removed'});}
// TRUEDAN's approved complete facade is rendered by hall.json. Preserve its
// reviewed gable/body rather than adding a guessed cuboid behind the photograph.
{
 const a=TRUEDAN,point=(x,y,z)=>render(truedanCatalogPoint(x,y,z)),asset=register(a.id,'TRUEDAN','2F','app/seoul-truedan.js',[TRUEDAN_FACADE.slotAlias],point(a.width/2,-a.depth/2,0),[a.width,a.depth,a.ridgeHeight]),w=a.width,d=a.depth,h=a.bodyHeight,r=a.ridgeHeight,rd=a.ridgeDepth;
 box(asset,point,w/2,-d/2,-.025,w,d,.105,'#222a2c');box(asset,point,w/2,-d+.06,.08,w,.12,h-.08,'#454e50');box(asset,point,w-.06,-d/2,.08,.12,d,h-.08,'#454e50');box(asset,point,.05,-d/2,.08,.10,d,h-.08,'#454e50');
 for(const vertices of [[[0,-rd,r],[w,-rd,r],[w,-d,h],[0,-d,h]],[[w,0,h],[w,-rd,r],[w,-d,h]],[[0,0,h],[0,-d,h],[0,-rd,r]]])polygon(asset,vertices.map(p=>point(...p)),'#a3a297');
 if(!hall.facades.some(f=>f.alias===TRUEDAN_FACADE.slotAlias))throw Error('Approved TRUEDAN complete facade must be present in hall.json');coverage.push({id:a.id,module:'app/seoul-truedan.js',contract:'exact reviewed rear/side/plinth/gable; source foreground hidden under approved complete facade as in original app',photoHandledByHall:TRUEDAN_FACADE.slotAlias});
}
// Information centre enclosure and the genuinely raised part of its sign.
{
 const a=INFORMATION_CENTER,point=(x,y,z)=>render(informationCenterPoint(x,y,z)),asset=register(a.id,a.label,'2F','app/seoul-information-center.js',INFORMATION_CENTER_SURFACES.map(s=>s.alias),point(0,0,0),[a.width,a.depth,a.height+a.signHeight]),left=-a.width/2+a.width*561/2172,right=-a.width/2+a.width*1618/2172;
 box(asset,point,0,0,0,a.width-.024,a.depth-.024,a.height,'#f3f1eb');box(asset,point,(left+right)/2,-a.depth/2+.105,a.height,right-left,.20,a.signHeight,'#eeeae3');
 for(const s of INFORMATION_CENTER_SURFACES)photo(asset,s.alias,informationCenterQuad(s).map(p=>point(...p)),s.image,s.direction==='south'?[0,228/724,1,496/724]:[0,0,1,1],{id:s.alias+':body'});
 const south=INFORMATION_CENTER_SURFACES[1];photo(asset,south.alias,[[left,-a.depth/2,a.height],[right,-a.depth/2,a.height],[right,-a.depth/2,a.height+a.signHeight],[left,-a.depth/2,a.height+a.signHeight]].map(p=>point(...p)),south.image,[561/2172,6/724,1057/2172,222/724],{id:south.alias+':sign'});
 coverage.push({id:a.id,module:'app/seoul-information-center.js',contract:'exact four outside faces, body/sign crops and raised sign; retained original internal pillars are not removed'});
}
{
 const a=PHOTOBOOTH,point=(x,y,z)=>render(photoboothPoint(x,y,z)),asset=register(a.id,a.label,'3F','app/seoul-photobooth.js',[a.surface.alias],point(0,-a.depth/2,0),[a.width,a.depth,a.height]);box(asset,point,0,-a.depth/2,0,a.width-.01,a.depth-.02,a.height,'#f4f3ee');photo(asset,a.surface.alias,photoboothQuad().map(p=>render(p)),a.surface.image);coverage.push({id:a.id,module:'app/seoul-photobooth.js',contract:'reviewed front photograph and neutral unseen enclosure, source wall/floor untouched'});
}
// Exact approved opening edge. Never create a ceiling/floor across the void.
{
 const a=OPENING_GUARDRAIL,plan=openingGuardrailPlan(),asset=register(a.id,'3층 개구부 유리난간','3F','app/seoul-opening-guardrail.js',[],render(a.centerline[0]),null),silver='#aebfc4';
 const at=(center,angle)=>(x,y,z)=>render([center[0]+x*Math.cos(angle)-y*Math.sin(angle),center[1]+x*Math.sin(angle)+y*Math.cos(angle),center[2]+z]);
 for(const span of plan.spans){const p=span.start.map((v,i)=>(v+span.end[i])/2),point=at(p,span.angle),h=a.height-a.glassBottomGap-.045;box(asset,point,0,0,a.glassBottomGap,Math.max(.02,span.length-a.postWidth),a.glassThickness,h,'#c9e6eb',.22);box(asset,point,0,0,a.height-.045,span.length,a.capWidth,.045,silver);box(asset,point,0,0,.0375,span.length,.038,.035,silver);}
 for(const p of plan.posts)box(asset,at(p,0),0,0,0,a.postWidth,a.postWidth,a.height,silver);coverage.push({id:a.id,module:'app/seoul-opening-guardrail.js',contract:'exact reviewed narrow glass boundary, retained opening and original end supports'});
}
coverage.push({id:'F02WL072-FRAME-S01',module:'app/f02wl072-frame.js',handledBy:'hall-approved-six-surface-overlay-and-retained-source-architecture',contract:'constructor overlays the six actual source frame faces, so no extra invented frame box is added'});
coverage.push({id:'ZIMCARRY-SEOUL-2F',handledBy:'hall-approved-front-and-four-body-surfaces',contract:'approved 5 photographic planes preserve the current thin wall/door object; no inferred shop or service counter is created'});
coverage.push({id:'SEOUL-2F-PLATFORM111',module:'app/seoul-platform111.js',handledBy:'commons-screens',contract:'2F and 3F presentation handled by the dedicated screen renderer, not duplicated here'});
coverage.push({id:'toolkit-approved-additions',handledBy:'no-public-approved-records-observed',contract:'2026-11-01 cookie-free public API returned assets=[] and overlays=[]; report drafts including the AI kiosk are not final approved public geometry'});

// Mechanical image derivation preserves originals and pixel orientation.
const atlasSize=2048,tileSize=260,atlasComposites=[];let index=0;
for(const source of photoSources.values()){
 const image=sharp('public'+source.image),meta=await image.metadata(),[x,y,w,h]=source.crop,region={left:Math.round(x*meta.width),top:Math.round(y*meta.height),width:Math.max(1,Math.round(w*meta.width)),height:Math.max(1,Math.round(h*meta.height))};region.width=Math.min(region.width,meta.width-region.left);region.height=Math.min(region.height,meta.height-region.top);
 const cropped=image.extract(region),detail=await cropped.clone().resize(1536,1024,{fit:'inside',withoutEnlargement:true}).webp({quality:88,effort:6}).toBuffer({resolveWithObject:true}),digest=crypto.createHash('sha256').update(detail.data).digest('hex').slice(0,32),url='/data/commons/custom-images/'+digest+'.webp';fs.writeFileSync('public'+url,detail.data);source.detailImage={url,width:detail.info.width,height:detail.info.height,bytes:detail.data.length};
 const far=await cropped.clone().resize(256,256,{fit:'inside',withoutEnlargement:true}).png().toBuffer({resolveWithObject:true}),left=index%7*tileSize+2,top=Math.floor(index/7)*tileSize+2;if(top+far.info.height+2>atlasSize)throw Error('Custom photo atlas budget exceeded');source.tile={left,top,width:far.info.width,height:far.info.height};atlasComposites.push({input:far.data,left,top});index++;
}
const atlas=await sharp({create:{width:atlasSize,height:atlasSize,channels:3,background:'#e2e4dd'}}).composite(atlasComposites).webp({quality:82,effort:6}).toBuffer();fs.writeFileSync(out+'/custom-atlas.webp',atlas);
for(const p of photos){const source=photoSources.get(p.sourceKey),{left,top,width,height}=source.tile,g=group(p.floor,'#ffffff',1,'photo'),offset=g.positions.length/3,start=g.indices.length/3;p.uv=[];for(let i=0;i<p.detailUV.length;i+=2)p.uv.push(r6((left+p.detailUV[i]*width)/atlasSize),r6(1-(top+(1-p.detailUV[i+1])*height)/atlasSize));p.detailImage=source.detailImage;delete p.sourceKey;g.positions.push(...p.positions);g.uv.push(...p.uv);g.indices.push(...p.indices.map(i=>i+offset));pickRange(g,p.assetId,start,p.indices.length/3);}
const finalGroups=[...groups.values()];for(const g of finalGroups){if(!g.uv.length)delete g.uv;if(!g.positions.every(Number.isFinite)||!g.indices.every(i=>i>=0&&i<g.positions.length/3))throw Error('Invalid custom mesh '+g.name);if(g.uv?.some(v=>v<0||v>1||!Number.isFinite(v)))throw Error('Invalid custom UV');}
const barriers=Object.fromEntries(Object.entries(barriersByFloor).map(([floor,m])=>[floor,[...m.values()]])),footprints=Object.fromEntries(Object.entries(footprintsByFloor).map(([floor,m])=>[floor,[...m.values()]])),version=crypto.createHash('sha256').update(JSON.stringify({hallVersion:hall.version,assets,groups:finalGroups,photos,barriers,footprints,coverage})).update(atlas).digest('hex').slice(0,12),manifest={schema:1,version,hallVersion:hall.version,origin:hall.origin,atlas:'/data/commons/custom-atlas.webp',atlasSize,assets,groups:finalGroups,photos,barriersByFloor:barriers,footprintsByFloor:footprints,sourceCoverage:coverage,totals:{assets:assets.length,groups:finalGroups.length,triangles:finalGroups.reduce((s,g)=>s+g.indices.length/3,0),photos:photos.length,uniqueImages:photoSources.size,atlasBytes:atlas.length,detailBytes:[...photoSources.values()].reduce((s,p)=>s+p.detailImage.bytes,0),barrierSegments:Object.fromEntries(Object.entries(barriers).map(([floor,p])=>[floor,p.length])),footprintPolygons:Object.fromEntries(Object.entries(footprints).map(([floor,p])=>[floor,p.length]))},basis:'Existing reviewed app-asset definitions, exact source boxes/quads/crops/frames and photos reused. Footprints are actual individual source boxes crossing walking height, never a facility bounding box. Unseen neutral faces and estimated dimensions retain the original app contract. No report draft geometry or new guessed facility.'};
if(assets.length!==12||atlas.length>1_000_000||manifest.totals.triangles>10_000)throw Error('Custom asset scope/budget failed');fs.writeFileSync(out+'/custom.json',JSON.stringify(manifest));console.log(JSON.stringify({version,hallVersion:hall.version,...manifest.totals,jsonBytes:fs.statSync(out+'/custom.json').size}));

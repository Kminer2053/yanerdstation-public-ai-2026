import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import hall from '../public/data/commons/hall.json' with {type:'json'};
import architecture from '../public/data/commons/architecture.json' with {type:'json'};
import custom from '../public/data/commons/custom.json' with {type:'json'};
import {TRAIN_MATES,TRAIN_MATES_WEST_ENTRANCE} from '../app/seoul-train-mates.js';
import {SPAWN,walkIndex,makeIndexes,validPoint,groundAt,traversable,slide,pathTo,nearestCell,relocationNode,routeAcross,directedConnections} from '../src/commons-core.js';
const baseIndexes=Object.fromEntries(['2F','3F'].map(floor=>[floor,walkIndex(hall.walk,[],floor)])),indexes=makeIndexes(hall,architecture,custom),baseIndex=baseIndexes['2F'],ix=indexes['2F'];assert(validPoint(baseIndex,0,0));assert.equal(hall.walk.points.length,3762);assert.equal(hall.facades.length,59);assert.equal(hall.facilities.length,61);assert(!JSON.stringify(hall).includes('sales_krw'));
assert(fs.statSync('public/data/commons/hall-atlas.webp').size<1_000_000);assert(fs.statSync('public/data/commons/hall.json').size<1_000_000);
assert.equal(hall.walk.floors.filter(f=>f==='2F').length,3137);assert.equal(hall.walk.floors.filter(f=>f==='3F').length,625);assert.equal(new Set(hall.walk.pointIds).size,hall.walk.points.length);assert.equal(new Set(hall.facilities.map(f=>f.id)).size,61);
for(const floor of ['2F','3F']){const metadata=hall.floors[floor],index=indexes[floor],spawn=metadata.spawn;assert(validPoint(index,spawn[0],spawn[2]));assert.equal(groundAt(index,spawn[0],spawn[2]),spawn[1]);assert.equal(index.nodes.length,metadata.pointCount);assert(index.nodes.every(i=>hall.walk.floors[i]===floor));assert.equal(relocationNode(hall,indexes,metadata.spawnPointId).floor,floor);}
assert(groundAt(indexes['3F'],0,0)-groundAt(ix,0,0)>6,'overlapping x/z cells preserve their distinct floor heights');assert.equal(relocationNode(hall,indexes,'unknown-node'),null);assert.deepEqual(pathTo(ix,hall.floors['2F'].spawnNode,hall.floors['3F'].spawnNode),[],'same-floor routes cannot silently switch storeys');
const interFloorRoute=routeAcross(hall,indexes,'2F',...SPAWN,'3F',0,0);assert(interFloorRoute&&interFloorRoute.connections.length>0);assert(interFloorRoute.connections.every(c=>hall.connections.some(source=>source.id===c.id)));assert.equal(hall.connections.length,10);
for(const connection of hall.connections){for(const endpoint of [connection.from,connection.to]){assert(validPoint(indexes[endpoint.floor],endpoint.point[0],endpoint.point[2]));assert.equal(relocationNode(hall,indexes,hall.walk.pointIds[endpoint.node]).node,endpoint.node,'every registered floor-link endpoint remains outside solid bodies');}const variants=directedConnections(hall).filter(c=>c.id===connection.id);assert.equal(variants.length,connection.direction==='both'?2:1);}
// Use the actual source-box polygons in isolated navigation fixtures. Actual hall
// grid nodes already exclude these interiors, so fixtures ensure the solid rule
// also rejects future nodes placed inside a body instead of relying on missing cells.
const polygonArea=polygon=>Math.abs(polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;
for(const floor of ['2F','3F']){
 const footprints=custom.footprintsByFloor[floor];assert.equal(footprints.length,custom.totals.footprintPolygons[floor]);assert(footprints.length>0);for(const polygon of footprints){assert(polygon.length>=3);assert(polygon.every(p=>p.length===2&&p.every(Number.isFinite)));assert(polygonArea(polygon)>0);}
 const polygon=[...footprints].sort((a,b)=>polygonArea(b)-polygonArea(a))[0],center=polygon.reduce((sum,p)=>[sum[0]+p[0]/polygon.length,sum[1]+p[1]/polygon.length],[0,0]),height=hall.floors[floor].height,id='SOLID-INTERIOR-'+floor,fixture={floors:{[floor]:{height}},walk:{step:2,points:[[center[0],height,center[1]]],edges:[[]],floors:[floor],pointIds:[id]}};
 const shellOnly=makeIndexes(fixture,{}, {...custom,footprintsByFloor:{}}),filled=makeIndexes(fixture,{},custom);assert(validPoint(shellOnly[floor],...center),'the actual body centre lies beyond its thin boundary lines');assert(relocationNode(fixture,shellOnly,id));assert(!validPoint(filled[floor],...center),'filled source boxes reject an interior coordinate');assert.equal(relocationNode(fixture,filled,id),null,'a registered node inside an actual solid body cannot be a relocation destination');
}
// TRAIN MATES is an open shell. Check its real photographed west doorway and
// interior against the custom collision data with a dense isolated walk fixture;
// this tests the shell without claiming the original hall grid covers its interior.
const trainAsset=custom.assets.find(a=>a.id===TRAIN_MATES.id),westPhoto=custom.photos.find(p=>p.id==='TRAIN-MATES-LEFT-S01'),frontPhoto=custom.photos.find(p=>p.id==='TRAIN-MATES-FRONT-S01:body');assert(trainAsset&&westPhoto&&frontPhoto);
const doorFraction=(TRAIN_MATES.depth/2-TRAIN_MATES_WEST_ENTRANCE.centerY)/TRAIN_MATES.depth,west=westPhoto.positions,door=[west[0]+(west[3]-west[0])*doorFraction,west[2]+(west[5]-west[2])*doorFraction],inward=[(frontPhoto.positions[3]-frontPhoto.positions[0])/TRAIN_MATES.width,(frontPhoto.positions[5]-frontPhoto.positions[2])/TRAIN_MATES.width],outsideDoor=door.map((v,i)=>v-inward[i]*.6),insideDoor=door.map((v,i)=>v+inward[i]*.8);
const step=.25,trainPoints=[],trainRows=new Map();for(let x=-64;x<=-50;x+=step)for(let z=-3;z<=7;z+=step){trainRows.set(Math.round(x/step)+','+Math.round(z/step),trainPoints.length);trainPoints.push([x,0,z]);}
const trainEdges=trainPoints.map(p=>{const edges=[];for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){if(!dx&&!dz)continue;const n=trainRows.get((Math.round(p[0]/step)+dx)+','+(Math.round(p[2]/step)+dz));if(n!==undefined)edges.push(n);}return edges;}),trainIndex=walkIndex({step,points:trainPoints,edges:trainEdges},custom.barriersByFloor['2F'],'2F',custom.footprintsByFloor['2F']);
for(const point of [door,outsideDoor,insideDoor,[trainAsset.position[0],trainAsset.position[2]]])assert(validPoint(trainIndex,...point),'actual TRAIN MATES doorway and open interior are not filled as a bounding box');assert(traversable(trainIndex,outsideDoor,insideDoor),'source doorway remains open across the actual wall plane');
const approved=JSON.parse(fs.readFileSync('public/data/jury-frozen/approved-facades.json','utf8')).replacements.filter(r=>r.is_active&&r.review_status==='approved'&&['2F','3F'].includes(r.slot.floor)),coverage=hall.facadeCoverage,facadeAliases=new Set(hall.facades.map(f=>f.alias));
assert.equal(approved.length,59);assert.equal(coverage.approvedRows,approved.length);assert.equal(facadeAliases.size,59);assert.equal(coverage.includedRows,59);assert.equal(coverage.included2F,hall.facades.filter(f=>f.floor==='2F').length);assert.equal(coverage.included3F,hall.facades.filter(f=>f.floor==='3F').length);
assert.deepEqual(coverage.noSurface,[],'every approved facade has either an explicit, recovered or approved-dimension surface');assert.equal(coverage.explicitRows+coverage.sourceRecoveredRows+coverage.slotDimensionRows,approved.length);
assert.deepEqual(coverage.outsideBounds,[]);assert.deepEqual([...facadeAliases].sort(),approved.map(r=>r.slot.slot_alias).sort(),'all 59 approved facades are restored exactly once');
const legacy=JSON.parse(fs.readFileSync('public/data/commons/hall-legacy-surfaces.json','utf8'));assert.equal(legacy.schema,2);assert.equal(Object.keys(legacy.sourceCounts).length,coverage.sourceRecoveredRows);
for(const [alias,counts] of Object.entries(legacy.sourceCounts)){assert(Number.isInteger(counts.expected)&&counts.expected>0);assert.equal(counts.recovered,counts.expected,alias+' preserves the complete original source component');assert.equal(legacy.surfaces[alias].length,counts.expected);assert(/^[a-f0-9]{20}$/.test(counts.signature));}
assert.equal(hall.facades.find(f=>f.alias==='F02WL072-S16').indices.length/3,4);assert.equal(hall.facades.find(f=>f.alias==='F02WL072-S17').indices.length/3,2);
const facadeDetails=new Set();let facadeDetailBytes=0;
for(const f of hall.facades){
 assert(f.positions.length%3===0&&f.positions.every(Number.isFinite));assert.equal(f.uv.length,f.positions.length/3*2);assert(f.uv.every(v=>Number.isFinite(v)&&v>=0&&v<=1));assert(f.indices.length%3===0&&f.indices.every(i=>Number.isInteger(i)&&i>=0&&i<f.positions.length/3));assert.equal(f.detailUV.length,f.uv.length);assert(f.detailUV.every(v=>Number.isFinite(v)&&v>=0&&v<=1));
 const detail=f.detailImage;assert(/^\/data\/commons\/facades\/[a-f0-9]{32}\.webp$/.test(detail.url));const file=fs.readFileSync('public'+detail.url),metadata=await sharp(file).metadata();assert.equal(file.length,detail.bytes);assert.equal(metadata.width,detail.width);assert.equal(metadata.height,detail.height);assert(metadata.width<=1536&&metadata.height<=1024);
 if(!facadeDetails.has(detail.url)){facadeDetails.add(detail.url);facadeDetailBytes+=file.length;}
}
assert.equal(facadeDetails.size,59,'each visible approved facade has its near-detail image');assert(facadeDetailBytes<3_000_000);assert.deepEqual(hall.visibleBounds,architecture.bounds);
// The observed shell is bounded, renderable and belongs to this exact lightweight hall.
assert.equal(architecture.hallVersion,hall.version);assert.deepEqual(architecture.origin,hall.origin);assert.equal(architecture.bounds.length,6);assert(architecture.bounds.every(Number.isFinite));
const binary=fs.readFileSync('public'+architecture.url),atlas=fs.readFileSync('public'+architecture.texture),atlasMetadata=await sharp(atlas).metadata();
assert.equal(binary.length,architecture.totals.binaryBytes);assert(binary.length<8_000_000);assert(architecture.totals.visibleTriangles<=180_000);assert.equal(architecture.groups.length,16);assert.equal(architecture.schema,2);assert(architecture.models.some(m=>m.model==='F02WD001'),'the source WD window type is retained in the full station');
assert.equal(atlas.length,architecture.atlas.bytes);assert(atlas.length<2_000_000);assert.equal(atlasMetadata.width,architecture.atlas.width);assert.equal(atlasMetadata.height,architecture.atlas.height);assert(atlasMetadata.width<=2048&&atlasMetadata.height<=2048);assert(architecture.atlas.gpuBytesWithMipmaps<24_000_000);
assert.equal(architecture.version,createHash('sha256').update(binary).update(atlas).update(JSON.stringify({metadata:architecture.groups,barriers:architecture.barriers,barriersByFloor:architecture.barriersByFloor})).digest('hex').slice(0,12),'geometry, texture and both floors\' collision versions must agree');
assert.equal(architecture.detailVersion,createHash('sha256').update(JSON.stringify(architecture.detailPages)).digest('hex').slice(0,12));assert(fs.statSync('public/data/commons/architecture.json').size<1_000_000,'near-detail ranges keep the full imported manifest compact');
for(const required of ['columns','roof','floors'])assert(architecture.groups.some(g=>g.kind===required),'observed shell includes '+required);
let renderedTriangles=0;
for(const group of architecture.groups){
 assert.equal(group.name,group.floor+':'+group.kind);assert(['2F','3F','4F','RF'].includes(group.floor));assert.equal(group.roofContext,!['2F','3F'].includes(group.floor));
 for(const attribute of ['positions','uv','indices']){const descriptor=group[attribute];assert(Number.isInteger(descriptor.byteOffset)&&descriptor.byteOffset>=0&&descriptor.byteOffset%4===0);assert(Number.isInteger(descriptor.count)&&descriptor.count>0);assert(descriptor.byteOffset+descriptor.count*4<=binary.length);}
 assert.equal(group.positions.count,group.vertexCount*3);assert.equal(group.uv.count,group.vertexCount*2);assert.equal(group.indices.count,group.triangleCount*3);renderedTriangles+=group.triangleCount;
 for(let n=0;n<group.positions.count;n++){const value=binary.readFloatLE(group.positions.byteOffset+n*4),axis=n%3;assert(Number.isFinite(value));assert(value>=architecture.bounds[axis]-.002&&value<=architecture.bounds[axis+3]+.002,'actual vertices stay inside the declared scene bounds');}
 for(let n=0;n<group.uv.count;n++){const value=binary.readFloatLE(group.uv.byteOffset+n*4);assert(Number.isFinite(value)&&value>=0&&value<=1);}
 for(let n=0;n<group.indices.count;n++)assert(binary.readUInt32LE(group.indices.byteOffset+n*4)<group.vertexCount,'all triangles reference existing vertices');
}
assert.equal(renderedTriangles,architecture.totals.visibleTriangles);assert.deepEqual(architecture.barriers,[]);assert.equal(architecture.totals.barrierSegments,0);assert.equal(architecture.totals.totalBarrierSegments,Object.values(architecture.barriersByFloor).reduce((sum,lines)=>sum+lines.length,0));
for(const floor of ['2F','3F']){assert.equal(architecture.barrierHeights[floor],hall.floors[floor].height+1);assert.equal(architecture.barriersByFloor[floor].length,architecture.totals.barrierSegmentsByFloor[floor]);assert(architecture.barriersByFloor[floor].length>0);for(const barrier of architecture.barriersByFloor[floor]){assert.equal(barrier.length,4);assert(barrier.every(Number.isFinite));for(let n=0;n<4;n++)assert(barrier[n]>=architecture.bounds[n%2?2:0]-.002&&barrier[n]<=architecture.bounds[n%2?5:3]+.002);}}
const groupsByName=new Map(architecture.groups.map(g=>[g.name,g])),claimed=new Map(architecture.groups.map(g=>[g.name,new Uint8Array(g.indices.count)])),detailIds=new Set();let detailBytes=0,detailTriangles=0;
for(const page of architecture.detailPages){
 assert(!detailIds.has(page.id));detailIds.add(page.id);assert(/^\/data\/commons\/detail\/[a-f0-9]{24}\.webp$/.test(page.url));assert.equal(page.bounds.length,4);assert(page.bounds.every(Number.isFinite));assert(page.bounds[0]<=page.bounds[2]&&page.bounds[1]<=page.bounds[3]);assert(page.tile.left>=0&&page.tile.top>=0&&page.tile.size>0&&page.tile.left+page.tile.size<=architecture.atlas.width&&page.tile.top+page.tile.size<=architecture.atlas.height);
 const file=fs.readFileSync('public'+page.url),metadata=await sharp(file).metadata();assert.equal(file.length,page.bytes);assert.equal(metadata.width,page.width);assert.equal(metadata.height,page.height);assert(metadata.width<=1024&&metadata.height<=1024);detailBytes+=file.length;const partGroups=new Set();
 for(const part of page.parts){
  assert.equal('indices' in part,false,'the manifest stores compact index-buffer ranges');assert(!partGroups.has(part.group));partGroups.add(part.group);const group=groupsByName.get(part.group);assert(group);let previousEnd=-1;
  for(const [offset,count] of part.ranges){
   assert(Number.isInteger(offset)&&offset>=0&&offset%3===0);assert(Number.isInteger(count)&&count>0&&count%3===0);assert(offset>previousEnd&&offset+count<=group.indices.count);previousEnd=offset+count-1;detailTriangles+=count/3;
   for(let n=offset;n<offset+count;n++){
    assert.equal(claimed.get(group.name)[n],0,'a source triangle belongs to exactly one near-detail page');claimed.get(group.name)[n]=1;
    const i=binary.readUInt32LE(group.indices.byteOffset+n*4),x=binary.readFloatLE(group.positions.byteOffset+i*12),z=binary.readFloatLE(group.positions.byteOffset+i*12+8);assert(i<group.vertexCount);assert(x>=page.bounds[0]-.002&&x<=page.bounds[2]+.002&&z>=page.bounds[1]-.002&&z<=page.bounds[3]+.002);
    const u=(binary.readFloatLE(group.uv.byteOffset+i*8)*architecture.atlas.width-page.tile.left)/page.tile.size,v=((1-binary.readFloatLE(group.uv.byteOffset+i*8+4))*architecture.atlas.height-page.tile.top)/page.tile.size;assert(u>=-.0001&&u<=1.0001&&v>=-.0001&&v<=1.0001,'base atlas UVs invert into the original image without cropping');
   }
  }
 }
}
assert.equal(detailIds.size,architecture.detailStats.pages);assert.equal(detailBytes,architecture.detailStats.bytes);assert(detailBytes<10_000_000);assert.equal(detailTriangles,architecture.detailStats.triangles);assert.equal(detailTriangles,architecture.totals.texturedTriangles,'near-detail ranges cover every original-image triangle exactly once');
const blocked=[999,999];assert(!validPoint(baseIndex,...blocked));assert(!traversable(baseIndex,[0,0],blocked));assert.deepEqual(slide(baseIndex,0,0,999,999),[0,0]);
assert(validPoint(ix,...SPAWN));const start=nearestCell(ix,...SPAWN),neighbor=hall.walk.edges[start].find(i=>traversable(ix,SPAWN,[hall.walk.points[i][0],hall.walk.points[i][2]]));assert.notEqual(neighbor,undefined,'spawn has a genuinely traversable exit');const point=hall.walk.points[neighbor];assert(pathTo(ix,start,neighbor).length===2);assert(traversable(ix,SPAWN,[point[0],point[2]]));
function findBarrierCrossing(index,base,lines){
 for(const [ax,az,bx,bz] of lines){
  const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);if(length<.01)continue;
  for(const fraction of [.5,.25,.75])for(const offset of [.3,.5,.75]){
   const x=ax+dx*fraction,z=az+dz*fraction,from=[x-dz/length*offset,z+dx/length*offset],to=[x+dz/length*offset,z-dx/length*offset];
   if(validPoint(index,...from)&&validPoint(index,...to)&&traversable(base,from,to)&&!traversable(index,from,to))return {from,to};
  }
 }
}
const barrierCrossing=findBarrierCrossing(ix,baseIndex,architecture.barriersByFloor['2F']);
assert(barrierCrossing,'observed geometry blocks travel through intermediate walls even when both endpoints are walkable');
const sourceGeometryIndexes=makeIndexes(hall,architecture),additionalCollisionCases=[];
const upperBarrierCrossing=findBarrierCrossing(indexes['3F'],baseIndexes['3F'],architecture.barriersByFloor['3F']);assert(upperBarrierCrossing,'upper-floor source geometry has its own collision slice');additionalCollisionCases.push({floor:'3F',kind:'upper source geometry',...upperBarrierCrossing});
for(const floor of ['2F','3F']){const crossing=findBarrierCrossing(indexes[floor],sourceGeometryIndexes[floor],custom.barriersByFloor[floor]);assert(crossing,'new '+floor+' structures add collisions beyond the original geometry');additionalCollisionCases.push({floor,kind:'approved custom structures',...crossing});}
const dir=mkdtempSync(path.join(tmpdir(),'commons-test-'));await build({entryPoints:['server/commons.js'],outfile:path.join(dir,'api.mjs'),bundle:true,format:'esm',platform:'node',logLevel:'silent'});const {commonsApi}=await import(pathToFileURL(path.join(dir,'api.mjs')));
const sqlite=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync('drizzle/'+f,'utf8'));
const prepare=sql=>{let args=[];return {bind(...a){args=a;return this},async first(){return sqlite.prepare(sql).get(...args)||null},async all(){return {results:sqlite.prepare(sql).all(...args)}},run(){return {meta:sqlite.prepare(sql).run(...args)}}}};
const DB={prepare,async batch(items){sqlite.exec('BEGIN');try{const results=items.map(item=>item.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
let now=1793520000000;
async function call(action,data,token,extra={}){const req=new Request('https://station.test/api/commons/'+action,{method:'POST',headers:{Origin:'https://station.test','Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...extra},body:JSON.stringify(data)});return commonsApi(req,{DB},now);}
const peerFields=['id','floor','x','y','z','yaw','pose','color','seenAt'].sort();
function assertPrivateSnapshot(peers,tokens=[]){
 for(const peer of peers){
  assert.deepEqual(Object.keys(peer).filter(key=>key!=='travel').sort(),peerFields,'snapshots expose only display state');
  assert(['2F','3F'].includes(peer.floor));assert.equal(peer.y,groundAt(indexes[peer.floor],peer.x,peer.z),'snapshot heights come from the registered walk surface');
  if(peer.travel){assert.deepEqual(Object.keys(peer.travel).sort(),['durationMs','elapsedMs','id','path']);assert(peer.travel.durationMs>=2500&&peer.travel.durationMs<=9000);assert(peer.travel.elapsedMs>=0&&peer.travel.elapsedMs<=peer.travel.durationMs);assert(directedConnections(hall).some(c=>c.id===peer.travel.id&&JSON.stringify(c.actualpath)===JSON.stringify(peer.travel.path)),'travel animation follows an approved original path');}
  for(const field of ['token','token_hash','room_id','joined_at','seq','transit','moved_at'])assert.equal(field in peer,false,'credential/internal field '+field+' must not be public');
 }
 for(const token of tokens)assert(!JSON.stringify(peers).includes(token),'raw bearer token must not appear in peers');
}
// Only the disposable in-memory presence fixture is reset; business/map tables are never cleared.
function clearPresence(){sqlite.exec('DELETE FROM commons_players');sqlite.exec('DELETE FROM commons_rooms');now+=5001;}
async function newMember(color=0){const response=await call('join',{color});assert.equal(response.status,201);return response.json();}
const payload=(member,seq,x=SPAWN[0],z=SPAWN[1],extra={})=>({room:member.room,id:member.id,seq,floor:'2F',x,z,yaw:Math.PI,pose:'idle',...extra});
function seedPosition(member,floor,point){assert(validPoint(indexes[floor],point[0],point[2]));sqlite.prepare("UPDATE commons_players SET x=?,z=?,floor=?,transit='',moved_at=0 WHERE id=?").run(point[0],point[2],floor,member.id);}
assert.equal(await commonsApi(new Request('https://station.test/api/catalog'),{DB}),null);
assert.equal((await call('join',{color:0},null,{Origin:'https://evil.test'})).status,403);
assert.equal((await call('join',{color:90})).status,400);
assert.equal((await call('join',{color:0},null,{'Content-Type':'application/jsonp'})).status,415);
assert.equal((await call('join',{color:0,big:'x'.repeat(3000)})).status,413);
const first=await call('join',{color:0});assert.equal(first.status,201);const a=await first.json();assert(a.token.length===64);assert.equal(a.peers.length,1);assert(!JSON.stringify(a.peers).includes(a.token));
assert.deepEqual([a.peers[0].x,a.peers[0].z],SPAWN,'new visitors start in the shared central-hall position');assert.equal(a.peers[0].yaw,Math.PI);
assert.equal(a.peers[0].floor,'2F');assert.equal(a.version,[hall.version,architecture.version,custom.version].join(':'),'room compatibility includes navigation, architecture and custom structures');
assert.equal((await call('join',{color:0})).status,429,'new room global cooldown');
const second=await call('join',{room:a.room,color:1});assert.equal(second.status,201);const b=await second.json();assert.equal(b.peers.length,2);
assertPrivateSnapshot(a.peers,[a.token,b.token]);assertPrivateSnapshot(b.peers,[a.token,b.token]);
for(const member of [a,b]){
 const stored=sqlite.prepare('SELECT token_hash FROM commons_players WHERE id=?').get(member.id).token_hash;
 assert.equal(stored,createHash('sha256').update(member.token).digest('hex'),'only the bearer digest is stored');assert.notEqual(stored,member.token);
}
const update={room:a.room,id:a.id,seq:1,floor:'2F',x:point[0],z:point[2],yaw:.4,pose:'wave'};
assert.equal((await call('sync',update,'0'.repeat(64))).status,401);
assert.equal((await call('sync',update,a.token)).status,429);
now+=1300;const updated=await call('sync',update,a.token);assert.equal(updated.status,200);const snap=await updated.json();assert.equal(snap.seq,1);assert.equal(snap.peers.find(p=>p.id===a.id).pose,'wave');assert.equal(snap.peers.length,2);
assertPrivateSnapshot(snap.peers,[a.token,b.token]);assert.equal('token' in snap,false);assert.equal('token_hash' in snap,false);
assert.equal((await call('sync',update,a.token)).status,409,'replay rejected');
now+=1300;assert.equal((await call('sync',{...update,seq:2,x:999,z:999},a.token)).status,400);
assert.equal((await call('sync',{...update,seq:2,pose:'script'},a.token)).status,400);
const far=ix.nodes.map(i=>hall.walk.points[i]).find(p=>validPoint(ix,p[0],p[2])&&Math.hypot(p[0]-point[0],p[2]-point[2])>30);assert.equal((await call('sync',{...update,seq:2,x:far[0],z:far[2]},a.token)).status,422);
for(let i=0;i<17;i++)assert.equal((await call('join',{room:a.room,color:i%6})).status,201);
const full=await Promise.all(Array.from({length:5},()=>call('join',{room:a.room,color:0})));assert.equal(full.filter(r=>r.status===201).length,1);assert.equal(full.filter(r=>r.status===409).length,4);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM commons_players WHERE room_id=?').get(a.room).n,20);
assert.equal((await call('leave',{room:a.room,id:b.id},a.token)).status,401,'cannot remove another player');
assert.equal((await call('leave',{room:a.room,id:b.id},b.token)).status,200);assert.equal((await call('join',{room:a.room,color:1})).status,201);
now+=21_000;assert.equal((await call('sync',{...update,seq:2},a.token)).status,410,'idle member cannot revive');
now+=20*60_000;assert.equal((await call('join',{room:a.room,color:1})).status,410,'fixed room expiry');

// Two in-flight requests based on the same sequence may commit exactly once.
clearPresence();const racer=await newMember();now+=1300;
const duplicatePayload=payload(racer,1,...SPAWN,{pose:'cheer'});
const duplicates=await Promise.all([call('sync',duplicatePayload,racer.token),call('sync',duplicatePayload,racer.token)]);
assert.deepEqual(duplicates.map(r=>r.status).sort(),[200,409]);
assert.equal(sqlite.prepare('SELECT seq FROM commons_players WHERE id=?').get(racer.id).seq,1);
const replay=await call('sync',duplicatePayload,racer.token);assert.equal(replay.status,409);const replayBody=await replay.json();assert.equal(replayBody.seq,1);assert.deepEqual(replayBody.position,SPAWN);
now+=1300;assert.equal((await call('sync',payload(racer,2),racer.token)).status,200,'a client can recover a lost acknowledgement');

// Creation limits must hold independently of per-room membership limits.
clearPresence();
const concurrentRooms=await Promise.all(Array.from({length:5},()=>call('join',{color:0})));
assert.equal(concurrentRooms.filter(r=>r.status===201).length,1,'global creation cooldown is atomic');
assert.equal(concurrentRooms.filter(r=>r.status===429).length,4);
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM commons_rooms').get().n,1);
clearPresence();let latestRoom;
for(let i=0;i<5;i++){if(i)now+=5001;latestRoom=await newMember();}
now+=5001;assert.equal((await call('join',{color:0})).status,429,'five active rooms are the global maximum');
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM commons_rooms WHERE expires_at>?').get(now).n,5);
assert.equal((await call('join',{room:latestRoom.room,color:1})).status,201,'existing room invitations remain usable at the room-count limit');
now+=latestRoom.limits.roomLifetimeMs+1;assert.equal((await call('join',{color:0})).status,201,'expired rooms release the active-room quota');

clearPresence();let dailyLimit;
for(let i=0;i<30;i++){
 const member=await newMember();dailyLimit=member.limits.newRoomsPerDay;
 if(i<29)now+=member.limits.roomLifetimeMs+1;
}
assert.equal(dailyLimit,30);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM commons_rooms').get().n,30);
now+=20*60_000+1;assert.equal((await call('join',{color:0})).status,429,'rolling daily quota counts already expired rooms');
now+=86_400_001;assert.equal((await call('join',{color:0})).status,201,'rolling quota recovers after one day');

// Seed only this disposable player's valid starting point beside an observed wall.
clearPresence();const besideWall=await newMember();sqlite.prepare('UPDATE commons_players SET x=?,z=? WHERE id=?').run(...barrierCrossing.from,besideWall.id);now+=1300;
assert.equal((await call('sync',payload(besideWall,1,...barrierCrossing.to),besideWall.token)).status,422,'the server enforces observed intermediate barriers in addition to the walk grid');
assert.equal(sqlite.prepare('SELECT seq FROM commons_players WHERE id=?').get(besideWall.id).seq,0);
for(const collision of additionalCollisionCases){clearPresence();const member=await newMember();seedPosition(member,collision.floor,[collision.from[0],0,collision.from[1]]);now+=1300;assert.equal((await call('sync',payload(member,1,...collision.to,{floor:collision.floor}),member.token)).status,422,collision.kind+' prevents walking through an intermediate obstacle');assert.equal(sqlite.prepare('SELECT seq FROM commons_players WHERE id=?').get(member.id).seq,0);}

// An endpoint can be walkable while the straight line to it crosses a missing edge/wall.
let curved;
for(const target of ix.nodes){
 const end=hall.walk.points[target];if(Math.hypot(end[0]-SPAWN[0],end[2]-SPAWN[1])>=18||traversable(ix,SPAWN,[end[0],end[2]]))continue;
 const route=pathTo(ix,start,target);if(route.length<3||route.length>32)continue;
 let length=0,segmentsValid=true;
 for(let k=1;k<route.length;k++){const from=[route[k-1][0],route[k-1][2]],to=[route[k][0],route[k][2]];length+=Math.hypot(to[0]-from[0],to[1]-from[1]);if(!traversable(ix,from,to))segmentsValid=false;}
 if(segmentsValid&&length<18){curved={end,route:route.map(p=>[p[0],p[2]]),length};break;}
}
assert(curved,'the hall fixture must contain a valid detour around a non-traversable straight line');
clearPresence();const walker=await newMember();now+=Math.ceil(curved.length/4.2*1000)+1000;
assert.equal((await call('sync',payload(walker,1,curved.end[0],curved.end[2]),walker.token)).status,422,'valid endpoints do not permit walking through an intermediate wall');
const curvedResult=await call('sync',payload(walker,1,curved.end[0],curved.end[2],{path:curved.route}),walker.token);
assert.equal(curvedResult.status,200,'a legitimate multi-segment turn must be accepted');assertPrivateSnapshot((await curvedResult.json()).peers,[walker.token]);

// Ending at the starting point cannot disguise excessive travel along an otherwise valid path.
clearPresence();const looper=await newMember();now+=1300;
const near=[point[0],point[2]],roundTrip=[near,[...SPAWN],near,[...SPAWN]];
assert(roundTrip.reduce((distance,p,i)=>distance+(i?Math.hypot(p[0]-roundTrip[i-1][0],p[1]-roundTrip[i-1][1]):Math.hypot(p[0]-SPAWN[0],p[1]-SPAWN[1])),0)>1.3*4.2+.75);
assert.equal((await call('sync',payload(looper,1,...SPAWN,{path:roundTrip}),looper.token)).status,422,'speed checks include the complete path, not just endpoint distance');
assert.equal((await call('sync',payload(looper,1,...SPAWN,{path:Array.from({length:33},()=>[...SPAWN])}),looper.token)).status,400,'path data is bounded');
assert.equal((await call('sync',payload(looper,1,...SPAWN,{path:[[...SPAWN,0]]}),looper.token)).status,400,'path points have exactly two coordinates');
assert.equal(sqlite.prepare('SELECT seq FROM commons_players WHERE id=?').get(looper.id).seq,0,'rejected travel never advances the authoritative sequence');

// Registered navigation nodes permit explicit relocation, while a floor flag alone does not.
clearPresence();const relocator=await newMember();now+=1300;const upper=relocationNode(hall,indexes,hall.floors['3F'].spawnPointId),upperXZ=[upper.point[0],upper.point[2]];
const missingFloor=payload(relocator,1);delete missingFloor.floor;assert.equal((await call('sync',missingFloor,relocator.token)).status,400,'floor is a required movement field');
assert.equal((await call('sync',payload(relocator,1,...SPAWN,{floor:'RF'}),relocator.token)).status,400,'roof context is not a walkable user floor');
for(const floor of ['__proto__','toString',null,{},['3F'],true])assert.equal((await call('sync',payload(relocator,1,...upperXZ,{floor}),relocator.token)).status,400,'invalid floor value '+JSON.stringify(floor)+' does not escape the floor allowlist');
assert.equal((await call('sync',payload(relocator,1,...upperXZ,{floor:'3F'}),relocator.token)).status,422,'ordinary movement cannot silently change floors');
assert.equal((await call('sync',payload(relocator,1,...upperXZ,{floor:'3F',move:{kind:'node',id:'unknown-node'}}),relocator.token)).status,422,'only registered node identifiers are accepted');
assert.equal((await call('sync',payload(relocator,1,upperXZ[0]+.25,upperXZ[1],{floor:'3F',move:{kind:'node',id:upper.id}}),relocator.token)).status,422,'relocation coordinates must match the approved node exactly');
assert.equal((await call('sync',payload(relocator,1,...upperXZ,{floor:'2F',move:{kind:'node',id:upper.id}}),relocator.token)).status,422,'node identifiers cannot be reassigned to another floor');
assert.equal((await call('sync',payload(relocator,1,...upperXZ,{floor:'3F',move:{kind:'node',id:upper.id,extra:true}}),relocator.token)).status,400,'relocation objects have a bounded schema');
const relocated=await call('sync',payload(relocator,1,...upperXZ,{floor:'3F',move:{kind:'node',id:upper.id}}),relocator.token);assert.equal(relocated.status,200);const relocatedBody=await relocated.json();assert.equal(relocatedBody.floor,'3F');assert.deepEqual(relocatedBody.position,upperXZ);assert.equal(relocatedBody.y,upper.point[1]);assertPrivateSnapshot(relocatedBody.peers,[relocator.token]);
now+=1300;const upperHeartbeat=await call('sync',payload(relocator,2,...upperXZ,{floor:'3F'}),relocator.token);assert.equal(upperHeartbeat.status,200);assertPrivateSnapshot((await upperHeartbeat.json()).peers,[relocator.token]);
now+=1300;assert.equal((await call('sync',payload(relocator,3,...SPAWN),relocator.token)).status,422,'the stored upper-floor state remains authoritative');
const remoteNode=ix.nodes.map(i=>relocationNode(hall,indexes,hall.walk.pointIds[i])).find(n=>n&&Math.abs(n.point[0])>100);assert(remoteNode,'full-floor navigation is not truncated by the old 100-metre limit');
now+=1300;const remoteRelocation=await call('sync',payload(relocator,3,remoteNode.point[0],remoteNode.point[2],{move:{kind:'node',id:remoteNode.id}}),relocator.token);assert.equal(remoteRelocation.status,200);assertPrivateSnapshot((await remoteRelocation.json()).peers,[relocator.token]);

// Different simultaneous relocation requests based on one sequence may commit once only.
clearPresence();const relocationRacer=await newMember();now+=1300;const relocationRequests=[payload(relocationRacer,1,...upperXZ,{floor:'3F',move:{kind:'node',id:upper.id}}),payload(relocationRacer,1,remoteNode.point[0],remoteNode.point[2],{move:{kind:'node',id:remoteNode.id}})];
const relocationRace=await Promise.all(relocationRequests.map(data=>call('sync',data,relocationRacer.token)));assert.deepEqual(relocationRace.map(r=>r.status).sort(),[200,409]);const winningRelocation=await relocationRace.find(r=>r.status===200).json(),storedRelocation=sqlite.prepare('SELECT floor,x,z,seq FROM commons_players WHERE id=?').get(relocationRacer.id);assert.equal(storedRelocation.seq,1);assert.equal(storedRelocation.floor,winningRelocation.floor);assert.deepEqual([storedRelocation.x,storedRelocation.z],winningRelocation.position);

// A registered connection validates source-floor breadcrumbs, direction and its exact endpoint.
const forward=hall.connections.find(c=>c.direction==='forward'&&c.from.floor==='2F'&&c.to.floor==='3F'&&!validPoint(indexes['3F'],c.from.point[0],c.from.point[2]));assert(forward,'the fixture exercises breadcrumbs that belong only to the source floor');
clearPresence();const connector=await newMember();seedPosition(connector,forward.from.floor,forward.from.point);now+=1300;const connectionStart=now,connectionPayload=payload(connector,1,forward.to.point[0],forward.to.point[2],{floor:forward.to.floor,move:{kind:'connection',id:forward.id},path:[[forward.from.point[0],forward.from.point[2]]]});
assert.equal((await call('sync',{...connectionPayload,move:{kind:'connection',id:'unknown-connection'}},connector.token)).status,422);
assert.equal((await call('sync',{...connectionPayload,x:connectionPayload.x+.25},connector.token)).status,422,'a connection cannot point at arbitrary destination coordinates');
assert.equal((await call('sync',{...connectionPayload,path:[[999,999]]},connector.token)).status,400,'connection breadcrumbs still obey the source-floor walk grid');
const connected=await call('sync',connectionPayload,connector.token);assert.equal(connected.status,200);const connectedBody=await connected.json();assert.equal(connectedBody.floor,'3F');assert.deepEqual(connectedBody.position,[forward.to.point[0],forward.to.point[2]]);assertPrivateSnapshot(connectedBody.peers,[connector.token]);
const travel=connectedBody.travel;assert(travel);assert.equal(travel.id,forward.id);assert.deepEqual(travel.path,forward.actualpath);const pathLength=forward.actualpath.reduce((sum,p,i,path)=>sum+(i?Math.hypot(...p.map((v,k)=>v-path[i-1][k])):0),0),expectedDuration=Math.max(2500,Math.min(9000,pathLength/3.4*1000));assert(Math.abs(travel.durationMs-expectedDuration)<=1);assert.equal(travel.elapsedMs,0);
const connectionReplay=await call('sync',connectionPayload,connector.token);assert.equal(connectionReplay.status,409,'lost acknowledgements remain recoverable after the authoritative floor changes');const connectionReplayBody=await connectionReplay.json();assert.equal(connectionReplayBody.floor,'3F');assert.equal(connectionReplayBody.seq,1);assert.deepEqual(connectionReplayBody.position,connectedBody.position);assert.deepEqual(connectionReplayBody.travel,travel);
now+=1300;assert.equal((await call('sync',payload(connector,2,...upperXZ,{floor:'3F',move:{kind:'node',id:upper.id}}),connector.token)).status,429,'a running floor transition cannot be replaced by a new move');
const duringTravel=await call('sync',payload(connector,2,forward.to.point[0],forward.to.point[2],{floor:'3F'}),connector.token);assert.equal(duringTravel.status,200);const duringBody=await duringTravel.json();assertPrivateSnapshot(duringBody.peers,[connector.token]);assert(duringBody.travel&&duringBody.travel.elapsedMs>=1300,'stationary heartbeats preserve the continuous transition animation');
const destinationNeighbor=hall.walk.edges[forward.to.node].find(i=>indexes['3F'].eligible.has(i)&&traversable(indexes['3F'],[forward.to.point[0],forward.to.point[2]],[hall.walk.points[i][0],hall.walk.points[i][2]]));assert.notEqual(destinationNeighbor,undefined);now=connectionStart+Math.min(travel.durationMs-1,2600);assert.equal((await call('sync',payload(connector,3,hall.walk.points[destinationNeighbor][0],hall.walk.points[destinationNeighbor][2],{floor:'3F'}),connector.token)).status,429,'ordinary movement waits for the floor-transition animation to finish');
now=connectionStart+travel.durationMs+1;assert.equal((await call('sync',payload(connector,3,forward.from.point[0],forward.from.point[2],{floor:'2F',move:{kind:'connection',id:forward.id},path:[[forward.to.point[0],forward.to.point[2]]]}),connector.token)).status,422,'a forward-only escalator cannot be traversed backwards');
const afterTravel=await call('sync',payload(connector,3,forward.to.point[0],forward.to.point[2],{floor:'3F'}),connector.token);assert.equal(afterTravel.status,200);const afterBody=await afterTravel.json();assert(!afterBody.travel);assert(!afterBody.peers.find(p=>p.id===connector.id).travel,'finished transit metadata is no longer displayed');

clearPresence();const reverseConnector=await newMember(),both=hall.connections.find(c=>c.direction==='both'&&c.from.floor==='2F');assert(both);seedPosition(reverseConnector,both.to.floor,both.to.point);now+=1300;
const reversed=await call('sync',payload(reverseConnector,1,both.from.point[0],both.from.point[2],{floor:both.from.floor,move:{kind:'connection',id:both.id},path:[[both.to.point[0],both.to.point[2]]]}),reverseConnector.token);assert.equal(reversed.status,200);const reversedBody=await reversed.json();assert.equal(reversedBody.floor,'2F');assert.deepEqual(reversedBody.travel.path,[...both.actualpath].reverse());assertPrivateSnapshot(reversedBody.peers,[reverseConnector.token]);

clearPresence();const distantConnector=await newMember();now+=1300;assert.equal((await call('sync',payload(distantConnector,1,forward.to.point[0],forward.to.point[2],{floor:'3F',move:{kind:'connection',id:forward.id},path:[[...SPAWN]]}),distantConnector.token)).status,422,'registered links require proximity to their source');
assert.equal((await call('sync',payload(distantConnector,1,forward.to.point[0],forward.to.point[2],{floor:'3F',move:{kind:'connection',id:forward.id},path:[[forward.from.point[0],forward.from.point[2]]]}),distantConnector.token)).status,422,'source breadcrumbs cannot conceal excessive approach speed');
const sourceNeighbor=hall.walk.edges[forward.from.node].find(i=>ix.eligible.has(i)&&traversable(ix,[forward.from.point[0],forward.from.point[2]],[hall.walk.points[i][0],hall.walk.points[i][2]]));assert.notEqual(sourceNeighbor,undefined);seedPosition(distantConnector,'2F',hall.walk.points[sourceNeighbor]);
const approached=await call('sync',payload(distantConnector,1,forward.to.point[0],forward.to.point[2],{floor:'3F',move:{kind:'connection',id:forward.id},path:[[forward.from.point[0],forward.from.point[2]]]}),distantConnector.token);assert.equal(approached.status,200,'a legitimate same-floor approach may continue through its registered floor link');assertPrivateSnapshot((await approached.json()).peers,[distantConnector.token]);
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM workbench').get().n,0,'map data untouched');assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM audit').get().n,0);
sqlite.close();fs.rmSync(dir,{recursive:true});console.log('공유방: 실제 구조·아틀라스 예산/범위/버전·시작점·토큰 해시·스냅샷 격리·정원 및 순번 경합·재전송 회복·활성방/일일 쿼터·실제 벽 및 정상 우회/누적속도·만료·업무 데이터 보존 검사 통과');

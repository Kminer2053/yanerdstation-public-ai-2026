import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import hall from '../public/data/commons/hall.json' with {type:'json'};
import architecture from '../public/data/commons/architecture.json' with {type:'json'};
import custom from '../public/data/commons/custom.json' with {type:'json'};
import {createCameraCollision} from '../src/commons-camera-collision.js';

const vector=(x,y,z)=>new T.Vector3(x,y,z),near=(actual,expected,tolerance=1e-6)=>assert(actual.distanceTo(expected)<(typeof tolerance==='number'?tolerance:1e-6),(typeof tolerance==='string'?tolerance+' ':'')+JSON.stringify({actual:actual.toArray(),expected:expected.toArray()}));
function mesh(positions,indices,material=new T.MeshBasicMaterial({side:T.DoubleSide})){
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));if(indices)geometry.setIndex(indices);return new T.Mesh(geometry,material);
}
const wall=mesh([0,-1,-1,0,1,-1,0,1,1,0,-1,1],[0,1,2,0,2,3],new T.MeshBasicMaterial({side:T.FrontSide})),wallPositions=wall.geometry.getAttribute('position').array,wallIndices=wall.geometry.index.array,out=vector(0,0,0),collision=createCameraCollision([wall]);
assert(collision.clip(vector(-2,0,0),vector(2,0,0),out));near(out,vector(-.18,0,0));
assert(collision.clip(vector(2,0,0),vector(-2,0,0),out));near(out,vector(.18,0,0),'both winding directions block the camera');
assert(!collision.clip(vector(-2,2,0),vector(2,2,0),out));near(out,vector(2,2,0));
assert(!collision.clip(vector(-2,0,0),vector(-1,0,0),out));near(out,vector(-1,0,0));
assert(collision.clip(vector(-2,0,0),vector(-.05,0,0),out));near(out,vector(-.18,0,0),'endpoints just before a face still preserve the camera clearance');
const alias=vector(2,0,0);assert(collision.clip(vector(-2,0,0),alias,alias));near(alias,vector(-.18,0,0));
const fromAlias=vector(-2,0,0);assert(collision.clip(fromAlias,vector(2,0,0),fromAlias));near(fromAlias,vector(-.18,0,0));
assert(collision.clip(vector(0,0,-3),vector(0,0,3),out));near(out,vector(0,0,-1.18),'a coplanar segment cannot finish inside a wall triangle');
wall.visible=false;assert(!collision.clip(vector(-2,0,0),vector(2,0,0),out));wall.visible=true;assert(collision.clip(vector(-2,0,0),vector(2,0,0),out));
assert.equal(wall.geometry.getAttribute('position').array,wallPositions);assert.equal(wall.geometry.index.array,wallIndices,'original geometry buffers stay shared');
assert.throws(()=>collision.clip(vector(NaN,0,0),vector(1,0,0),out),TypeError);
collision.dispose();assert(!collision.clip(vector(-2,0,0),vector(2,0,0),out));near(out,vector(2,0,0));

const cube=new T.Mesh(new T.BoxGeometry(2,2,2),new T.MeshBasicMaterial({side:T.FrontSide})),cubeCollision=createCameraCollision([cube]);
assert(cubeCollision.clip(vector(-3,0,0),vector(3,0,0),out));near(out,vector(-1.18,0,0));
assert(cubeCollision.clip(vector(3,0,0),vector(-3,0,0),out));near(out,vector(1.18,0,0));
assert(cubeCollision.clip(vector(0,0,0),vector(3,0,0),out));near(out,vector(.82,0,0),'inside rays stop before the first actual exit face without inferring a volume');cubeCollision.dispose();

const overhead=mesh([-2,2,-2,2,2,-2,2,2,2,-2,2,2],[0,1,2,0,2,3]),overheadCollision=createCameraCollision([overhead]);
assert(overheadCollision.clip(vector(0,1,0),vector(0,4,0),out));near(out,vector(0,1.82,0),'vertical rays hit an overhead slab even with zero XZ extent');
assert(!overheadCollision.clip(vector(-1,1,0),vector(1,1,0),out));overheadCollision.dispose();
const thin=mesh([0,-1,-.01,0,1,-.01,0,1,.01,0,-1,.01],[0,1,2,0,2,3]),thinCollision=createCameraCollision([thin]);assert(thinCollision.clip(vector(-2,0,0),vector(2,0,0),out));near(out,vector(-.18,0,0));thinCollision.dispose();
const transparent=mesh([0,-1,-1,0,1,-1,0,1,1,0,-1,1],[0,1,2,0,2,3],new T.MeshBasicMaterial({transparent:true,opacity:.25})),glassCollision=createCameraCollision([transparent]);assert.equal(glassCollision.stats.triangles,0);assert(!glassCollision.clip(vector(-2,0,0),vector(2,0,0),out));glassCollision.dispose();
const parent=new T.Group(),transformed=wall.clone();parent.position.set(1,0,0);transformed.position.set(3,2,-3);transformed.rotation.y=Math.PI/4;parent.add(transformed);const transformedCollision=createCameraCollision([transformed]),centre=vector(4,2,-3),normal=vector(Math.SQRT1_2,0,-Math.SQRT1_2),from=centre.clone().addScaledVector(normal,-2),to=centre.clone().addScaledVector(normal,2);
assert(transformedCollision.clip(from,to,out));near(out,centre.clone().addScaledVector(normal,-.18));parent.visible=false;assert(!transformedCollision.clip(from,to,out));transformedCollision.dispose();
const broad=mesh([0,-1,-20,0,1,-20,0,1,20,0,-1,20],[0,1,2,0,2,3]),broadCollision=createCameraCollision([broad]);assert(broadCollision.clip(vector(-4,0,-4),vector(4,0,4),out));assert.equal(broadCollision.stats.lastTriangleTests,2,'a triangle indexed in several grid cells is intersected once');assert.equal(broadCollision.stats.lastCandidates,2);broadCollision.dispose();
const empty=createCameraCollision([]);assert(!empty.clip(vector(0,5,0),vector(50,5,0),out));near(out,vector(12,5,0),'long rays/output have an explicit finite bound');assert(!empty.clip(vector(2,3,4),vector(2,3,4),out));near(out,vector(2,3,4));empty.dispose();

// Build only CPU Mesh objects from the exact published geometry. No WebGL,
// upstream requests, source writes or generated-asset mutations are involved.
const bytes=fs.readFileSync('public'+architecture.url),actual=[];
for(const group of architecture.groups){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(bytes.buffer,bytes.byteOffset+group.positions.byteOffset,group.positions.count),3));geometry.setIndex(new T.BufferAttribute(new Uint32Array(bytes.buffer,bytes.byteOffset+group.indices.byteOffset,group.indices.count),1));const item=new T.Mesh(geometry,new T.MeshStandardMaterial({...group.material,side:T.DoubleSide}));item.name='source:'+group.name;actual.push(item);}
actual.push(mesh(hall.ceilings.flat(2)));
for(const floor of Object.keys(hall.floors)){const positions=[],indices=[];for(const facade of hall.facades.filter(f=>f.floor===floor)){const offset=positions.length/3;positions.push(...facade.positions);indices.push(...facade.indices.map(i=>i+offset));}actual.push(mesh(positions,indices));}
for(const group of custom.groups){const item=mesh(group.positions,group.indices,new T.MeshBasicMaterial({side:T.DoubleSide,transparent:group.kind==='glass',opacity:group.opacity??1}));item.name='custom:'+group.name;actual.push(item);}
const actualCollision=createCameraCollision(actual),look=vector(7,7.482,-6.2),desired=vector(3.12,8.88,.04),safe=vector(0,0,0),originalDistance=look.distanceTo(desired);
assert(actualCollision.clip(look,desired,safe),'the actual Terrarosa backwards-walk ray hits the published structure');assert(look.distanceTo(safe)<originalDistance-.18,'the gray-screen regression shortens the camera before the real face');
const terrarosa={from:look.toArray(),desired:desired.toArray(),safe:safe.toArray(),originalDistance,safeDistance:look.distanceTo(safe)};

// Compare a small set against Three's independent triangle raycaster; the
// helper deliberately ignores winding, so these reference materials are double-sided.
const reference=new T.Raycaster(),direction=vector(0,0,0);for(const item of actual){item.updateMatrixWorld(true);item.geometry.computeBoundingBox();item.geometry.computeBoundingSphere();}
direction.subVectors(desired,look).normalize();reference.set(look,direction);reference.far=originalDistance+.18;const grayHit=reference.intersectObjects(actual.filter(m=>!m.material.transparent&&(m.material.opacity??1)>=1),false)[0];assert(grayHit);near(safe,look.clone().addScaledVector(direction,Math.max(0,grayHit.distance-.18)),2e-4);terrarosa.firstHit={mesh:grayHit.object.name,distance:grayHit.distance};
for(let i=0;i<12;i++){
 const p=hall.walk.points[(i*271)%hall.walk.points.length],angle=i*.71;from.set(p[0],p[1]+1.35,p[2]);to.set(from.x+Math.cos(angle)*7.8,from.y+1.4,from.z+Math.sin(angle)*7.8);const length=from.distanceTo(to);direction.subVectors(to,from).normalize();reference.set(from,direction);reference.near=0;reference.far=Math.min(12,length+.18);
 const hit=reference.intersectObjects(actual.filter(m=>!m.material.transparent&&(m.material.opacity??1)>=1),false)[0],didHit=actualCollision.clip(from,to,safe);assert.equal(didHit,!!hit,'grid queries agree with the actual triangle raycaster');const expected=hit?from.clone().addScaledVector(direction,Math.min(length,Math.max(0,hit.distance-.18))):to;near(safe,expected,2e-4);
}
let hits=0,candidates=0,tests=0,maxQueryMs=0;const benchmarkStarted=performance.now();
for(let i=0;i<200;i++){const p=hall.walk.points[(i*97)%hall.walk.points.length],angle=i*2.399963229728653;from.set(p[0],p[1]+1.35,p[2]);direction.set(Math.cos(angle),.12+Math.sin(i*.37)*.16,Math.sin(angle)).normalize();to.copy(from).addScaledVector(direction,8);const started=performance.now();if(actualCollision.clip(from,to,safe))hits++;maxQueryMs=Math.max(maxQueryMs,performance.now()-started);candidates+=actualCollision.stats.lastCandidates;tests+=actualCollision.stats.lastTriangleTests;}
const benchmarkMs=performance.now()-benchmarkStarted;assert(benchmarkMs<2000,'200 bounded camera rays remain below the generous CPU regression budget');
console.log(JSON.stringify({ok:true,fixtures:'inside/outside/reverse/double-sided/aliases/overhead/thin-wall/transparent/transformed/hidden/coplanar/deduplication/bounded-rays',terrarosa,actual:actualCollision.stats,benchmark:{rays:200,rayLength:8,hits,totalMs:benchmarkMs,meanMs:benchmarkMs/200,maxQueryMs,meanCandidates:candidates/200,meanTriangleTests:tests/200},memoryNote:'typedBytes includes compact grid references and query/index buffers; existing position/index arrays are shared; JS Map/source-object overhead is not included'}));
actualCollision.dispose();for(const item of actual){item.geometry.dispose();item.material.dispose();}

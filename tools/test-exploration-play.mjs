import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createPlayState,playAction,tickPlay,resetPlay,playPose,POSES} from '../src/exploration-play.js';
import {buildWalkIndex,slideMove} from '../src/crowd-core.js';
const context={mode:'explore',view:'third'},s=createPlayState();
for(const mode of ['walk','bird','overview'])assert.equal(playAction(s,'jump',{...context,mode}),false);
assert.equal(playAction(s,'jump',{...context,view:'first'}),false);
assert.equal(playAction(s,'wave',{...context,riding:true}),false);
assert.equal(playAction(s,'unknown',context),false);
assert(playAction(s,'jump',context));assert.equal(playAction(s,'jump',context),false);
assert.equal(playAction(s,'wave',context),false);
let max=0;for(let i=0;i<50;i++){tickPlay(s,.02);max=Math.max(max,s.jumpHeight);assert(s.jumpHeight>=0&&s.jumpHeight<=.5);}
assert(max>.49);assert.equal(s.jumpHeight,0);assert.equal(s.jumpTime,null);
for(const pose of Object.keys(POSES)){
 assert(playAction(s,pose,context));tickPlay(s,.08);const p=playPose(s,0,false);assert.equal(p.yawOffset,Math.PI);assert(Object.values(p.joints).flat().every(Number.isFinite));
 for(let i=0;i<70;i++)tickPlay(s,.08);assert.equal(s.pose,pose==='photo'?'photo':null);
 assert(playAction(s,pose,context));tickPlay(s,.02,{moving:true});assert.equal(s.pose,null);
}
playAction(s,'jump',context);tickPlay(s,.08,{riding:true});assert.deepEqual(s,createPlayState());
playAction(s,'cheer',context);resetPlay(s);assert.deepEqual(s,createPlayState());
// Cosmetic jump never bypasses the same wall test, even when the avatar is in the air.
const graph={origin:{lon:126.97,lat:37.554,height:36},points:[['GRID-2F-0','2F',126.97,37.554,36,0,0,0],['GRID-2F-1','2F',126.97002,37.554,36,2,0,0]],adj:[[],[]],connections:[]};
const ix=buildWalkIndex(graph);playAction(s,'jump',context);
for(let i=0;i<45;i++){tickPlay(s,.02);assert.equal(slideMove(ix,'2F',0,.5,36,0,1),null);assert.equal(graph.points[0][4],36);}
const scene=fs.readFileSync(new URL('../app/experience-scene.js',import.meta.url),'utf8');
assert.match(scene,/mode='walk'/);assert.match(scene,/endPlay\(\);mode='walk'/);
assert.match(scene,/slideMove\(walkIndex,free.floor,free.x,free.y,free.h,/);
assert(!scene.includes('free.h+play.jumpHeight'));
const avatar=fs.readFileSync(new URL('../app/explorer-avatar.js',import.meta.url),'utf8');
assert.match(avatar,/person-0.glb/);assert.match(avatar,/node.matrix=/);
const ui=fs.readFileSync(new URL('../src/open-world.js',import.meta.url),'utf8');
assert(ui.includes("closest('button[data-explore-view]')"),'body view state must not catch every pose/jump click and reset the pose');
console.log('자유탐색 놀이: 모드 격리, 점프 높이·착지, 포즈 취소, 층간 이동 초기화, 보행 제한 통과');

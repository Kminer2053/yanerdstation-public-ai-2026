import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createPointerKeys,bindExplorationPointers} from '../src/exploration-input.js';
import {createPlayState,playAction,tickPlay} from '../src/exploration-play.js';

const changes=[],keys=createPointerKeys(k=>changes.push(k));
keys.down(1,'KeyW');keys.down(2,'ArrowRight');assert.deepEqual(changes.at(-1),['KeyW','ArrowRight']);
keys.up(2);assert.deepEqual(changes.at(-1),['KeyW']);
keys.down(3,'KeyW');keys.up(1);assert.deepEqual(changes.at(-1),['KeyW']);
keys.up(3);assert.deepEqual(changes.at(-1),[]);

class Element extends EventTarget {
  constructor(key){super();this.dataset=key?{key}:{};this.classList=new Set();this.classList.remove=this.classList.delete;this.captured=new Set();}
  closest(selector){return selector==='[data-key]'&&this.dataset.key?this:null;}
  contains(el){return [forward,right,left].includes(el);}
  setPointerCapture(id){this.captured.add(id);}
  hasPointerCapture(id){return this.captured.has(id);}
  releasePointerCapture(id){this.captured.delete(id);}
}
const movement=new Element(),jump=new Element(),forward=new Element('KeyW'),right=new Element('ArrowRight'),left=new Element('ArrowLeft');
const doc=new EventTarget(),win=new EventTarget(),sent=[],play=createPlayState();
let jumps=0,enabled=true,focused=true;doc.hasFocus=()=>focused;
const controller=bindExplorationPointers({movement,jump,documentTarget:doc,windowTarget:win,enabled:()=>enabled,onKeys:k=>sent.push(k),onJump:()=>{jumps++;playAction(play,'jump',{mode:'explore',view:'third'});}});
function fire(target,type,props={}){
  const e=new Event(type,{cancelable:true});
  for(const [k,v]of Object.entries(props))Object.defineProperty(e,k,{value:v});
  target.dispatchEvent(e);return e;
}
const down=(button,id)=>fire(button===jump?jump:movement,'pointerdown',{target:button,pointerId:id,pointerType:'touch',button:0,isPrimary:id===1});
down(forward,1);down(right,2);assert.deepEqual(sent.at(-1),['KeyW','ArrowRight']);
assert(forward.classList.has('input-held'));assert(right.classList.has('input-held'));
assert(down(jump,3).defaultPrevented);assert.equal(jumps,1,'secondary finger jumps immediately on pointerdown');
assert.deepEqual(sent.at(-1),['KeyW','ArrowRight'],'jump does not clear movement');
tickPlay(play,.08,{moving:true});assert(play.jumpHeight>0,'walking must not cancel a jump');
fire(jump,'click',{detail:1,pointerType:'touch'});assert.equal(jumps,1,'synthetic pointer click must not jump twice');
fire(win,'pointerup',{pointerId:3});assert.deepEqual(sent.at(-1),['KeyW','ArrowRight']);
fire(win,'pointerup',{pointerId:2});assert.deepEqual(sent.at(-1),['KeyW']);assert(!right.classList.has('input-held'));
down(forward,4);fire(win,'pointercancel',{pointerId:1});assert.deepEqual(sent.at(-1),['KeyW']);assert(forward.classList.has('input-held'));
fire(movement,'lostpointercapture',{pointerId:4});assert.deepEqual(sent.at(-1),[]);assert(!forward.classList.has('input-held'));
down(forward,5);down(left,6);fire(win,'pointercancel',{pointerId:6});assert.deepEqual(sent.at(-1),['KeyW']);
controller.reset();assert.deepEqual(sent.at(-1),[]);assert(!forward.hasPointerCapture(5));
down(forward,7);doc.hidden=true;fire(doc,'visibilitychange');assert.deepEqual(sent.at(-1),[]);doc.hidden=false;
down(forward,8);fire(win,'blur');assert.deepEqual(sent.at(-1),['KeyW'],'in-document/iframe focus transfer keeps touch held');
focused=false;fire(win,'blur');assert.deepEqual(sent.at(-1),[]);focused=true;
down(forward,9);fire(win,'pagehide');assert.deepEqual(sent.at(-1),[]);
fire(jump,'click',{detail:0});assert.equal(jumps,2,'keyboard and assistive activation retained');
fire(jump,'pointerdown',{pointerId:10,pointerType:'mouse',button:2});assert.equal(jumps,2);
enabled=false;down(forward,11);down(jump,12);assert.equal(jumps,2);assert.deepEqual(sent.at(-1),[]);

const scene=fs.readFileSync(new URL('../app/experience-scene.js',import.meta.url),'utf8');
assert.match(scene,/const hasKey=k=>keys.has\(k\)\|\|touchKeys.has\(k\)/);
assert.match(scene,/d.action==='touch-keys'&&Array.isArray\(d.keys\)/);
assert.match(scene,/if\(mode==='explore'\)for\(const key of d.keys\)if\(MOVE_KEYS.has\(key\)\)touchKeys.add\(key\)/);
assert.match(scene,/slideMove\(walkIndex,free.floor,free.x,free.y,free.h,/);
assert.match(scene,/clearKeys=\(\)=>\{keys.clear\(\);touchKeys.clear\(\);\}/);
const ui=fs.readFileSync(new URL('../src/experience.js',import.meta.url),'utf8');
assert.match(ui,/touchInput\?\.reset\(\);mode=next/);
assert.match(ui,/onKeys:keys=>post\(\{action:'touch-keys',keys\}\)/);
const css=fs.readFileSync(new URL('../src/exploration-play.css',import.meta.url),'utf8');
assert.match(css,/#explorePlay #exploreJump,#touchControls \[data-key\]\{touch-action:none/);
console.log('자유탐색 입력: 전진+회전+점프, 보조 손가락, 독립 해제·취소, 중복 키, 포커스·모드 초기화, 키보드 접근성 통과');

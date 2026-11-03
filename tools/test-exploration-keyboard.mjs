import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the actual parent-page listener, including its focus guards.
const source=fs.readFileSync(new URL('../src/experience.js',import.meta.url),'utf8');
const start=source.indexOf("const moveKeys=new Set(");
const end=source.indexOf("document.addEventListener('visibilitychange'",start);
const handlers={},sent=[];
let dialog=false;
const context={mode:'explore',post:d=>sent.push(d),switchMode:()=>{},document:{
  body:{dataset:{exploreView:'third'}},querySelector:()=>dialog,
  addEventListener:(name,fn)=>handlers[name]=fn,
}};
vm.runInNewContext(source.slice(start,end),context);
function key(code,{control=false,game=false,tag='BUTTON',repeat=false,...rest}={}){
  sent.length=0;let prevented=false;
  handlers.keydown({code,repeat,target:{tagName:tag,isContentEditable:false,
    closest:s=>s==='button,summary,a'?control:game},
    preventDefault:()=>{prevented=true},...rest});
  return {prevented,messages:JSON.parse(JSON.stringify(sent))};
}
assert.deepEqual(key('Space',{control:true,game:true}),{prevented:true,messages:[{action:'play-action',value:'jump'}]},'Space works with exploration button focused');
assert.equal(key('Space',{control:true,game:true,repeat:true}).messages.length,0,'held Space does not repeatedly jump');
assert.equal(key('Space',{control:true}).prevented,false,'unrelated buttons retain keyboard activation');
assert.equal(key('Space',{tag:'INPUT',game:true}).prevented,false,'form input stays untouched');
assert.equal(key('Space',{game:true,ctrlKey:true}).prevented,false,'browser shortcuts stay untouched');
assert.equal(key('KeyW',{control:true,game:true}).messages[0].key,'KeyW');
assert.equal(key('Digit1',{control:true,game:true}).messages[0].value,'wave');
dialog=true;assert.equal(key('Space',{game:true}).prevented,false);dialog=false;
context.document.body.dataset.exploreView='first';assert.equal(key('Space',{game:true}).prevented,false);
context.document.body.dataset.exploreView='third';context.mode='walk';assert.equal(key('Space',{game:true}).prevented,false);
console.log('자유탐색 키보드: 조작 버튼 초점에서 Space 점프·포즈, 반복 억제, 입력창·대화상자·일반 버튼·1인칭·따라걷기 보호 통과');

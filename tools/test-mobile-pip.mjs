import assert from 'node:assert/strict';
import fs from 'node:fs';
import {bindPeopleToggle} from '../src/people-toggle.js';
import {cameraPipSize} from '../src/camera-comparison.js';
const checkbox=new EventTarget(),button=new EventTarget(),sent=[],attrs={};
checkbox.checked=true;button.setAttribute=(key,value)=>attrs[key]=value;
bindPeopleToggle({checkbox,button,onChange:enabled=>sent.push(enabled)});
assert.equal(button.textContent,'사람 켜짐');assert.equal(attrs['aria-pressed'],'true');assert.deepEqual(sent,[]);
button.dispatchEvent(new Event('click'));assert.equal(checkbox.checked,false);assert.equal(attrs['aria-pressed'],'false');assert.equal(button.textContent,'사람 꺼짐');
button.dispatchEvent(new Event('click'));assert.equal(checkbox.checked,true);assert.equal(attrs['aria-pressed'],'true');
checkbox.checked=false;checkbox.dispatchEvent(new Event('change'));assert.equal(button.textContent,'사람 꺼짐');assert.deepEqual(sent,[false,true,false]);
const css=fs.readFileSync(new URL('../src/mobile-navigation.css',import.meta.url),'utf8');
assert.match(css,/\.map-stage\.comparing\{display:block/);
assert.match(css,/\.camera-panel\{position:absolute;right:8px/);
assert.match(css,/width:var\(--camera-pip-width,40%\);height:var\(--camera-pip-height,auto\)/);
assert.match(css,/aspect-ratio:var\(--camera-aspect,16\/9\)/);
assert.match(css,/\.camera-panel video\{object-fit:contain;object-position:center\}/);
const camera=fs.readFileSync(new URL('../src/camera-comparison.js',import.meta.url),'utf8');
assert.match(camera,/resizeMode:\{ideal:'none'\}/);
assert.doesNotMatch(camera,/aspectRatio:/);
for(const [videoWidth,videoHeight]of [[1280,720],[720,1280],[1000,1000]])for(const [stageWidth,stageHeight,controlsHeight]of [[390,635,58],[360,523,184],[650,180,90]]){
 const size=cameraPipSize({videoWidth,videoHeight,stageWidth,stageHeight,controlsHeight});
 assert(Math.abs(size.width/size.height-videoWidth/videoHeight)<1e-8,'PIP follows the actual source ratio, no crop or bars');
 assert(size.width<=stageWidth*.4);assert(size.height<=stageHeight*.42+1e-8);assert(size.height<=stageHeight-controlsHeight-32+1e-8);
}
assert.doesNotMatch(css,/grid-template-rows:minmax\(0,1fr\) minmax\(0,1fr\)/);
assert.match(css,/bottom:calc\(var\(--walk-controls-h,0px\) \+ 16px\)/);
console.log('모바일 PIP: 실제 가로·세로 영상비율 유지, 잘라내기·여백 없음, 조작줄 회피, 사람 토글 양방향 동기화 통과');

import './commons.css';
import {PALETTE,SPAWN,makeIndexes,validPoint,groundAt,slide,traversable,nearestCell,pathTo,shortAngle,directedConnections,relocationNode,sampleTravel,travelDuration} from './commons-core.js';
import {createCommonsWorld} from './commons-world.js';
import {createPresence} from './commons-presence.js';
const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),floorLabel=f=>f==='2F'?'2층':f==='3F'?'3층':f;
const self={id:'self',self:true,floor:'2F',x:SPAWN[0],y:0,z:SPAWN[1],yaw:Math.PI,pitch:0,color:0,pose:'idle',jump:0,moving:false,travel:null};
let hall,architecture,custom,indexes,world,presence,places=[],entered=false,overview=true,npcsOn=false,npcs=[],selected=null,selectedPosition=null,nearConnection=null,connections=[],moveBusy=false,listFloor='all',jumpAt=-10,poseUntil=0,toastTimer,room=null,raf=0;
const keys=new Set(),stick={x:0,y:0,pointer:null},look={pointer:null,x:0,y:0,startX:0,startY:0},remote=new Map(),labels=new Map();
const invitation=new URLSearchParams(location.search).get('room'),invite=/^[a-f0-9]{24}$/.test(invitation||'')?invitation:null;
const elapsed=(travel,now)=>travel?(travel.elapsedMs||0)+Math.max(0,now-(travel.receivedAt??now)):0;
const travelling=()=>!!self.travel&&elapsed(self.travel,performance.now())<self.travel.durationMs;
const blocked=()=>!entered||overview||moveBusy||travelling()||!!document.querySelector('dialog[open]')||document.hidden;
function toast(message){$('toast').textContent=message;$('toast').classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('on'),4500);}
function clearInput(){keys.clear();stick.x=stick.y=0;stick.pointer=null;$('stick').style.transform='';look.pointer=null;}
function updateFloorControls(){
 for(const b of document.querySelectorAll('[data-floor]')){b.setAttribute('aria-pressed',String(b.dataset.floor===self.floor));b.disabled=moveBusy||travelling()||!world;}
 $('world-label').textContent=floorLabel(self.floor)+' · 등록 기준본 · 경량 재구성';
}
function view(on){overview=on;document.body.dataset.overview=String(on);world?.setOverview(on);$('view-toggle').innerHTML=on?'♙ <span>산책 시점</span>':'▧ <span>공간 조망</span>';clearInput();}
function start(){entered=true;document.body.dataset.entered='true';view(false);$('scene').focus({preventScroll:true});}
function pose(name){if(blocked())return;self.pose=name;poseUntil=performance.now()+(name==='sit'?86400_000:2400);world.invalidate();$('pose-menu').hidden=true;$('pose-open').setAttribute('aria-expanded','false');}
function jump(){if(blocked()||performance.now()-jumpAt<700)return;jumpAt=performance.now();self.pose='idle';}
function roomState(state){
 room=state.room||null;$('connection').textContent=state.connected?(state.moving?'이동 위치 확인 중':state.failed?'연결 지연 · 이동 대기':`함께 ${state.count}명`):'혼자 둘러보기';$('open-room').textContent=state.connected?'초대·공유방 ↗':'함께 입장하기 ↗';$('join-room').hidden=state.connected;$('joined-controls').hidden=!state.connected;
 if(state.connected){$('invite-link').value=location.origin+location.pathname+'?room='+state.room;$('invite-note').textContent='방 종료 '+new Date(state.expiresAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})+' · 이 링크를 공유하면 같은 방으로 입장합니다.';}
 else{$('invite-note').textContent=invite?'초대받은 서울역 공유방으로 입장합니다.':'새 공유방을 만들고 초대 링크를 나눌 수 있어요.';remote.clear();}
 world?.invalidate();
}
function openRoom(){clearInput();$('room-error').textContent='';$('join-room').textContent=invite?'초대받은 방에 입장':'공유방 만들기';$('room-dialog').showModal();}
function onReconcile(position,floor,travel){
 const fromFloor=self.floor;self.floor=floor;self.x=position[0];self.z=position[1];self.y=groundAt(indexes[floor],self.x,self.z);self.jump=0;self.pose='idle';self.moving=false;jumpAt=-10;
 self.travel=travel?{...travel,receivedAt:performance.now(),fromFloor,toFloor:floor}:null;
 clearInput();world.setFloor(floor);world.invalidate();updateFloorControls();
}
async function moveNode(id,{walk=true,message,face,faceSize}={}){
 if(moveBusy||travelling())return false;const target=relocationNode(hall,indexes,id);if(!target){toast('이 지점은 구조물과 겹쳐 이동할 수 없어요. 다른 보행 지점을 선택해 주세요.');return false;}
 clearInput();moveBusy=true;updateFloorControls();
 try{await presence.moveTo({...target,move:{kind:'node',id}});if(Array.isArray(face)&&Number.isFinite(face[0])&&Number.isFinite(face[2])&&Math.hypot(face[0]-self.x,face[2]-self.z)>.01){self.yaw=Math.atan2(face[0]-self.x,-(face[2]-self.z));self.pitch=0;world.frameFacility(faceSize);world.invalidate();}if(walk)start();if(message)toast(message);return true;}
 catch(e){toast(e.message||'위치를 옮기지 못했어요. 다시 선택해 주세요.');return false;}
 finally{moveBusy=false;updateFloorControls();}
}
function requestPosition(id){
 if(!overview||moveBusy||travelling())return;const target=relocationNode(hall,indexes,id);if(!target){toast('구조물과 겹치지 않는 보행 지점을 선택해 주세요.');return;}
 selectedPosition=id;clearInput();$('position-label').textContent=floorLabel(target.floor)+' · 선택한 보행 지점에서 산책을 시작합니다.';$('position-dialog').showModal();$('confirm-position').focus();
}
function nodeForFacility(f){
 const floor=f.floor||'2F',ix=indexes[floor];if(!ix)return null;
 if(Number.isInteger(f.accessNode)&&hall.walk.floors[f.accessNode]===floor){const n=relocationNode(hall,indexes,hall.walk.pointIds[f.accessNode]);if(n)return n;}
 const p=f.access||f.point;if(!p)return null;const node=nearestCell(ix,p[0],p[2]);if(node<0||Math.hypot(hall.walk.points[node][0]-p[0],hall.walk.points[node][2]-p[2])>8)return null;
 return relocationNode(hall,indexes,hall.walk.pointIds[node]);
}
function collectPlaces(){
 const map=new Map(hall.facilities.map(f=>[f.id,{...f}]));
 for(const asset of custom.assets||[]){const old=map.get(asset.facilityId);if(old){old.assetId=asset.id;if(!old.access&&asset.access){old.access=asset.access;old.accessNode=asset.accessNode;}continue;}
  if(!indexes[asset.floor])continue;const id='asset:'+asset.id;map.set(id,{id,assetId:asset.id,name:asset.name,floor:asset.floor,category:'등록 구조물',point:asset.position,access:asset.access,accessNode:asset.accessNode,reference:asset.reference,notes:asset.notes||'현재화 작업으로 등록된 시설입니다.',products:[]});
 }
 places=[...map.values()];
}
function showFacility(id){
 if(id.startsWith('asset:')){const asset=custom.assets?.find(a=>a.id===id.slice(6));if(asset?.facilityId&&places.some(f=>f.id===asset.facilityId))id=asset.facilityId;}
 const f=places.find(f=>f.id===id);if(!f){toast('이 시설의 안내 정보는 아직 등록되지 않았어요.');return;}
 selected=f;clearInput();$('facility-panel').hidden=true;$('facility-info').hidden=false;$('facility-floor').textContent='SEOUL STATION · '+floorLabel(f.floor);$('facility-name').textContent=f.name;$('facility-notes').textContent=f.notes||'기준본에 등록된 시설입니다.';
 const photo=hall.facades.find(p=>p.facilityId===f.id)||(custom.photos||[]).find(p=>p.facilityId===f.id||p.assetId===f.assetId);$('facility-photo').hidden=!photo;if(photo)$('facility-photo').src=photo.detailImage?.url||photo.sourceImage;
 $('facility-facts').replaceChildren();for(const [term,value]of [['층',floorLabel(f.floor)],['분류',f.category],['영업시간',f.hours],['시설 ID',f.id.startsWith('asset:')?null:f.id]]){if(!value)continue;const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=term;dd.textContent=value;$('facility-facts').append(dt,dd);}
 $('facility-products').replaceChildren();if(f.products?.length){const ul=document.createElement('ul');for(const p of f.products){const li=document.createElement('li');li.textContent=p.name+(p.price_text?' · '+p.price_text:p.price?' · '+Number(p.price).toLocaleString('ko-KR')+'원':'');ul.append(li);}$('facility-products').append(ul);}
 const target=nodeForFacility(f);$('facility-route').disabled=!target;$('facility-move').disabled=!target;$('facility-move').textContent=target?'가까운 보행 지점으로 이동':'이동할 보행 지점이 등록되지 않았어요';
 const focus=f.reference?.focus;$('facility-precise').hidden=!f.reference;if(f.reference){const params=new URLSearchParams({site:'S202103',floor:f.floor,catalogFocus:'1',lon:f.reference.lon,lat:f.reference.lat,height:f.reference.height,...(f.alias?{imageId:f.alias}:{}),label:f.name,...Object.fromEntries(Object.entries(focus||{}).filter(([,v])=>['string','number'].includes(typeof v)))});$('facility-precise').href='/app/?'+params;}
}
function renderFacilityList(){
 $('facility-list').replaceChildren();for(const f of places.filter(f=>listFloor==='all'||f.floor===listFloor).sort((a,b)=>a.floor.localeCompare(b.floor)||a.name.localeCompare(b.name,'ko'))){const b=document.createElement('button');b.className='place-row';const span=document.createElement('span'),small=document.createElement('small'),arrow=document.createElement('span');span.textContent=f.name;small.textContent=floorLabel(f.floor)+' · '+(f.category||'등록 시설');span.append(small);arrow.textContent='↗';b.append(span,arrow);b.addEventListener('click',()=>showFacility(f.id));$('facility-list').append(b);}
}
function closestConnection(){
 if(blocked())return null;let best=null,distance=1.8;
 for(const c of connections){if(c.from.floor!==self.floor)continue;const p=c.from.point,d=Math.hypot(self.x-p[0],self.z-p[2]);if(d<=distance&&traversable(indexes[self.floor],[self.x,self.z],[p[0],p[2]])&&validPoint(indexes[c.to.floor],c.to.point[0],c.to.point[2])){best=c;distance=d;}}
 return best;
}
async function rideConnection(){
 const c=closestConnection();if(!c||moveBusy||travelling())return;clearInput();moveBusy=true;updateFloorControls();
 try{const travel={id:c.id,path:c.actualpath,elapsedMs:0,durationMs:travelDuration(c.actualpath)};await presence.moveTo({floor:c.to.floor,point:c.to.point,move:{kind:'connection',id:c.id},travel});toast(floorLabel(c.to.floor)+'으로 등록된 연결을 따라 이동합니다.');}
 catch(e){toast(e.message||'층간 연결 위치를 다시 확인해 주세요.');}
 finally{moveBusy=false;updateFloorControls();}
}
function connectionUI(now){
 const ride=closestConnection();if(ride?.id!==nearConnection?.id||ride?.to.floor!==nearConnection?.to.floor){nearConnection=ride;if(ride){$('ride-name').textContent=ride.type==='stairs'?'계단':ride.type==='elevator'?'엘리베이터':'에스컬레이터';$('ride-floor').textContent='등록 연결 · '+floorLabel(ride.from.floor)+' → '+floorLabel(ride.to.floor);}}
 $('connection-prompt').hidden=!ride;const travel=travelling();$('travel-status').hidden=!travel&&!moveBusy;if(travel)$('travel-status').textContent=floorLabel(self.floor)+'으로 이동 중 · '+Math.max(1,Math.ceil((self.travel.durationMs-elapsed(self.travel,now))/1000))+'초';else if(moveBusy)$('travel-status').textContent='이동 위치를 확인하고 있어요…';
}
function renderLabels(people){
 const positions=world.labels(people),visible=new Set();for(const p of positions){if(p.self)continue;visible.add(p.id);let el=labels.get(p.id);if(!el){el=document.createElement('span');el.className='name-label'+(p.npc?' npc':'');el.textContent=p.npc?'모의 산책자':'여행자 '+p.id.slice(-4).toUpperCase();$('name-labels').append(el);labels.set(p.id,el);}el.hidden=!p.visible;el.style.left=p.x+'px';el.style.top=p.y+'px';}
 for(const [id,el]of labels)if(!visible.has(id)){el.remove();labels.delete(id);}
}
function initNpc(){
 npcs=[];for(const [floor,ix]of Object.entries(indexes)){const cells=ix.nodes.filter(i=>validPoint(ix,hall.walk.points[i][0],hall.walk.points[i][2]));for(let i=0;i<3&&cells.length;i++){const p=hall.walk.points[cells[(i*73+24)%cells.length]];npcs.push({id:'npc-'+floor+'-'+i,npc:true,floor,x:p[0],y:p[1],z:p[2],yaw:0,color:0,pose:'idle',moving:false,path:[],target:0,nextPlan:0});}}
}
function visualPerson(person,now){
 if(!person.travel)return person;const sampled=sampleTravel(person.travel,elapsed(person.travel,now));return sampled?{...person,...sampled,moving:true,jump:0,inTransit:true}:person;
}
let previous=0,recordAt=0;
function frame(now){
 raf=requestAnimationFrame(frame);if(document.hidden){previous=now;return;}const dt=Math.min(.05,Math.max(0,(now-previous)/1000));previous=now;const time=now/1000;
 if(self.travel&&elapsed(self.travel,now)>=self.travel.durationMs){const last=sampleTravel(self.travel,self.travel.durationMs);if(last)self.yaw=last.yaw;self.travel=null;world.invalidate();updateFloorControls();}
 let dx=0,dz=0;if(!blocked()&&presence.canMove()){
  const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-stick.y,side=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+stick.x;
  if(keys.has('ArrowLeft'))self.yaw-=dt*1.8;if(keys.has('ArrowRight'))self.yaw+=dt*1.8;
  const length=Math.max(1,Math.hypot(forward,side)),speed=keys.has('ShiftLeft')||keys.has('ShiftRight')?3.4:2.6;
  dx=(Math.sin(self.yaw)*forward+Math.cos(self.yaw)*side)/length*dt*speed;dz=(-Math.cos(self.yaw)*forward+Math.sin(self.yaw)*side)/length*dt*speed;
 }
 const ix=indexes[self.floor],[x,z]=dx||dz?slide(ix,self.x,self.z,dx,dz):[self.x,self.z];self.moving=Math.hypot(x-self.x,z-self.z)>.0001;self.x=x;self.z=z;self.y=groundAt(ix,x,z);self.yaw=Math.atan2(Math.sin(self.yaw),Math.cos(self.yaw));
 if(self.moving||now>poseUntil)self.pose='idle';const age=(now-jumpAt)/1000;self.jump=!travelling()&&age>=0&&age<.65?Math.sin(age/.65*Math.PI)*.55:0;
 if(now-recordAt>120){if(!self.travel)presence.record(self.x,self.z,self.floor);recordAt=now;}presence.update(now);
 const people=[visualPerson(self,now)],alive=new Set();for(const p of presence.peers(now)){
  alive.add(p.id);let r=remote.get(p.id);if(!r||r.floor!==p.floor){r={...p,y:p.y??groundAt(indexes[p.floor],p.x,p.z)};remote.set(p.id,r);}const gap=Math.hypot(r.x-p.x,r.z-p.z);r.x+=(p.x-r.x)*Math.min(1,dt*6);r.z+=(p.z-r.z)*Math.min(1,dt*6);r.y=p.y??groundAt(indexes[p.floor],p.x,p.z);r.yaw+=shortAngle(r.yaw,p.yaw)*Math.min(1,dt*7);r.color=p.color;r.pose=p.pose;r.moving=gap>.05;r.jump=p.pose==='jump'?.28:0;r.travel=p.travel?{...p.travel,receivedAt:p.receivedAt,fromFloor:Object.keys(hall.floors).sort((a,b)=>Math.abs(hall.floors[a].height-p.travel.path[0][1])-Math.abs(hall.floors[b].height-p.travel.path[0][1]))[0],toFloor:p.floor}:null;people.push(visualPerson(r,now));
 }for(const id of remote.keys())if(!alive.has(id))remote.delete(id);
 if(npcsOn)for(const n of npcs){
  if(n.floor!==self.floor)continue;const ni=indexes[n.floor];if((!n.path.length||n.target>=n.path.length)&&time>=n.nextPlan){const goal=ni.nodes[Math.floor((time*.07+Number(n.id.at(-1))*.197)%1*ni.nodes.length)];n.path=pathTo(ni,nearestCell(ni,n.x,n.z),goal);n.target=1;n.nextPlan=time+4;}
  const p=n.path[n.target];n.moving=!!p;if(p){const dist=Math.hypot(p[0]-n.x,p[2]-n.z),step=Math.min(dist,dt*.85);if(dist>.01){n.yaw=Math.atan2(p[0]-n.x,-(p[2]-n.z));n.x+=(p[0]-n.x)/dist*step;n.z+=(p[2]-n.z)/dist*step;n.y=groundAt(ni,n.x,n.z);}if(dist<.08)n.target++;}people.push(n);
 }
 const active=self.moving||self.jump>0||self.pose==='wave'||!!self.travel||people.some(p=>!p.self&&(p.moving||p.pose==='wave'||p.pose==='jump'||p.travel))||npcsOn;
 try{world.tick({self:people[0],people,time,dt,active});renderLabels(people);connectionUI(now);}catch(e){cancelAnimationFrame(raf);presence.leave();$('loading').hidden=false;$('loading-note').textContent='3D 화면을 계속 그리지 못했어요. 다시 불러와 주세요.';$('retry').hidden=false;console.error('서울역 렌더링 실패',e);}
}
function inputs(){
 const isTyping=e=>e.target?.closest?.('input,textarea,select,[contenteditable=true]');
 window.addEventListener('keydown',e=>{if(isTyping(e)||blocked()||(['Enter','Space'].includes(e.code)&&e.target?.closest?.('button,a,[role=button]')))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','Digit1','Digit2','Digit3','Digit4','Enter'].includes(e.code))e.preventDefault();keys.add(e.code);if(!e.repeat){if(e.code==='Space')jump();if(e.code==='Enter')rideConnection();if(e.code==='Digit1')pose('wave');if(e.code==='Digit2')pose('bow');if(e.code==='Digit3')pose('cheer');if(e.code==='Digit4')pose('sit');}});
 window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',clearInput);
 const canvas=world.canvas;
 canvas.addEventListener('pointerdown',e=>{if(!entered||moveBusy||travelling()||document.querySelector('dialog[open]')||look.pointer!==null||e.button!==0)return;look.pointer=e.pointerId;look.x=look.startX=e.clientX;look.y=look.startY=e.clientY;canvas.setPointerCapture(e.pointerId);canvas.focus?.();});
 canvas.addEventListener('pointermove',e=>{if(look.pointer!==e.pointerId)return;if(!overview){self.yaw+=(e.clientX-look.x)*.006;self.pitch=clamp(self.pitch+(e.clientY-look.y)*.003,-.6,.9);world.invalidate();}look.x=e.clientX;look.y=e.clientY;});
 const up=e=>{if(look.pointer!==e.pointerId)return;if(Math.hypot(e.clientX-look.startX,e.clientY-look.startY)<7)world.pick(e.clientX,e.clientY);look.pointer=null;};canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',()=>look.pointer=null);
 canvas.addEventListener('wheel',e=>{if(!entered||moveBusy||travelling())return;e.preventDefault();world.setDistance(e.deltaY*.004);},{passive:false});
 const pad=$('move-pad'),moveStick=e=>{if(stick.pointer!==e.pointerId)return;const r=pad.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,n=Math.max(1,Math.hypot(x,y)/32);stick.x=x/n/32;stick.y=y/n/32;$('stick').style.transform=`translate(${x/n}px,${y/n}px)`;};
 pad.addEventListener('pointerdown',e=>{if(blocked()||stick.pointer!==null)return;e.preventDefault();stick.pointer=e.pointerId;pad.setPointerCapture(e.pointerId);moveStick(e);});pad.addEventListener('pointermove',moveStick);const release=e=>{if(e.pointerId===stick.pointer){stick.pointer=null;stick.x=stick.y=0;$('stick').style.transform='';}};pad.addEventListener('pointerup',release);pad.addEventListener('pointercancel',release);
}
async function boot(){
 try{
  const responses=await Promise.all(['/data/commons/hall.json','/data/commons/architecture.json','/data/commons/custom.json'].map(url=>fetch(url,{cache:'no-cache'})));if(responses.some(r=>!r.ok))throw Error('공간 자료를 불러오지 못했어요.');[hall,architecture,custom]=await Promise.all(responses.map(r=>r.json()));if(architecture.hallVersion!==hall.version||custom.hallVersion!==hall.version)throw Error('공간 자료의 버전이 다릅니다. 새로 열어 주세요.');indexes=makeIndexes(hall,architecture,custom);$('revision').textContent=hall.revision;
  const spawn=hall.floors['2F'].spawn;self.x=spawn[0];self.y=spawn[1];self.z=spawn[2];collectPlaces();connections=directedConnections(hall);
  world=await createCommonsWorld({host:$('scene'),hall,architecture,custom,indexes,onFacility:showFacility,onPosition:requestPosition,onError:toast,onStats:s=>{$('stats').textContent=`${s.renders} 렌더/초 · 화면 루프 ${s.fps}Hz\n${s.drawCalls} draw calls · ${s.triangles.toLocaleString()} 삼각형\n텍스처 ${s.textures} · 도형 ${s.geometries}\n${floorLabel(self.floor)} · ${self.moving?'이동':'정지'} · (${self.x.toFixed(1)}, ${self.z.toFixed(1)})m\n정지 중에는 필요할 때만 렌더링`;}});
  world.setFloor(self.floor);world.setOverview(true);presence=createPresence({version:hall.version+':'+architecture.version+':'+custom.version,getSelf:()=>self,onState:roomState,onReconcile,onNotice:toast});initNpc();inputs();renderFacilityList();updateFloorControls();
  $('loading').hidden=true;roomState({connected:false});previous=performance.now();raf=requestAnimationFrame(frame);if(invite)openRoom();
 }catch(e){$('loading-note').textContent=e.message||'이 기기에서 3D 공간을 준비하지 못했어요.';$('retry').hidden=false;}
}
$('start').addEventListener('click',start);$('retry').addEventListener('click',()=>location.reload());$('open-room').addEventListener('click',openRoom);
$('join-room').addEventListener('click',async()=>{const b=$('join-room');b.disabled=true;$('room-error').textContent='';try{await presence.join(invite,self.color);$('room-dialog').close();start();toast('공유방에 입장했어요. 초대 링크를 나눠 보세요.');}catch(e){$('room-error').textContent=e.message;}finally{b.disabled=false;}});
$('leave-room').addEventListener('click',()=>{presence.leave();$('room-dialog').close();toast('공유방에서 나왔어요. 혼자 산책을 계속할 수 있어요.');});
$('copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('invite-link').value);toast('초대 링크를 복사했어요.');}catch{$('invite-link').select();toast('링크를 선택했어요. 복사해서 공유해 주세요.');}});
PALETTE.forEach((c,i)=>{const b=document.createElement('button');b.style.background=c;b.setAttribute('aria-label','아바타 색상 '+(i+1));b.setAttribute('aria-pressed',String(i===0));b.addEventListener('click',()=>{if(room){toast('공유방을 나간 뒤 색상을 바꿀 수 있어요.');return;}self.color=i;for(const [j,el]of [...$('colors').children].entries())el.setAttribute('aria-pressed',String(i===j));world?.invalidate();});$('colors').append(b);});
for(const b of document.querySelectorAll('[data-close]'))b.addEventListener('click',()=>$(b.dataset.close).hidden=true);
for(const b of document.querySelectorAll('[data-close-dialog]'))b.addEventListener('click',()=>$(b.dataset.closeDialog).close());
for(const id of ['about-open','help-open'])$(id).addEventListener('click',()=>{clearInput();$('help-dialog').showModal();});
for(const b of document.querySelectorAll('[data-floor]'))b.addEventListener('click',()=>{const f=b.dataset.floor,p=hall.floors[f].spawn,node=nearestCell(indexes[f],p[0],p[2]);if(node>=0)moveNode(hall.walk.pointIds[node],{walk:!overview,message:floorLabel(f)+' 시작 위치로 이동했어요.'});});
for(const b of document.querySelectorAll('[data-list-floor]'))b.addEventListener('click',()=>{listFloor=b.dataset.listFloor;for(const button of document.querySelectorAll('[data-list-floor]'))button.setAttribute('aria-pressed',String(button===b));renderFacilityList();});
$('confirm-position').addEventListener('click',async()=>{const b=$('confirm-position');b.disabled=true;const id=selectedPosition;$('position-dialog').close();try{await moveNode(id,{message:'선택한 보행 위치로 이동했어요.'});}finally{b.disabled=false;}});
$('facilities-open').addEventListener('click',()=>{$('facility-info').hidden=true;$('facility-panel').hidden=!$('facility-panel').hidden;clearInput();});
$('facility-move').addEventListener('click',async()=>{const facility=selected,target=facility&&nodeForFacility(facility),asset=facility&&custom.assets.find(a=>a.id===facility.assetId),focus=facility?.reference?.focus,size=asset?.size||[focus?.surfaceWidth,0,focus?.surfaceHeight];if(target&&await moveNode(target.id,{face:asset?.position||facility.point,faceSize:size,message:facility.name+' · 시설을 바라보는 위치로 이동했어요.'}))$('facility-info').hidden=true;});
$('facility-route').addEventListener('click',()=>{const target=selected&&nodeForFacility(selected);if(!target)return;const route=world.routeTo(self.floor,self.x,self.z,{...selected,access:target.point});if(route){start();$('facility-info').hidden=true;toast(route.connections?.length?'길을 표시했어요. 층간 등록 연결 앞에서 이동 버튼을 누르세요.':'현재 층의 보행 경로를 표시했어요.');}else toast('현재 위치에서 이어진 경로가 없어요. 가까운 위치로 이동 기능을 이용해 주세요.');});
$('ride-connection').addEventListener('click',rideConnection);
$('view-toggle').addEventListener('click',()=>{if(!moveBusy&&!travelling())view(!overview);});$('light-toggle').addEventListener('click',()=>{$('light-toggle').innerHTML=world.light()?'☾ <span>노을</span>':'☀ <span>주광</span>';});
$('npc-toggle').addEventListener('click',()=>{npcsOn=!npcsOn;$('npc-toggle').setAttribute('aria-pressed',String(npcsOn));$('npc-toggle').innerHTML=`♙ <span>모의 산책자 ${npcsOn?'켬':'끔'}</span>`;world.invalidate();});
$('stats-toggle').addEventListener('click',()=>{$('stats').hidden=!$('stats').hidden;$('stats-toggle').setAttribute('aria-expanded',String(!$('stats').hidden));});
$('jump').addEventListener('pointerdown',e=>{e.preventDefault();jump();});$('jump').addEventListener('click',jump);$('wave').addEventListener('click',()=>pose('wave'));
$('pose-open').addEventListener('click',()=>{$('pose-menu').hidden=!$('pose-menu').hidden;$('pose-open').setAttribute('aria-expanded',String(!$('pose-menu').hidden));});for(const b of document.querySelectorAll('[data-pose]'))b.addEventListener('click',()=>pose(b.dataset.pose));
window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);presence?.dispose();world?.dispose();},{once:true});
boot();

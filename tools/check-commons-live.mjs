// Disposable second participant for the floor/node/connection presence protocol.
// Loopback preview only. No map edits and no credentials written to output/files.
import hall from '../public/data/commons/hall.json' with {type:'json'};
import architecture from '../public/data/commons/architecture.json' with {type:'json'};
import custom from '../public/data/commons/custom.json' with {type:'json'};
import assert from 'node:assert/strict';
import {SPAWN,makeIndexes,nearestCell,validPoint,relocationNode,directedConnections,travelDuration} from '../src/commons-core.js';
const [origin,room]=process.argv.slice(2);if(origin!=='http://127.0.0.1:4210'||!/^[a-f0-9]{24}$/.test(room||''))throw Error('허용된 4210 임시 서버와 실제 UI의 공유방 ID가 필요합니다.');
const post=async(action,data,token)=>{const r=await fetch(origin+'/api/commons/'+action,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data),signal:AbortSignal.timeout(3000)}),v=await r.json();if(!r.ok)throw Error('공유방 '+action+' 확인 실패 ('+r.status+'): '+(v.error||'응답을 확인하세요.'));return v;};
const indexes=makeIndexes(hall,architecture,custom),version=[hall.version,architecture.version,custom.version].join(':');
const nodeAt=(floor,x,z)=>{const node=nearestCell(indexes[floor],x,z),id=hall.walk.pointIds[node],registered=relocationNode(hall,indexes,id);if(!registered||registered.floor!==floor)throw Error(floor+'의 유효한 등록 이동 지점을 찾지 못했습니다.');return registered;};
const near2F=nodeAt('2F',SPAWN[0]+2,SPAWN[1]),spawn3F=hall.floors['3F'].spawn,near3F=nodeAt('3F',spawn3F[0],spawn3F[2]);
const allowed=directedConnections(hall).filter(c=>indexes[c.from.floor]&&indexes[c.to.floor]&&validPoint(indexes[c.from.floor],c.from.point[0],c.from.point[2])&&validPoint(indexes[c.to.floor],c.to.point[0],c.to.point[2])&&relocationNode(hall,indexes,hall.walk.pointIds[c.from.node])&&c.actualpath?.length>1);
const up=allowed.find(c=>c.from.floor==='2F'&&c.to.floor==='3F'&&c.id.includes('F02MV007-4'))||allowed.find(c=>c.from.floor==='2F'&&c.to.floor==='3F');
if(!up)throw Error('통과할 수 있는 2층→3층 등록 연결이 없습니다.');
const down=allowed.filter(c=>c.from.floor==='3F'&&c.to.floor==='2F').sort((a,b)=>Math.hypot(a.from.point[0]-up.to.point[0],a.from.point[2]-up.to.point[2])-Math.hypot(b.from.point[0]-up.to.point[0],b.from.point[2]-up.to.point[2]))[0];
if(!down)throw Error('복귀할 수 있는 3층→2층 등록 연결이 없습니다.');

let member=null,seq=0,current=null,travelEnds=0,travelCount=0,nodeCount=0,syncCount=0,maxPeers=0;
const seenFloors=new Set(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function sync(move=null){
 const result=await post('sync',{room,id:member.id,seq:seq+1,floor:current.floor,x:current.x,z:current.z,yaw:.6,pose:syncCount%8<4?'wave':'idle',path:[],...(move?{move}:{})},member.token);
 assert.equal(result.seq,seq+1,'동기화 순서가 일치해야 합니다.');assert.equal(result.floor,current.floor,'서버의 층이 일치해야 합니다.');
 assert(Math.hypot(result.position[0]-current.x,result.position[1]-current.z)<.003,'서버의 위치가 일치해야 합니다.');
 const self=result.peers.find(p=>p.id===member.id);assert(self&&self.floor===current.floor,'공유된 참가자 정보에 같은 층이 보여야 합니다.');
 seq=result.seq;syncCount++;seenFloors.add(result.floor);maxPeers=Math.max(maxPeers,result.peers.length);return result;
}
async function moveNode(node,label){
 assert(Date.now()>=travelEnds,'층간 여행이 끝난 뒤 위치를 옮겨야 합니다.');
 current={floor:node.floor,x:node.point[0],z:node.point[2]};await sync({kind:'node',id:node.id});nodeCount++;
 console.log(label+' · '+node.floor+' 등록 지점 이동 확인');
}
async function cross(connection,label){
 assert.equal(current.floor,connection.from.floor);assert(Math.hypot(current.x-connection.from.point[0],current.z-connection.from.point[2])<.003,'실제 접속점에서 출발해야 합니다.');
 current={floor:connection.to.floor,x:connection.to.point[0],z:connection.to.point[2]};const result=await sync({kind:'connection',id:connection.id});
 assert.equal(result.travel?.id,connection.id,'서버의 실제 여행 경로가 있어야 합니다.');assert.deepEqual(result.travel.path,connection.actualpath);assert.equal(result.travel.durationMs,travelDuration(connection.actualpath));
 assert(result.peers.find(p=>p.id===member.id)?.travel?.id===connection.id,'다른 참가자에게도 여행 경로가 전달되어야 합니다.');
 travelEnds=Date.now()+result.travel.durationMs-result.travel.elapsedMs;travelCount++;
 console.log(label+' · '+connection.id+' · '+connection.from.floor+'→'+connection.to.floor+' 여행 표시 확인');
}
try{
 member=await post('join',{room,color:1});current={floor:member.floor,x:member.position[0],z:member.position[1]};
 assert.equal(member.version,version,'공간 자료가 다릅니다. 로컬 미리보기 서버와 UI의 새 공유방을 준비해 주세요.');
 assert(member.peers.length>=2,'UI 참가자가 접속해 있는 실제 공유방이 필요합니다.');maxPeers=member.peers.length;
 console.log('독립 시험 접속자 입장: 총 '+member.peers.length+'명. 45회, 약 57초 동안 층·위치·층간 여행을 확인합니다.');
 const started=Date.now();
 for(let i=0;i<45;i++){
  await sleep(1250);
  if(i===0)await moveNode(near2F,'① UI 근처에서 손 흔들기');
  else if(i===6)await moveNode(near3F,'② 다른 층 참가자 표시');
  else if(i===12)await moveNode(relocationNode(hall,indexes,hall.walk.pointIds[up.from.node]),'③ 상행 접속점 도착');
  else if(i===17)await cross(up,'④ 실제 상행 연결 통과');
  else if(i===27)await moveNode(relocationNode(hall,indexes,hall.walk.pointIds[down.from.node]),'⑤ 하행 접속점 도착');
  else if(i===30)await cross(down,'⑥ 실제 하행 연결 통과');
  else if(i===40)await moveNode(near2F,'⑦ UI 근처로 복귀');
  else await sync();
  if([5,11,16,23,29,36,44].includes(i))console.log('공유 상태 '+syncCount+'/45회 · '+current.floor+' · 최대 '+maxPeers+'명 · 연결 유지 중');
 }
 assert.deepEqual([...seenFloors].sort(),['2F','3F']);assert.equal(nodeCount,5);assert.equal(travelCount,2);assert.equal(syncCount,45);
 console.log('검증 완료: 2F·3F 위치 이동 5회, 실제 층간 연결 2회, 동기화 45회 · '+Math.round((Date.now()-started)/1000)+'초');
}catch(error){console.error('시험 확인 실패: '+error.message);process.exitCode=1;}
finally{
 if(member){try{const result=await post('leave',{room,id:member.id},member.token);assert(result.left);console.log('시험 접속자 퇴장 완료');}catch{console.error('시험 접속자 퇴장을 확인하지 못했습니다. 임시 접속은 heartbeat 중단 후 자동 만료됩니다.');process.exitCode=1;}}
}

import hall from '../public/data/commons/hall.json' with {type:'json'};
import architecture from '../public/data/commons/architecture.json' with {type:'json'};
import custom from '../public/data/commons/custom.json' with {type:'json'};
import {makeIndexes,groundAt,traversable,validPoint,POSES,PALETTE,SPAWN,directedConnections,relocationNode,travelDuration} from '../src/commons-core.js';
const indexes=makeIndexes(hall,architecture,custom),connections=directedConnections(hall),version=hall.version+':'+architecture.version+':'+custom.version,TTL=20*60_000,IDLE=20_000,DAY=86_400_000;
const limits={roomCapacity:20,activeRooms:5,activePlayers:100,newRoomsPerDay:30,syncIntervalMs:1200,roomLifetimeMs:TTL,idleMs:IDLE};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
const random=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),v=>v.toString(16).padStart(2,'0')).join('');
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),v=>v.toString(16).padStart(2,'0')).join('');
const roomId=s=>typeof s==='string'&&/^[a-f0-9]{24}$/.test(s),playerId=s=>typeof s==='string'&&/^[a-f0-9]{24}$/.test(s);
async function body(request){
 if(request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw Object.assign(Error('JSON 요청만 허용합니다.'),{status:415});
 if(+(request.headers.get('Content-Length')||0)>2048)throw Object.assign(Error('요청이 너무 큽니다.'),{status:413});
 let bytes=0,text='';const decoder=new TextDecoder();for await(const chunk of request.body||[]){bytes+=chunk.byteLength;if(bytes>2048)throw Object.assign(Error('요청이 너무 큽니다.'),{status:413});text+=decoder.decode(chunk,{stream:true});}text+=decoder.decode();
 try{const v=JSON.parse(text);if(!v||typeof v!=='object'||Array.isArray(v))throw Error();return v;}catch{throw Object.assign(Error('요청 형식을 확인하세요.'),{status:400});}
}
function travelFor(player,now){const c=connections.find(c=>c.id===player.transit&&c.to.floor===player.floor);if(!c)return undefined;const durationMs=travelDuration(c.actualpath),elapsedMs=Math.max(0,now-player.moved_at);return elapsedMs<durationMs?{id:c.id,path:c.actualpath,elapsedMs,durationMs}:undefined;}
const snapshot=async(db,room,now)=>((await db.prepare('SELECT id,x,z,yaw,pose,color,floor,transit,moved_at,last_seen AS seenAt FROM commons_players WHERE room_id=? AND last_seen>? ORDER BY joined_at LIMIT 20').bind(room,now-IDLE).all()).results||[]).map(p=>{const {transit,moved_at,...display}=p;return {...display,y:groundAt(indexes[p.floor],p.x,p.z),...(travelFor(p,now)?{travel:travelFor(p,now)}:{})};});
export async function commonsApi(request,env,now=Date.now()){
 const fixedClock=arguments.length>=3;
 const p=new URL(request.url).pathname;if(!p.startsWith('/api/commons/'))return null;
 if(env.COMMONS_DISABLED==='true')return json({error:'공유방 시험 운영이 일시 중지되었습니다.'},503);
 if(!['/api/commons/join','/api/commons/sync','/api/commons/leave'].includes(p))return json({error:'지원하지 않는 요청입니다.'},404);
 if(request.method!=='POST')return json({error:'POST 요청만 허용합니다.'},405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'같은 사이트에서만 공유방을 사용할 수 있습니다.'},403);
 if(!env.DB)return json({error:'공유방 저장소가 준비되지 않았습니다. 혼자 둘러보기는 사용할 수 있습니다.'},503);
 const db=env.DB;
 try{
  const v=await body(request);if(!fixedClock)now=Date.now();
  if(p.endsWith('/join')){
   if(Object.keys(v).some(k=>!['room','color'].includes(k))||v.room!==undefined&&!roomId(v.room)||!Number.isInteger(v.color)||v.color<0||v.color>=PALETTE.length)return json({error:'방 또는 아바타 설정을 확인하세요.'},400);
   // Bounded cleanup, only presence tables. Retain room creation timestamps for the rolling quota.
   await db.batch([db.prepare('DELETE FROM commons_players WHERE id IN (SELECT id FROM commons_players WHERE last_seen<? LIMIT 1000)').bind(now-IDLE),db.prepare('DELETE FROM commons_rooms WHERE id IN (SELECT id FROM commons_rooms WHERE created_at<? LIMIT 100)').bind(now-DAY)]);
   const room=v.room||random(12);
   if(!v.room){
    const added=await db.prepare('INSERT INTO commons_rooms (id,created_at,expires_at,scene_version) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM commons_rooms WHERE expires_at>?)<? AND (SELECT COUNT(*) FROM commons_rooms WHERE created_at>?)<? AND NOT EXISTS (SELECT 1 FROM commons_rooms WHERE created_at>?)').bind(room,now,now+TTL,version,now,limits.activeRooms,now-DAY,limits.newRoomsPerDay,now-5000).run();
    if(!added.meta.changes)return json({error:'공유방 시험 운영 한도에 도달했습니다. 잠시 후 다시 시도하거나 초대 링크로 입장하세요.',retryAfterMs:5000},429);
   }
   const r=await db.prepare('SELECT id,expires_at,scene_version FROM commons_rooms WHERE id=? AND expires_at>?').bind(room,now).first();
   if(!r)return json({error:'공유방이 만료되었거나 존재하지 않습니다.'},410);
   if(r.scene_version!==version)return json({error:'공간이 갱신되었습니다. 새 공유방을 만들어 주세요.'},409);
   const id=random(12),token=random(32),tokenHash=await hash(token);
   const inserted=await db.prepare("INSERT INTO commons_players (id,room_id,token_hash,joined_at,last_seen,seq,x,z,yaw,pose,color) SELECT ?,?,?,?,?,0,?,?,?,'idle',? WHERE EXISTS (SELECT 1 FROM commons_rooms WHERE id=? AND expires_at>? AND scene_version=?) AND (SELECT COUNT(*) FROM commons_players WHERE room_id=? AND last_seen>?)<? AND (SELECT COUNT(*) FROM commons_players WHERE last_seen>?)<?").bind(id,room,tokenHash,now,now,...SPAWN,Math.PI,v.color,room,now,version,room,now-IDLE,limits.roomCapacity,now-IDLE,limits.activePlayers).run();
   if(!inserted.meta.changes)return json({error:'공유방이 가득 찼습니다. 정원은 20명입니다.'},409);
   return json({room,id,token,seq:0,position:SPAWN,floor:'2F',y:groundAt(indexes['2F'],...SPAWN),yaw:Math.PI,expiresAt:r.expires_at,version,limits,peers:await snapshot(db,room,now),serverTime:now},201);
  }
  if(!roomId(v.room)||!playerId(v.id))return json({error:'접속 정보를 확인하세요.'},400);
  const token=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];if(!token)return json({error:'공유방 접속 권한이 없습니다.'},401);
  const tokenHash=await hash(token),who=await db.prepare('SELECT p.*,r.expires_at,r.scene_version FROM commons_players p JOIN commons_rooms r ON r.id=p.room_id WHERE p.id=? AND p.room_id=? AND p.token_hash=?').bind(v.id,v.room,tokenHash).first();
  if(!who)return json({error:'공유방 접속 권한이 없습니다.'},401);
  if(p.endsWith('/leave')){await db.prepare('DELETE FROM commons_players WHERE id=? AND room_id=? AND token_hash=?').bind(v.id,v.room,tokenHash).run();return json({left:true});}
  if(who.expires_at<=now||who.last_seen<=now-IDLE)return json({error:'접속 시간이 만료되었습니다. 공유방에 다시 입장하세요.'},410);
  if(who.scene_version!==version)return json({error:'공간이 갱신되었습니다. 다시 입장하세요.'},409);
  const index=indexes[who.floor],targetIndex=typeof v.floor==='string'&&['2F','3F'].includes(v.floor)?indexes[v.floor]:null;
  if(Object.keys(v).some(k=>!['room','id','seq','x','z','yaw','pose','path','floor','move'].includes(k))||!Number.isSafeInteger(v.seq)||v.seq<1||!targetIndex||!validPoint(targetIndex,v.x,v.z)||!Number.isFinite(v.yaw)||Math.abs(v.yaw)>Math.PI*2||!POSES.includes(v.pose)||v.path!==undefined&&(!Array.isArray(v.path)||v.path.length>32||v.path.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))||v.move!==undefined&&(!v.move||typeof v.move!=='object'||Array.isArray(v.move)||Object.keys(v.move).some(k=>!['kind','id'].includes(k))||!['node','connection'].includes(v.move.kind)||typeof v.move.id!=='string'||v.move.id.length>120))return json({error:'이동 또는 동작을 확인하세요.'},400);
  const current={seq:who.seq,position:[who.x,who.z],floor:who.floor,y:groundAt(index,who.x,who.z),...(travelFor(who,now)?{travel:travelFor(who,now)}:{})};
  if(v.seq!==who.seq+1)return json({error:'동기화 순서가 바뀌었습니다.',...current},409);
  if(v.path?.some(p=>!validPoint(index,...p)))return json({error:'출발 층의 보행 경로를 확인하세요.'},400);
  if(now-who.last_seen<900)return json({error:'동기화 간격이 너무 짧습니다.',retryAfterMs:1200},429);
  const inTravel=travelFor(who,now);if(inTravel&&(v.move||Math.hypot(v.x-who.x,v.z-who.z)>.02||v.floor!==who.floor))return json({error:'등록된 층간 경로로 이동 중입니다.',retryAfterMs:Math.ceil(inTravel.durationMs-inTravel.elapsedMs)},429);
  const allowed=Math.min(18,(now-who.last_seen)/1000)*4.2+.75;let connection=null,teleport=null;
  if(v.move?.kind==='node'){teleport=relocationNode(hall,indexes,v.move.id);if(!teleport||teleport.floor!==v.floor||Math.hypot(v.x-teleport.point[0],v.z-teleport.point[2])>.02)return json({error:'등록된 보행 지점으로만 위치를 옮길 수 있습니다.',...current},422);}
  else if(v.move?.kind==='connection'){connection=connections.find(c=>c.id===v.move.id&&c.from.floor===who.floor&&c.to.floor===v.floor);if(!connection||Math.hypot(v.x-connection.to.point[0],v.z-connection.to.point[2])>.02)return json({error:'연결 방향과 도착 지점을 확인하세요.',...current},422);const last=v.path?.at(-1)||[who.x,who.z];if(Math.hypot(last[0]-connection.from.point[0],last[1]-connection.from.point[2])>2.5)return json({error:'층간 접속점에 가까이 이동해 주세요.',...current},422);}
  else if(v.floor!==who.floor)return json({error:'등록된 층간 연결 또는 위치 이동을 사용하세요.',...current},422);
  const endpoint=connection?[connection.from.point[0],connection.from.point[2]]:[v.x,v.z],path=[[who.x,who.z],...(v.path||[]),endpoint];let distance=0,valid=true;
  for(let i=1;i<path.length;i++){distance+=Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]);if(!traversable(index,path[i-1],path[i]))valid=false;}
  if(!teleport&&(distance>allowed||!valid))return json({error:'보행 가능 영역 안에서 이동하세요.',...current},422);
  if(!fixedClock)now=Date.now();
  const transit=connection?.id||(teleport?'':who.transit),movedAt=connection?now:teleport?0:who.moved_at;
  const updated=await db.prepare('UPDATE commons_players SET x=?,z=?,yaw=?,pose=?,seq=?,last_seen=?,floor=?,transit=?,moved_at=? WHERE id=? AND room_id=? AND token_hash=? AND seq=? AND last_seen>? AND last_seen<=? AND EXISTS (SELECT 1 FROM commons_rooms WHERE id=? AND expires_at>? AND scene_version=?)').bind(v.x,v.z,v.yaw,v.pose,v.seq,now,v.floor,transit,movedAt,v.id,v.room,tokenHash,who.seq,now-IDLE,now-900,v.room,now,version).run();
  if(!updated.meta.changes)return json({error:'동기화 상태가 바뀌었습니다. 다시 연결해 주세요.'},409);
  const travel=travelFor({floor:v.floor,transit,moved_at:movedAt},now);
  return json({seq:v.seq,position:[v.x,v.z],floor:v.floor,y:groundAt(targetIndex,v.x,v.z),...(travel?{travel}:{}),peers:await snapshot(db,v.room,now),expiresAt:who.expires_at,serverTime:now});
 }catch(e){if(e.status)return json({error:e.message},e.status);return json({error:'공유방 연결이 일시 지연됩니다. 혼자 둘러보기로 계속할 수 있습니다.'},503);}
}

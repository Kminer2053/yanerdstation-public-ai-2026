// The visible password is a demonstration only. It NEVER grants manager privileges.
// Each browser receives a separate, persistent D1 draft; original S202103 is untouched.
import {validateDemoOverrides} from '../src/demo-records.js';
export const DEMO_PASSWORD='station2026';
const response=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
export async function demoApi(request,env,{seed,validation,sales,maxHourlySales,readBody,sameOrigin}){
  const u=new URL(request.url),p=u.pathname;
  if(!p.startsWith('/api/demo/'))return null;
  try{
    if(p==='/api/demo/sales'&&request.method==='GET'){
      const date=u.searchParams.get('date'),d=sales.dates.indexOf(date);if(d<0)return response({error:'2026년 7월 날짜를 선택하세요.'},400);
      return response({date,basis:sales.basis,public_demo:true,max_hourly_sales:maxHourlySales,stores:Object.fromEntries(Object.entries(sales.stores).map(([id,v])=>[id,{daily:v.daily[d],hourly:v.hourly[d],trend:v.daily,month:v.daily.reduce((a,b)=>a+(b??0),0),available_days:v.daily.filter(n=>n!==null).length}]))});
    }
    if(!['GET','HEAD'].includes(request.method)&&!sameOrigin(request))return response({error:'동일 사이트의 JSON 요청만 허용합니다.'},403);
    if(p==='/api/demo/login'&&request.method==='POST'){
      const input=await readBody(request,1000);if(input.password!==DEMO_PASSWORD)return response({error:'모달에 표시된 시연 비밀번호를 입력하세요.'},401);
      const id=crypto.randomUUID();return response({demo:true},200,{'Set-Cookie':'station-demo='+id+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000'+(u.protocol==='https:'?'; Secure':'')});
    }
    const id=request.headers.get('Cookie')?.match(/(?:^|;\s*)station-demo=([a-f0-9-]{36})(?:;|$)/)?.[1];
    if(p==='/api/demo/session')return response({demo:Boolean(id)});
    if(!id)return response({error:'시연 비밀번호를 입력하세요.'},401);
    if(!env.DB)throw Error('시연 저장소 연결 실패. 입력값을 유지하고 다시 시도하세요.');
    const key='demo:'+id;
    if(p==='/api/demo/records'&&request.method==='GET'){
      const r=await env.DB.prepare('SELECT revision,saved_at,body FROM workbench WHERE id=?').bind(key).first();
      return response(r?{revision:r.revision,saved_at:r.saved_at,overrides:JSON.parse(r.body)}:{revision:0,overrides:{}});
    }
    if(p==='/api/demo/records'&&request.method==='PUT'){
      const input=await readBody(request,2_000_000),allowed=new Map();
      for(const kind of ['facilities','routes','connections','endpoints','origins'])for(const r of seed.data[kind]||[])if(r.active!==false)allowed.set(kind+':'+r.id,r);
      if(!Number.isInteger(input.revision)||!input.overrides||typeof input.overrides!=='object'||Array.isArray(input.overrides))return response({error:'입력 형식 오류'},400);
      const fields=['name','hours','contact','notes','facade_url','review','effective_date','methodology'];
      try{validateDemoOverrides(input.overrides,seed.data,validation);}catch(e){return response({error:e.message},400);}
      const now=new Date().toISOString(),op=crypto.randomUUID();
      await env.DB.prepare('INSERT OR IGNORE INTO workbench (id,revision,saved_at,body,operation_id) VALUES (?,?,?,?,?)').bind(key,0,now,'{}','demo-initial').run();
      const out=await env.DB.batch([
        env.DB.prepare('UPDATE workbench SET revision=?,saved_at=?,body=?,operation_id=? WHERE id=? AND revision=?').bind(input.revision+1,now,JSON.stringify(input.overrides),op,key,input.revision),
        env.DB.prepare('INSERT INTO audit (id,revision,actor,saved_at,kind,body) SELECT ?,revision,?,saved_at,?,body FROM workbench WHERE id=? AND operation_id=?').bind(op,key,'demo-records',key,op)
      ]);
      if(!out[0].meta.changes)return response({error:'다른 창에서 저장했습니다. 편집본을 내보내고 다시 불러오세요.'},409);
      return response({saved:true,revision:input.revision+1,saved_at:now,scope:'demo-copy'});
    }
    if(p==='/api/demo/points'&&request.method==='GET')return response(validation.points.filter(p=>p.record_kind==='walk_point').map(p=>[p.review_id,p.floor,...p.geometry.coordinates]));
    if(p==='/api/demo/register'&&request.method==='GET')return response(Object.fromEntries(['facilities','routes','connections','endpoints','origins'].map(k=>[k,(seed.data[k]||[]).filter(r=>r.active!==false)])));
    return response({error:'지원하지 않는 시연 요청입니다.'},404);
  }catch(e){return response({error:e.message},503);}
}

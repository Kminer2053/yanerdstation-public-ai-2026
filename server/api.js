import seed from './data/workbench-seed.json';
import sales from './data/sales.json';
import validation from './data/validation.json';
import {demoApi} from './demo.js';
import {toolkitResponse} from './toolkit.js';
import {modelConfigurations} from './toolkit-configurations.js';
import {validateWorkbench} from '../src/location-workbench-core.js';
const maxHourlySales=Math.max(1,...Object.values(sales.stores).flatMap(v=>v.hourly.flat()).filter(Number.isFinite));
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie, oai-authenticated-user-id','X-Content-Type-Options':'nosniff'};
export const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
export function identity(request,env){
  const id=request.headers.get('oai-authenticated-user-id');
  const allowed=String(env.MANAGER_USER_IDS||'').split(',').map(s=>s.trim()).filter(Boolean);
  return {authenticated:Boolean(id),manager:Boolean(id&&allowed.includes(id)),user_id:id||null,email:id?request.headers.get('oai-authenticated-user-email'):null,local:env.LOCAL_PREVIEW===true};
}
function database(env){if(!env.DB)throw Error('관리 저장소가 연결되지 않았습니다. 입력값을 보관한 뒤 다시 시도하세요.');return env.DB;}
// Reviewed base data stays compiled; administrator-approved reports are a separate live map layer.
async function getState(env){return {...seed,jury_locked:false,direct_save_locked:true,report_approval_required:true};}
function sameOrigin(req){return req.headers.get('Origin')===new URL(req.url).origin&&req.headers.get('Content-Type')?.split(';')[0]==='application/json';}
async function body(req,max=2_000_000){
  if(+(req.headers.get('Content-Length')||0)>max)throw Error('입력 데이터가 너무 큽니다.');
  let size=0,chunks=[];for await(const c of req.body||[]){size+=c.length;if(size>max)throw Error('입력 데이터가 너무 큽니다.');chunks.push(c);}const bytes=new Uint8Array(size);let p=0;for(const c of chunks){bytes.set(c,p);p+=c.length;}return JSON.parse(new TextDecoder().decode(bytes));
}
async function assetJSON(request,env,path){const r=await env.ASSETS.fetch(new Request(new URL(path,request.url)));if(!r.ok)throw Error('기준 데이터 연결 오류');return r.json();}
// Intro demo videos. The static host answers byte-range requests with the whole file, and Safari/iOS play only video
// that is served in ranges (206 Partial Content), so the worker serves the bundled files by range.
const MEDIA=/^\/api\/media\/(intro\/[a-z0-9-]+\.mp4)$/;
export async function mediaResponse(request,env,file){
  const head={'Content-Type':'video/mp4','Accept-Ranges':'bytes','Cache-Control':'public, max-age=604800','X-Content-Type-Options':'nosniff'};
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
  const asset=await env.ASSETS.fetch(new Request(new URL('/media/'+file,request.url)));
  if(!asset.ok)return new Response('Not found',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  const bytes=new Uint8Array(await asset.arrayBuffer()),size=bytes.length,body=b=>request.method==='HEAD'?null:b;
  const range=/^bytes=(\d*)-(\d*)$/.exec(request.headers.get('Range')||'');
  if(!range)return new Response(body(bytes),{headers:{...head,'Content-Length':String(size)}});
  const suffix=range[1]==='',start=suffix?Math.max(0,size-Number(range[2]||0)):Number(range[1]),end=suffix||range[2]===''?size-1:Math.min(size-1,Number(range[2]));
  if(suffix&&range[2]===''||!(start<=end&&start<size))return new Response(null,{status:416,headers:{...head,'Content-Range':'bytes */'+size}});
  return new Response(body(bytes.subarray(start,end+1)),{status:206,headers:{...head,'Content-Range':'bytes '+start+'-'+end+'/'+size,'Content-Length':String(end-start+1)}});
}
export async function api(request,env){
  const url=new URL(request.url),p=url.pathname,user=identity(request,env);
  const media=MEDIA.exec(p);if(media)return mediaResponse(request,env,media[1]);
  if(p==='/api/toolkit/seoul'){
    if(request.method!=='GET')return toolkitResponse(request,{error:'서울역 원본 설정은 직접 저장할 수 없습니다. 제보함에서 관리자 최종 승인 후 지도에 반영하세요.',jury_locked:false,direct_save_locked:true},423);
    try{
      const [catalog,graph,facades,methodology]=await Promise.all(['/data/experience/catalog.json','/data/experience/walk-graph.json','/data/jury-frozen/approved-facades.json','/data/experience/methodology.json'].map(path=>assetJSON(request,env,path)));
      return toolkitResponse(request,{site_id:'S202103',revision:seed.revision,jury_locked:false,direct_save_locked:true,report_approval_required:true,register:seed.data,catalog,graph,facades,methodology,model_configurations:modelConfigurations,validation_points:validation.points.filter(p=>!p.review_id.startsWith('GRID-'))});
    }catch(e){return toolkitResponse(request,{error:'서울역 확정본을 불러오지 못했습니다. '+e.message},503);}
  }
  const demo=await demoApi(request,env,{seed,validation,sales,maxHourlySales,readBody:body,sameOrigin});if(demo)return demo;
  if(p==='/api/session')return reply(user);
  if(p==='/api/catalog'&&request.method==='GET'){
    try{
      const catalog=await assetJSON(request,env,'/data/experience/catalog.json');
      const current=await getState(env);
      if(current.revision===seed.revision)return reply({...catalog,source:'compiled',editor_revision:current.revision,analysis_revision:seed.revision});
      const old=new Map(catalog.facilities.map(f=>[f.id,f])),points=new Map(validation.points.map(p=>[p.review_id,p]));
      const facilities=current.data.facilities.filter(f=>f.active).map(f=>{
        const before=old.get(f.id)||{},a=points.get(f.access_id)?.geometry?.coordinates,p=points.get(f.source_id)?.geometry?.coordinates;
        return {...before,...f,reference:before.reference||(Array.isArray(p)&&typeof p[0]==='number'?{lon:p[0],lat:p[1],height:p[2]}:null),access:a||null,products:before.products||[],store:before.store||null};
      });
      return reply({...catalog,facilities,endpoints:current.data.endpoints,editor_revision:current.revision,analysis_revision:seed.revision,analysis_stale:true});
    }catch(error){return reply({error:error.message},503)}
  }
  if(!p.startsWith('/api/management/')&&!p.startsWith('/__location_workbench/'))return null;
  if(!user.authenticated)return reply({error:'관리 기능은 ChatGPT 로그인이 필요합니다.'},401);
  if(!user.manager)return reply({error:'관리기업 계정의 접근 승인이 필요합니다.'},403);
  if(!['GET','HEAD'].includes(request.method)&&!sameOrigin(request))return reply({error:'동일 사이트의 JSON 요청만 허용합니다.'},403);
  if(!['GET','HEAD'].includes(request.method))return reply({error:'서울역 확정 원본의 직접 저장은 보호됩니다. 지도 변경은 제보함에서 관리자 최종 승인 후 반영하세요.',jury_locked:false,direct_save_locked:true},423);
  try{
    if(p==='/api/management/sales'&&request.method==='GET'){
      const date=url.searchParams.get('date'),d=sales.dates.indexOf(date);
      if(d<0)return reply({error:'2026년 7월 날짜를 선택하세요.'},400);
      return reply({date,basis:sales.basis,max_hourly_sales:maxHourlySales,stores:Object.fromEntries(Object.entries(sales.stores).map(([id,v])=>[id,{daily:v.daily[d],hourly:v.hourly[d],trend:v.daily,month:v.daily.reduce((a,b)=>a+(b??0),0),available_days:v.daily.filter(v=>v!==null).length}]))});
    }
    if(p==='/__location_workbench/state'){
      if(request.method==='GET')return reply(await getState(env));
      if(request.method!=='PUT')return reply({error:'지원하지 않는 요청입니다.'},405);
      const incoming=await body(request),data=validateWorkbench(incoming.data,validation);
      if(!Number.isInteger(incoming.revision))return reply({error:'리비전 형식을 확인하세요.'},400);
      const db=database(env),now=new Date().toISOString(),op=crypto.randomUUID(),next=incoming.revision+1;
      await db.prepare('INSERT OR IGNORE INTO workbench (id,revision,saved_at,body,operation_id) VALUES (?,?,?,?,?)').bind('S202103',seed.revision,seed.saved_at||now,JSON.stringify(seed.data),'initial').run();
      const result=await db.batch([
        db.prepare('UPDATE workbench SET revision=?,saved_at=?,body=?,operation_id=? WHERE id=? AND revision=?').bind(next,now,JSON.stringify(data),op,'S202103',incoming.revision),
        db.prepare('INSERT INTO audit (id,revision,actor,saved_at,kind,body) SELECT ?,revision,?,saved_at,?,body FROM workbench WHERE id=? AND operation_id=?').bind(op,user.user_id,'workbench','S202103',op)
      ]);
      if(!result[0].meta.changes)return reply({error:'다른 창에서 저장했습니다. 작업안을 백업하고 새로고침해 비교하세요.'},409);
      return reply({revision:next,saved_at:now,analysis_stale:true});
    }
    if(p==='/__location_workbench/source'&&request.method==='GET'){
      const m=await assetJSON(request,env,'/data/experience/methodology.json');
      const num=v=>v===''?null:Number(v);
      return reply({daily:m.daily.map(r=>({origin_id:r.origin_id,target_date:r.service_date,source_arrivals:num(r.arrivals),source_departures:num(r.departures),station_candidate_arrivals:num(r.station_candidate_arrivals),value_class:r.value_class})),summary:m.summary});
    }
    if(p==='/__location_workbench/hourly'&&request.method==='GET'){
      const id=url.searchParams.get('origin');if(!seed.data.origins.some(o=>o.id===id))return reply({error:'등록된 원점이 아닙니다.'},400);
      return reply(await assetJSON(request,env,'/data/experience/origins/'+encodeURIComponent(id)+'.json'));
    }
    if(p==='/api/management/audit'&&request.method==='GET')return reply((await database(env).prepare("SELECT id,revision,actor,saved_at,kind FROM audit WHERE kind != 'demo-records' ORDER BY saved_at DESC LIMIT 30").all()).results);
    if(p==='/api/management/note'){
      const id=url.searchParams.get('facility');if(!seed.data.facilities.some(f=>f.id===id))return reply({error:'등록된 시설이 아닙니다.'},400);
      if(request.method==='GET')return reply(await database(env).prepare('SELECT body,updated_at FROM facility_notes WHERE facility_id=?').bind(id).first()||{body:'',updated_at:null});
      if(request.method!=='PUT')return reply({error:'지원하지 않는 요청입니다.'},405);
      const input=await body(request,15000);if(typeof input.body!=='string'||input.body.length>5000)return reply({error:'메모는 5,000자 이하로 입력하세요.'},400);
      const now=new Date().toISOString();await database(env).prepare('INSERT INTO facility_notes (facility_id,body,updated_at,actor) VALUES (?,?,?,?) ON CONFLICT(facility_id) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at,actor=excluded.actor').bind(id,input.body,now,user.user_id).run();return reply({saved:true,updated_at:now});
    }
    return reply({error:'요청한 관리 기능이 없습니다.'},404);
  }catch(error){console.error('Management request failed',p,error.message);return reply({error:error.message||'저장하지 못했습니다. 입력값을 유지하고 다시 시도하세요.'},/형식|입력|선택|목록|경로|연결|리비전|중복/.test(error.message)?400:503)}
}

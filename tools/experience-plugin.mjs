import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
// Only this local adapter uses node:sqlite. Production uses the same API with D1.
export function experiencePlugin(){return {name:'station-experience-api',apply:'serve',configureServer(server){
  const dir=path.join(server.config.root,'data-private/experience');fs.mkdirSync(dir,{recursive:true});
  const sqlite=new DatabaseSync(path.join(dir,'preview.sqlite'));
  sqlite.exec('CREATE TABLE IF NOT EXISTS preview_migrations (name TEXT PRIMARY KEY)');
  for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())if(!sqlite.prepare('SELECT name FROM preview_migrations WHERE name=?').get(file)){
    sqlite.exec('BEGIN');try{sqlite.exec(fs.readFileSync('drizzle/'+file,'utf8'));sqlite.prepare('INSERT INTO preview_migrations VALUES (?)').run(file);sqlite.exec('COMMIT');}catch(e){sqlite.exec('ROLLBACK');throw e;}
  }
  const prepare=sql=>{let args=[];return {bind(...a){args=a;return this},async first(){return sqlite.prepare(sql).get(...args)||null},async all(){return {results:sqlite.prepare(sql).all(...args)}},async run(){return {meta:sqlite.prepare(sql).run(...args)}}}};
  const DB={prepare,async batch(statements){sqlite.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sqlite.exec('COMMIT');return out}catch(e){sqlite.exec('ROLLBACK');throw e}}};
  server.middlewares.use(async(req,res,next)=>{
    if(!/^\/(api|__location_workbench)(\/|$)/.test(req.url||''))return next();
    if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host||'')){res.statusCode=403;res.end('Local host required');return;}
    try{
      const {mapSource}=await server.ssrLoadModule('/server/map-source.js');
      if(req.url.startsWith('/api/map-source/')){
        const out=await mapSource(new Request('http://'+req.headers.host+req.url,{method:req.method}));
        res.statusCode=out.status;for(const [k,v]of out.headers)res.setHeader(k,v);res.end(Buffer.from(await out.arrayBuffer()));return;
      }
      const {api}=await server.ssrLoadModule('/server/api.js'),{commonsApi}=await server.ssrLoadModule('/server/commons.js'),chunks=[];let size=0;
      for await(const c of req){size+=c.length;if(size>2_000_000){res.statusCode=413;res.end();return}chunks.push(c);}
      const url='http://'+req.headers.host+req.url,headers=new Headers();
      for(const [k,v]of Object.entries(req.headers))if(v!==undefined)headers.set(k,Array.isArray(v)?v.join(','):v);
      const request=new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
      const ASSETS={async fetch(request){const u=new URL(request.url),file=path.resolve(server.config.root,'public','.'+u.pathname);if(!file.startsWith(path.resolve('public')+path.sep)||!fs.existsSync(file))return new Response('Not found',{status:404});return new Response(fs.readFileSync(file),{headers:{'Content-Type':'application/json'}})}};
      const localEnv={DB,ASSETS,MANAGER_USER_IDS:'local_seedy',LOCAL_PREVIEW:true};
      const out=await commonsApi(request,localEnv)||await api(request,localEnv);
      if(!out)return next();res.statusCode=out.status;for(const [k,v]of out.headers)res.setHeader(k,v);res.end(Buffer.from(await out.arrayBuffer()));
    }catch(e){server.config.logger.error(e.stack);res.statusCode=503;res.end(JSON.stringify({error:'로컬 관리 API 연결 실패'}));}
  });
}}}

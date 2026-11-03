import {readFileSync,existsSync,mkdirSync,writeFileSync,renameSync,copyFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {validateWorkbench,workbenchPoints} from '../src/location-workbench-core.js';
import {parseCsv} from './footfall-source-reader.mjs';

// Device-local editor persistence only. No public deployment/database writes.
export function locationWorkbenchPlugin(workspace=process.env.STATION_SOURCE_WORKSPACE,{storageDirectory}={}){
  return {name:'station-location-workbench',apply:'serve',configureServer(server){
    let context,contextVersion,hourly;
    const root=server.config.root,dir=storageDirectory||resolve(root,'data-private/location-workbench'),file=resolve(dir,'state.json');
    const read=path=>JSON.parse(readFileSync(path,'utf8'));
    function validation(){
      const paths=['register','grid-all','destinations','origin-entries'].map(n=>resolve(root,`public/data/route-review/${n}.json`));
      const version=paths.map(p=>{const s=statSync(p);return `${s.mtimeMs}:${s.size}`;}).join('|');
      if(!context||contextVersion!==version){const [data,grid,dest,origins]=paths.map(read);context={grid,points:workbenchPoints(data.register,dest,grid,origins)};contextVersion=version;}
      return context;
    }
    server.middlewares.use('/__location_workbench',async(req,res)=>{
      const reply=(code,data)=>{res.statusCode=code;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));};
      const url=new URL(req.url,'http://localhost');
      // Reject foreign origins and DNS rebinding. Dev server is loopback-only.
      if(!/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(req.headers.host||''))return reply(403,{error:'Local host required'});
      if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return reply(403,{error:'Same origin required'});
      try{
        if(url.pathname==='/hourly'&&req.method==='GET'){
          if(!workspace)return reply(503,{error:'원천 폴더가 연결되지 않았습니다.'});
          const origin=url.searchParams.get('origin');if(!origin||origin.length>120)return reply(400,{error:'원점 ID를 확인하세요.'});
          hourly??=parseCsv(readFileSync(resolve(workspace,'outputs/20260915_date_hour_footfall_69fd8c29/14_date_hour_flow.csv'),'utf8'));
          return reply(200,{rows:hourly.filter(r=>r.location_id===origin),note:'원천 운행일·운행시간을 그대로 표시합니다. 대체연도와 자정 이월을 대상연도 실측으로 변경하지 않습니다.'});
        }
        if(url.pathname==='/source'&&req.method==='GET'){
          if(!workspace)return reply(503,{error:'원천 데이터 작업폴더가 연결되지 않았습니다.'});
          const pool=read(resolve(workspace,'outputs/20260916_daily_origin_pool_d9ccb5ff/pool.json'));
          return reply(200,{daily:pool.daily,summary:pool.summary,origins:pool.origins});
        }
        if(url.pathname!=='/state')return reply(404,{error:'Unknown resource'});
        if(req.method==='GET')return reply(200,existsSync(file)?read(file):{revision:0,data:null});
        if(req.method!=='PUT')return reply(405,{error:'Unsupported method'});
        if(req.headers['content-type']!=='application/json'||req.headers['x-station-editor']!=='local')return reply(403,{error:'Editor request required'});
        const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>20_000_000)return reply(413,{error:'20MB 이하의 작업안을 사용하세요.'});chunks.push(chunk);}
        const input=JSON.parse(Buffer.concat(chunks).toString('utf8')),old=existsSync(file)?read(file):{revision:0};
        if(input.revision!==old.revision)return reply(409,{error:'다른 탭에서 저장되었습니다. 백업 후 새로고침해서 다시 확인하세요.'});
        const data=validateWorkbench(input.data,validation()),next={revision:old.revision+1,saved_at:new Date().toISOString(),data};
        mkdirSync(dir,{recursive:true});
        if(existsSync(file))copyFileSync(file,resolve(dir,`backup-${old.revision}.json`));
        writeFileSync(resolve(dir,'state.tmp'),JSON.stringify(next,null,2));renameSync(resolve(dir,'state.tmp'),file);
        reply(200,{revision:next.revision,saved_at:next.saved_at});
      }catch(error){reply(400,{error:error.message});}
    });
  }};
}

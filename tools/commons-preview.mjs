// Disposable, loopback-only commons preview. No production DB or upstream APIs are connected.
import http from 'node:http';
import {Readable} from 'node:stream';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {createServer as createViteServer} from 'vite';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const host='127.0.0.1',port=4210;
const temporary=await mkdtemp(path.join(tmpdir(),'station-commons-preview-'));
let sqlite,vite,server,closing=false;

async function close(){
  if(closing)return;closing=true;
  if(server?.listening){
    await new Promise(resolve=>{server.close(resolve);server.closeAllConnections?.();});
  }
  await vite?.close();
  sqlite?.close();
  // This directory was created by this process exclusively for its compiled preview module.
  await rm(temporary,{recursive:true,force:true});
}

function adapter(database){
  function prepare(sql){
    let args=[];
    return {
      bind(...values){args=values;return this;},
      async first(column){const row=database.prepare(sql).get(...args)||null;return column&&row?row[column]:row;},
      async all(){return {results:database.prepare(sql).all(...args),success:true};},
      run(){return {meta:database.prepare(sql).run(...args),success:true};},
    };
  }
  return {
    prepare,
    async batch(statements){
      database.exec('BEGIN');
      try{const results=statements.map(statement=>statement.run());database.exec('COMMIT');return results;}
      catch(error){database.exec('ROLLBACK');throw error;}
    },
  };
}

try{
  const entry=path.join(temporary,'commons-api.mjs');
  await build({entryPoints:[path.join(root,'server/commons.js')],outfile:entry,bundle:true,format:'esm',platform:'node',target:'node22',logLevel:'silent'});
  const {commonsApi}=await import(pathToFileURL(entry).href);
  sqlite=new DatabaseSync(':memory:');
  for(const name of (await readdir(path.join(root,'drizzle'))).filter(name=>name.endsWith('.sql')).sort()){
    sqlite.exec(await readFile(path.join(root,'drizzle',name),'utf8'));
  }
  const env={DB:adapter(sqlite)};
  vite=await createViteServer({
    configFile:false,root,publicDir:path.join(root,'public'),appType:'mpa',
    server:{middlewareMode:true,hmr:false,ws:false,fs:{strict:true,allow:[root]}},
  });
  server=http.createServer(async(request,response)=>{
    try{
      if(!request.url?.startsWith('/')){response.writeHead(400).end();return;}
      const authority=request.headers.host;
      if(authority!==`${host}:${port}`&&authority!==`localhost:${port}`){response.writeHead(403).end();return;}
      const url=new URL(request.url,`http://${authority}`);
      if(url.pathname.startsWith('/api/commons/')){
        const headers=new Headers();
        for(const [key,value]of Object.entries(request.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):value);
        const method=request.method||'GET';
        const input=new Request(url,{method,headers,...(!['GET','HEAD'].includes(method)?{body:Readable.toWeb(request),duplex:'half'}:{})});
        const result=await commonsApi(input,env);
        if(!result){response.writeHead(404).end();return;}
        response.writeHead(result.status,Object.fromEntries(result.headers));
        response.end(Buffer.from(await result.arrayBuffer()));
        return;
      }
      // Never let the preview invoke existing management, catalogue, session or remote-source APIs.
      if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/__')){
        response.writeHead(404,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
        response.end(JSON.stringify({error:'이 미리보기는 공유방 시험 API만 제공합니다.'}));
        return;
      }
      vite.middlewares(request,response,()=>{response.writeHead(404).end('미리보기 파일을 찾을 수 없습니다.');});
    }catch(error){
      console.error('미리보기 요청 실패:',error.message);
      if(!response.headersSent)response.writeHead(500,{'Content-Type':'application/json; charset=utf-8'});
      response.end(JSON.stringify({error:'로컬 미리보기 요청을 처리하지 못했습니다.'}));
    }
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
  console.log(`경량 서울역 미리보기: http://${host}:${port}/commons/`);
  console.log('공유방은 이 프로세스의 메모리 SQLite만 사용합니다. 종료하면 시험 접속 정보가 사라집니다.');
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{close().then(()=>process.exit(0),error=>{console.error('미리보기 종료 실패:',error.message);process.exit(1);});});
}catch(error){
  await close();
  console.error('미리보기를 시작하지 못했습니다:',error.message);
  process.exitCode=1;
}

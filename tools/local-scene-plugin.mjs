import {createReadStream,readFileSync,existsSync} from 'node:fs';
import {resolve,basename} from 'node:path';

// Development-only, read-only access to an existing snapshot. Never bundle source tiles.
export function localScenePlugin(workspace=process.env.STATION_SOURCE_WORKSPACE) {
  return {name:'station-local-scene',apply:'serve',configureServer(server){
    server.middlewares.use('/__local_scene', (req,res)=>{
      const fail=(code,message)=>{res.statusCode=code;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:message}));};
      if(!['GET','HEAD'].includes(req.method))return fail(405,'Read-only snapshot');
      if(!workspace)return fail(503,'STATION_SOURCE_WORKSPACE must point to the existing research workspace');
      const file=new URL(req.url,'http://localhost').pathname.slice(1);
      try{
        const snapshot=resolve(workspace,'outputs/20260831_vworld_seoul_image_catalog/source/tileset-snapshot.json');
        const tileRoot=resolve(workspace,'tmp/vworld-seoul-full-catalog/tiles');
        if(file==='tileset.json'||file==='status.json'){
          const data=JSON.parse(readFileSync(snapshot,'utf8').replace(/^\uFEFF/,'')),files=new Set();
          const walk=node=>{if(node.content){const key=node.content.uri?'uri':'url';const name=basename(node.content[key]||'');
            if(!/^B_\d+_\d+_\d+\.b3dm$/.test(name))throw Error('Unexpected snapshot content path');
            files.add(name);node.content[key]=`/__local_scene/${name}`;
          }for(const child of node.children||[])walk(child);};walk(data.root);
          const missing=[...files].filter(n=>!existsSync(resolve(tileRoot,n.replace('.b3dm','.bin'))));
          if(missing.length)return fail(503,`Incomplete snapshot: ${missing.length} missing tiles`);
          res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
          return res.end(req.method==='HEAD'?undefined:JSON.stringify(file==='status.json'?{site:'S202103',source:'local-snapshot',tiles:files.size,missing:0,live:false}:data));
        }
        if(!/^B_\d+_\d+_\d+\.b3dm$/.test(file))return fail(404,'Unknown local scene resource');
        const target=resolve(tileRoot,file.replace('.b3dm','.bin'));
        if(!existsSync(target))return fail(404,'Tile missing from snapshot');
        res.setHeader('Content-Type','application/octet-stream');res.setHeader('Cache-Control','private,max-age=3600');
        if(req.method==='HEAD')return res.end();
        createReadStream(target).on('error',()=>res.destroy()).pipe(res);
      }catch(error){fail(503,error.message);}
    });
  }};
}

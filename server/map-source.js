// Read-through transport, not a mirror: no credentials, writes or persistent cache.
// Only the two existing VWorld tilesets and their observed b3dm filenames are allowed.
const BASE='https://cdn.vworld.kr/TDServer/services/map4/7Iuk64K0/';
export async function mapSource(request, fetcher=fetch) {
  const u=new URL(request.url);
  if(!u.pathname.startsWith('/api/map-source/'))return null;
  const match=u.pathname.match(/^\/api\/map-source\/(S202103|S201801)\/(tileset\.json|B_\d+_\d+_\d+\.b3dm)$/);
  const json=(error,status)=>Response.json({error,stage:'upstream',source:'VWorld'},{status,headers:{'Cache-Control':'no-store'}});
  if(!match||u.search)return json('지원하지 않는 지도 리소스입니다.',400);
  if(!['GET','HEAD'].includes(request.method))return json('읽기 전용 지도 연결입니다.',405);
  const [,site,file]=match;
  try {
    const response=await fetcher(BASE+site+'/'+file,{method:request.method,redirect:'error',signal:AbortSignal.timeout(12000),headers:{Accept:file.endsWith('.json')?'application/json':'application/octet-stream'}});
    if(!response.ok)return json('브이월드 원본 응답 '+response.status,502);
    const headers={'Content-Type':file.endsWith('.json')?'application/json':'application/octet-stream','Cache-Control':'no-store','X-Map-Source':'VWorld-live-relay','X-Content-Type-Options':'nosniff'};
    if(request.method==='HEAD')return new Response(null,{headers});
    if(file!=='tileset.json')return new Response(response.body,{headers});
    const data=await response.json();
    function rewrite(node){
      if(node.content){const key=node.content.uri?'uri':'url',path=node.content[key];
        if(typeof path!=='string'||!/^B_\d+_\d+_\d+\.b3dm$/.test(path))throw Error('지원하지 않는 원본 타일 경로');
        node.content[key]='/api/map-source/'+site+'/'+path;
      }
      for(const child of node.children||[])rewrite(child);
    }
    if(!data.root)throw Error('지도 구성 정보 없음');rewrite(data.root);
    return Response.json(data,{headers});
  } catch(error) {return json(error.name==='TimeoutError'?'브이월드 원본 서버 연결 시간 초과':'브이월드 원본 서버에 연결할 수 없습니다.',504);}
}

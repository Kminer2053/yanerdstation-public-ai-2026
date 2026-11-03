// Public, reviewed configuration only. Never queries mutable production tables.
export function toolkitResponse(request, value, status=200) {
  const origin=request.headers.get('Origin');
  const allowed=new Set(['http://127.0.0.1:4197','http://localhost:4197','https://toolkit.yanerdstation.kr','https://ya-nerd-station.soalsebi.chatgpt.site']);
  const headers={'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  if(allowed.has(origin)){headers['Access-Control-Allow-Origin']=origin;headers.Vary='Origin';}
  return new Response(JSON.stringify(value),{status,headers});
}

import {api,identity} from './api.js';
import {mapSource} from './map-source.js';
export default {async fetch(request,env){
  const map=await mapSource(request);if(map)return map;
  const url=new URL(request.url),result=await api(request,env);if(result)return result;
  if(url.hostname==='seoul.yanerdstation.kr'&&url.pathname==='/'){
    const target=new URL(request.url);target.pathname='/seoul/';
    return Response.redirect(target.toString(),302);
  }
  if(/^\/(routes|catalog)(\/|$)/.test(url.pathname)){
    return Response.redirect('https://toolkit.yanerdstation.kr/?station=S202103',302);
  }
  const response=await env.ASSETS.fetch(request),headers=new Headers(response.headers);
  headers.set('Permissions-Policy','camera=(self), microphone=(), geolocation=()');
  headers.set('X-Content-Type-Options','nosniff');
  if(/^\/(routes|catalog)(\/|$)/.test(url.pathname))headers.set('Cache-Control','private,no-store');
  return new Response(response.body,{status:response.status,headers});
}};

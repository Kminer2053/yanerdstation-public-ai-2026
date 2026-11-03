import fs from 'node:fs';
import { feedbackRetirementStyleConditions } from '../app/seoul-feedback-retirement.js';
import { pergolaRetirementStyleConditions } from '../app/seoul-pergola-retirement.js';
import { informationCenterRetirementStyleConditions } from '../app/seoul-information-center.js';
import { loungeRetirementStyleConditions } from '../app/seoul-lounge-retirement.js';
import { loungeSignRetirementStyleConditions } from '../app/seoul-lounge-sign-retirement.js';
import { gtxBarricadeRetirementStyleConditions } from '../app/seoul-gtx-wall-photo.js';
import { RETIRED_INFORMATION_VOLUMES } from '../app/seoul-truedan.js';
import { STAIR_FRONT_SHOP_PRISM, INFORMATION_ZONE, informationZoneAxes, OBSOLETE_VWORLD_VOLUMES, OBSOLETE_VWORLD_PRISMS } from '../app/seoul-information-zone.js';

export const retirementFiles=['seoul-feedback-retirement.json','seoul-pergola-retirement.json','seoul-information-center.json','seoul-lounge-retirement.json','seoul-lounge-sign-retirement.json','seoul-gtx-wall-photo.json','seoul-s38-retirement.json','seoul-s11-retirement.json','seoul-celadon-retirement.json','seoul-wood-display-retirement.json','seoul-platform111-retirement.json','seoul-photobooth-retirement.json','seoul-dessert-banner-retirement.json'];
const read=name=>JSON.parse(fs.readFileSync(new URL('../app/'+name,import.meta.url)));
const clauses=[feedbackRetirementStyleConditions,pergolaRetirementStyleConditions,informationCenterRetirementStyleConditions,loungeRetirementStyleConditions,loungeSignRetirementStyleConditions,gtxBarricadeRetirementStyleConditions].flatMap(fn=>fn('S202103')).filter(([,show])=>show===false).map(([expression])=>{
  const pairs=[...expression.matchAll(/\$\{(FLOOR|MODEL_NAME|TD_ID)\}\s*===\s*'([^']+)'/g)].map(m=>[m[1],m[2]]);
  if(!pairs.length||expression.split('&&').length!==pairs.length)throw Error('Unrecognized retirement style '+expression);
  return pairs;
});
export const retiredWhole=metadata=>clauses.some(pairs=>pairs.every(([key,value])=>metadata[key]===value));
const masks=retirementFiles.flatMap(name=>{const d=read(name);return d.enabled===false?[]:(d.triangles||[]).map(t=>({...t,loose:/lounge-sign|photobooth/.test(name)}));});
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const coefficients=masks.map(t=>{const [a,b,c]=t.points,x=sub(b,a),y=sub(c,a),n=cross(x,y),xx=dot(x,x),yy=dot(y,y),xy=dot(x,y),den=xx*yy-xy*xy;return {...t,a,n:n.map(v=>v/Math.hypot(...n)),x,y,xx,yy,xy,den,min:[0,1,2].map(i=>Math.min(...t.points.map(p=>p[i]))-.003),max:[0,1,2].map(i=>Math.max(...t.points.map(p=>p[i]))+.003)};});
function match(t,p,uv){
  if(!uv||p.some((v,i)=>v<t.min[i]||v>t.max[i]))return false;
  const q=sub(p,t.a);if(Math.abs(dot(q,t.n))>(t.loose?.003:.002))return false;
  const u=(t.yy*dot(q,t.x)-t.xy*dot(q,t.y))/t.den,v=(t.xx*dot(q,t.y)-t.xy*dot(q,t.x))/t.den,eps=t.loose?.0002:1e-7;
  if(u < -eps||v < -eps||u+v>1+eps)return false;
  return uv.every((x,i)=>Math.abs(x-(t.uv[0][i]+u*(t.uv[1][i]-t.uv[0][i])+v*(t.uv[2][i]-t.uv[0][i])))<=(t.loose?2e-5:1e-5));
}
export function retiredTriangle(vs,uv){
  if(!uv?.every(Boolean))return false;
  const center=vs[0].map((_,i)=>(vs[0][i]+vs[1][i]+vs[2][i])/3),tc=uv[0].map((_,i)=>(uv[0][i]+uv[1][i]+uv[2][i])/3);
  const candidate=coefficients.filter(t=>match(t,center,tc));
  // All four samples must belong to the same exact original position+UV face mask.
  return candidate.some(t=>vs.every((p,i)=>match(t,p,uv[i])));
}

// Convex clipping preserves the visible portion of partially retired triangles.
export function clipPolygon(poly,signedDistance,inside=true){
  const out=[];if(!poly.length)return out;
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],da=signedDistance(a),db=signedDistance(b),aIn=inside?da>=0:da<0,bIn=inside?db>=0:db<0;
    if(aIn)out.push(a);
    if(aIn!==bIn){const t=da/(da-db);out.push(a.map((v,k)=>v+(b[k]-v)*t));}
  }return out;
}
const boxPlanes=(min,max,local=p=>p)=>[0,1,2].flatMap(i=>[p=>local(p)[i]-min[i],p=>max[i]-local(p)[i]]);
const axes=informationZoneAxes(),local=p=>{
  const x=p[0]-INFORMATION_ZONE.joint[0],y=p[1]-INFORMATION_ZONE.joint[1];
  return [x*axes.tangent[0]+y*axes.tangent[1],x*axes.normal[0]+y*axes.normal[1],p[2]];
};
const pr=STAIR_FRONT_SHOP_PRISM;
const banner=read('seoul-dessert-banner-retirement.json');
const volumes=[...RETIRED_INFORMATION_VOLUMES,...OBSOLETE_VWORLD_VOLUMES,...(banner.enabled?banner.banners.map(x=>x.broadPhaseBounds):[])].map(v=>boxPlanes(v.min,v.max));
volumes.push(boxPlanes([pr.xMin,pr.yMin,pr.zMin],[pr.xMax,pr.yMax,pr.zMax],local));
for(const v of OBSOLETE_VWORLD_PRISMS)volumes.push(boxPlanes(v.min,v.max,local));
function subtractConvex(poly,planes){
  if(planes.some(f=>poly.every(p=>f(p)<0)))return [poly];
  let remaining=poly;const visible=[];
  for(const distance of planes){const outside=clipPolygon(remaining,distance,false);if(outside.length>=3)visible.push(outside);remaining=clipPolygon(remaining,distance,true);if(!remaining.length)break;}
  return visible;
}
export function visibleFragments(vs){let polys=[vs];for(const planes of volumes)polys=polys.flatMap(poly=>subtractConvex(poly,planes));return polys.filter(p=>p.length>=3&&p.slice(1,-1).some((v,i)=>Math.hypot(...cross(sub(v,p[0]),sub(p[i+2],p[0])))>1e-9));}

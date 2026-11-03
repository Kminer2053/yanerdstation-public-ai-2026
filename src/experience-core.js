export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const int=v=>v===null||v===undefined?'미확보':new Intl.NumberFormat('ko-KR',{maximumFractionDigits:0}).format(v);
export const sum=a=>a.reduce((s,n)=>s+(Number(n)||0),0);
export const group=f=>/화장실/.test(f.name+f.category)?'화장실':/매장|식음|판매|편의점|카페|약국/.test(f.category+f.name)&&!/출입|입구/.test(f.name)?'매장':'안내·편의';
export function skyForHour(hour){if(hour<5||hour>=21)return {name:'밤',color:'#23324d',intensity:.8};if(hour<7||hour>=18)return {name:'노을',color:'#d8aa98',intensity:1.1};return {name:'낮',color:'#b6d4e0',intensity:1.35};}
export function coordinateDistance(a,b){const lat=(a[1]+b[1])*.5*Math.PI/180;return Math.hypot((b[0]-a[0])*111320*Math.cos(lat),(b[1]-a[1])*111320,b[2]-a[2]);}
export function makePath(points,floors=[]){const distances=[0];for(let i=1;i<points.length;i++)distances.push(distances.at(-1)+coordinateDistance(points[i-1],points[i]));return {points,floors,distances,length:distances.at(-1)};}
export function samplePath(path,distance){
  const d=Math.max(0,Math.min(distance,path.length));let low=0,high=path.distances.length-1;
  while(low+1<high){const m=(low+high)>>1;if(path.distances[m]<=d)low=m;else high=m;}
  const i=Math.min(low,path.points.length-2),a=path.points[i],b=path.points[i+1],length=path.distances[i+1]-path.distances[i],t=length?(d-path.distances[i])/length:0;
  return {point:a.map((v,k)=>v+(b[k]-v)*t),floor:t<.5?path.floors[i]:path.floors[i+1],index:i,t};
}
export function routeInstructions(route,connections){
  if(!route?.coordinates?.length)return [];
  const result=[],n=route.coordinates.length;let start=0;
  for(let i=1;i<n;i++)if(route.floors[i]!==route.floors[i-1]){if(i>start)result.push({kind:'walk',floor:route.floors[start],point:route.coordinates[start],metres:sum(route.coordinates.slice(start+1,i).map((p,k)=>coordinateDistance(route.coordinates[start+k],p)))});result.push({kind:'connection',from:route.floors[i-1],to:route.floors[i],point:route.coordinates[i-1],label:'층간 연결 · 실제 운행 방향 확인'});start=i;}
  if(n-1>start)result.push({kind:'walk',floor:route.floors[start],point:route.coordinates[start],metres:sum(route.coordinates.slice(start+1).map((p,k)=>coordinateDistance(route.coordinates[start+k],p)))});
  return result;
}
export function trafficStyle(value,max){const ratio=max>0?Math.max(0,Math.min(1,value/max)):0;return {ratio,width:2+6*Math.sqrt(ratio),color:ratio>.65?'#f39b4a':ratio>.3?'#13ac9a':'#52bfd6'};}
export function breakEven(fixed,costPct){if(!Number.isFinite(fixed)||fixed<0||!Number.isFinite(costPct)||costPct<0||costPct>=100)return null;return fixed/(1-costPct/100);}

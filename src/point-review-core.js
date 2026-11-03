import { makeFocus, locationPoint, REVIEW_FLOORS } from './route-review-core.js';

export const POINT_LAYERS = Object.freeze({
  od: { label:'출발·도착', color:'#43dc83', description:'유동인구의 진입·소멸점. 점 또는 영역으로 관리합니다.' },
  waypoint: { label:'경유포인트', color:'#ffffff', description:'바닥·장애물 검사를 통과한 격자 후보. 현장 검수 전에는 경로에 사용하지 않습니다.' },
  connector: { label:'층간접속', color:'#4299ff', description:'경유포인트의 하위 유형. 층별 랜딩과 상대 접속부를 별도 확인합니다.' },
  facility: { label:'시설포인트', color:'#ffd24a', description:'매장·주요시설의 체류 및 방문 목적지. 실제 출입점은 따로 지정합니다.' },
});
export const VERTICAL_TYPES = new Set(['계단','에스컬레이터','엘리베이터']);
export const CONNECTOR_ROLES = Object.freeze({
  A: {label:'A',color:'#22d3ee'},
  B: {label:'B',color:'#f472b6'},
  AB: {label:'A/B',color:'#b99cff'},
});
const pending = { user_approved:false, routing_enabled:false, surveyed:false };

// Screen-space decluttering changes labels only, never geographic point positions.
export function layoutConnectionLabels(markers,width,height){
  const occupied=[],result=new Map();
  for(const p of [...markers].sort((a,b)=>Number(b.selected)-Number(a.selected))){
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>width||p.y<0||p.y>height){result.set(p.id,{show:false});continue;}
    const text=p.compact&&!p.selected?p.label.split(' ')[0]:p.label,w=text.length*7.6+16,h=24;
    let placed;
    for(const dy of [-24,-50,-76]){
      for(const dx of [0,-48,48,-96,96]){
        const box={x:p.x+dx-w/2,y:p.y+dy-h/2,w,h};
        if(box.x<0||box.x+w>width||box.y<0||box.y+h>height)continue;
        if(occupied.some(b=>box.x<b.x+b.w&&box.x+w>b.x&&box.y<b.y+b.h&&box.y+h>b.y))continue;
        occupied.push(box);placed={show:true,text,dx,dy};break;
      }
      if(placed)break;
    }
    result.set(p.id,placed||{show:false});
  }
  return result;
}

export function reviewFeature(point,layer,extra={}) {
  const f=makeFocus(point);
  return {...point,layer,...pending,geometry:f&&!f.referenceOnly?{type:'Point',coordinates:[point.lon,point.lat,f.height]}:null,
    geometry_status:f?.referenceOnly?'floor_or_height_missing':'source_candidate',...extra};
}

export function buildPointRegister(register,destinations,grid) {
  const vertical=register.connector_inventory.filter(p=>VERTICAL_TYPES.has(p.type));
  const verticalIds=new Set(vertical.map(p=>p.source_puid));
  const features=[];
  // Source-centroid rows remain source references, not invented walking thresholds.
  const preciseGates=register.priority_nodes.filter(p=>p.kind==='gate_locator');
  const gateLocatorIds=new Set(register.locator_register.filter(p=>p.candidate_review_ids?.length===1&&preciseGates.some(g=>g.review_id===p.candidate_review_ids[0])).map(p=>p.locator_id));
  for(const p of register.locator_register.filter(p=>!gateLocatorIds.has(p.locator_id)))features.push(reviewFeature(locationPoint(p),'od',{
    roles:['origin','destination'],modes:[p.mode],entry_node_ids:p.candidate_review_ids||[],
    area_boundary:null,required_check:`${p.source_poi_basis||p.kind} · 실제 출도착 경계와 연결 출입구를 확인하세요. ${p.notes.join(' / ')}`,
  }));
  // Keep precise gate candidates available, distinct from statistical source centroids.
  for(const p of register.priority_nodes.filter(p=>p.kind==='gate_locator'||p.review_id==='W-E'||p.review_id==='W-W'))
    features.push(reviewFeature(p,'od',{roles:['origin','destination'],entry_node_ids:[],area_boundary:null,
      aliases:register.locator_register.filter(l=>gateLocatorIds.has(l.locator_id)&&l.candidate_review_ids.includes(p.review_id)).map(l=>l.locator_id)}));
  for(const p of vertical){
    const existing=register.priority_nodes.find(n=>n.source_ids.includes(p.source_puid));
    features.push(reviewFeature({...p,review_id:existing?.review_id||`IF-${p.source_puid.split('_').at(-1)}`,
      label:existing?.label||`${p.floor} ${p.type} · ${p.source_puid.slice(-6)}`,
      source_ids:[p.source_puid],source_basis:'VWorld 시설 POI · 현재 존치·랜딩 미검수',
      required_check:'시설 중심 후보입니다. 실제 위·아래 랜딩, 연결 층, 이동 방향과 접근 가능 여부를 확인해야 합니다.'},'connector',{
        parent_type:'waypoint',connector_type:p.type,connection_id:null,paired_point_id:null,landing_verified:false,direction:'unverified',
    }));
  }
  for(const item of destinations?.items||[]){
    if(item.points.some(p=>p.source_ids.some(id=>verticalIds.has(id))))continue;
    const primary=item.points.find(p=>p.review_id===item.primary_id);
    const p=primary||{review_id:item.id,label:item.label,floor:item.floor,source_ids:[],required_check:'좌표 미확보'};
    features.push(reviewFeature({...p,label:item.label},'facility',{
      facility_id:item.id,category:item.category,kind:item.kind,access_point_id:null,
      facade_ids:item.points.map(p=>p.review_id),required_check:`${item.notes} · 표시점은 시설 참고 위치이며 보행 출입구가 아닙니다.`,
    }));
  }
  for(const p of features)p.record_kind='source_reference';
  for(const p of grid?.points||[])features.push(reviewFeature(p,'waypoint',{
    record_kind:'walk_point',parent_type:'waypoint',roles:[],
    geometry_status:'model_checked_candidate',geometry_checked:true,grid_spacing:p.point_kind==='connector_tread'?grid.tread_spacing_m:grid.spacing_m,
    source_revision:grid.source_revision,required_check:p.point_kind==='connector_tread'?'계단·ES 디딤판 높이 기준 이동점. 상·하단 랜딩, 연결 층·운행 방향 미확정.':'모델 바닥·장애물 검사 통과 후보. 현재 현장 통행성·통제구역·문 개방 여부 미확정.',
  }));
  return features;
}

// Role marking never approves traversal, pairs floors, or changes base coordinates.
export function assignPointRole(point,layer,{label=point.label,source_id=null}={}){
  if(point.record_kind!=='walk_point'||!POINT_LAYERS[layer])throw Error('바닥·계단 이동점에서 역할을 지정하세요.');
  if(typeof label!=='string'||!label.trim()||label.length>120)throw Error('이름은 1~120자로 입력하세요.');
  return {...point,layer,label:label.trim(),record_kind:'walk_point',parent_type:'waypoint',
    roles:layer==='od'?['origin','destination']:layer==='waypoint'?[]:[layer],
    linked_reference_id:source_id,role_status:'user_marked_draft',...pending,
    connection_id:null,paired_point_id:null,landing_verified:false,direction:'unverified'};
}

export function validCoordinate(c) {
  return Array.isArray(c)&&c.length===3&&c.every(Number.isFinite)&&c[0]>126.95&&c[0]<126.99&&c[1]>37.53&&c[1]<37.58&&c[2]>-50&&c[2]<100;
}

export function validGeometry(g) {
  if(g?.type==='Point')return validCoordinate(g.coordinates);
  if(g?.type!=='Polygon'||!Array.isArray(g.coordinates)||g.coordinates.length!==1)return false;
  const ring=g.coordinates[0];
  if(!Array.isArray(ring)||ring.length<4||ring.length>101||!ring.every(validCoordinate))return false;
  if(!ring[0].every((x,i)=>x===ring.at(-1)[i]))return false;
  if(Math.max(...ring.map(c=>c[2]))-Math.min(...ring.map(c=>c[2]))>.05)return false;
  const xy=ring.slice(0,-1).map(c=>[(c[0]-ring[0][0])*88000,(c[1]-ring[0][1])*111000]);
  if(new Set(xy.map(p=>p.join(','))).size!==xy.length)return false;
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  let twiceArea=0;
  for(let i=0;i<xy.length;i++){
    const a=xy[i],b=xy[(i+1)%xy.length];twiceArea+=a[0]*b[1]-a[1]*b[0];
    for(let j=i+2;j<xy.length;j++){
      if(i===0&&j===xy.length-1)continue;
      const c=xy[j],d=xy[(j+1)%xy.length];
      if(cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0&&
        Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))&&
        Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1])))return false;
    }
  }
  return Math.abs(twiceArea)>.5;
}

export function mapFeature(p) {
  if(typeof p.review_id!=='string'||!p.review_id||p.review_id.length>120||typeof p.label!=='string'||p.label.length>240||!POINT_LAYERS[p.layer]||!REVIEW_FLOORS.includes(p.floor)||!validGeometry(p.geometry))return null;
  return {id:p.review_id,label:p.label,layer:p.layer,floor:p.floor,geometry:p.geometry,
    ...(p.layer==='connector'&&p.always_label===true?{always_label:true}:{}),
    ...(p.layer==='connector'&&Object.hasOwn(CONNECTOR_ROLES,p.connector_role)?{connector_role:p.connector_role}:{})};
}

export function filterPoints(points,{floor='',layer='',query=''}={}) {
  const q=query.trim().toLowerCase();
  return points.filter(p=>(!floor||p.floor===floor)&&(!layer||p.layer===layer)&&(!q||
    [p.review_id,p.label,...p.source_ids||[],...p.aliases||[],...p.modes||[]].join(' ').toLowerCase().includes(q)));
}

export function areaDraft(vertices,{id,label,floor,source_id}) {
  if(!Array.isArray(vertices)||vertices.length<3)throw Error('영역은 서로 다른 꼭짓점 3개 이상이 필요합니다.');
  if(!vertices.every(validCoordinate)||Math.max(...vertices.map(p=>p[2]))-Math.min(...vertices.map(p=>p[2]))>.25)
    throw Error('선택점 높이가 서로 다릅니다. 같은 층의 평평한 바닥 위에서 다시 그려주세요.');
  const h=vertices[0][2];
  const ring=vertices.map(p=>[p[0],p[1],h]);ring.push([...ring[0]]);
  const geometry={type:'Polygon',coordinates:[ring]};
  if(!REVIEW_FLOORS.includes(floor)||!validGeometry(geometry))throw Error('영역 경계가 겹치거나 좌표·크기가 올바르지 않습니다.');
  return {review_id:id,label,floor,layer:'od',geometry,source_ids:source_id?[source_id]:[],
    roles:['origin','destination'],entry_node_ids:[],geometry_status:'user_drawn_draft',...pending,
    required_check:'지도에서 그린 검토안. 출도착 경계·보행 접속점·실제 바닥 높이 확인 필요.'};
}

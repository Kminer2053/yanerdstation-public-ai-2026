import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import assert from 'node:assert/strict';
import {parseCsv} from './footfall-source-reader.mjs';
import {buildWalkingGraph,shortestFrom,shortestPath} from './shortest-workbench-routes.mjs';
import {preferredFacilityPath} from './preferred-facility-path.mjs';
import {loadWalkability} from './route-walkability.mjs';
import {connectionPath,workbenchPoints} from '../src/location-workbench-core.js';
const root=path.resolve(process.env.STATION_SOURCE_WORKSPACE||'..');
const source=path.join(root,'outputs/20260918_data_preparation_de2519c8/deliverables');
const editor=path.join(root,'worktrees/offline-route-editor');
const out='public/data/experience',priv='server/data';
const json=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const csv=name=>parseCsv(fs.readFileSync(path.join(source,name),'utf8'));
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v));};
const saved=json(path.join(editor,'data-private/location-workbench/state.json')),state=saved.data;
// 335 = 334 plus the 2026-09-27 fix of three 2F↔3F escalator landings (F02MV007-1/3/4, tools/diagnose-ride-landings.mjs).
// 336 = escalator running directions (right-hand up, left-hand down) on 11 pairs; the 3 pairs the flow-model routes ride
// both ways stay two-way until that model is recalculated.
// 337 = 13 more ride landings without a walking edge moved to walkable grid points (same check, all floors).
assert.equal(saved.revision,337,'Re-review an updated editor revision before compiling.');
const grid=json(path.join(editor,'public/data/route-review/grid-all.json'));
const destinations=json(path.join(editor,'public/data/route-review/destinations.json'));
const byFacility=new Map(destinations.items.map(d=>[d.id,d])),byPoint=new Map(grid.points.map(p=>[p.review_id,p]));
const approvals=csv('store_facility_candidates.csv').filter(r=>r.processing_enabled==='True'&&r.approved_facility_id);
assert.equal(approvals.length,29);assert.equal(new Set(approvals.map(r=>r.store_code)).size,29);
const approved=new Map(approvals.map(r=>[r.store_code,r.approved_facility_id]));
const products=csv('popular_products.csv').map(p=>{assert.equal(approved.get(p.store_code),p.facility_id);return {id:p.product_id,facility_id:p.facility_id,rank:+p.rank,name:p.product_name,price:p.price_krw===''?null:+p.price_krw,price_text:p.price_text,price_kind:p.price_kind};});
const stores=approvals.map(r=>({code:r.store_code,id:r.approved_facility_id,category:r.subcategory||r.category,area:r.area_m2?+r.area_m2:null}));
const facilities=state.facilities.filter(f=>f.active).map(f=>{
  const p=byFacility.get(f.id)?.points?.[0],access=byPoint.get(f.access_id),store=stores.find(s=>s.id===f.id);
  const reference=p?{lon:p.lon,lat:p.lat,height:p.source_poi_z,focus:p.catalog_focus}:null;
  return {...Object.fromEntries(['id','name','category','floor','source_id','access_id','hours','contact','notes','status'].map(k=>[k,f[k]])),reference,access:access?[access.lon,access.lat,access.model_walk_ground_z]:null,store:store||null,products:products.filter(p=>p.facility_id===f.id)};
});
const daily=csv('store_daily_protected.csv'),hourly=csv('store_hourly_protected_estimated.csv');
for(const r of [...daily,...hourly])assert.equal(approved.get(r.store_code),r.facility_id,'Never import unmatched commercial records');
const dates=Array.from({length:31},(_,i)=>'2026-07-'+String(i+1).padStart(2,'0'));
const usages={},sales={};
for(const s of stores){usages[s.id]={daily:Array(31).fill(null),hourly:Array.from({length:31},()=>null)};sales[s.id]={daily:Array(31).fill(null),hourly:Array.from({length:31},()=>null)};}
for(const r of daily){const d=dates.indexOf(r.date);assert(d>=0);usages[r.facility_id].daily[d]=r.usage_count===''?null:+r.usage_count;sales[r.facility_id].daily[d]=r.sales_krw===''?null:+r.sales_krw;}
for(const r of hourly){const d=dates.indexOf(r.date),h=+r.hour;assert(d>=0&&h>=0&&h<24);usages[r.facility_id].hourly[d]??=Array(24).fill(0);sales[r.facility_id].hourly[d]??=Array(24).fill(0);usages[r.facility_id].hourly[d][h]=+r.usage_count;sales[r.facility_id].hourly[d][h]=+r.sales_krw;}
for(const [id,rows]of Object.entries(usages))for(let d=0;d<31;d++){assert.equal(rows.hourly[d]?.reduce((a,b)=>a+b,0)??null,rows.daily[d]);assert.equal(sales[id].hourly[d]?.reduce((a,b)=>a+b,0)??null,sales[id].daily[d]);}
const rawRoutes=json(path.join(source,'route_paths.json')).routes,rawEdges=json(path.join(source,'edges.geojson')).features;
const edges=rawEdges.map(f=>({id:f.id,coordinates:f.geometry.coordinates,...f.properties}));
const routes=rawRoutes.map(r=>({...r,status:'draft',coordinates:r.point_ids.map(id=>{const p=byPoint.get(id);assert(p,id);return [p.lon,p.lat,p.model_walk_ground_z];}),floors:r.point_ids.map(id=>byPoint.get(id).floor)}));
const routeIndex=new Map(routes.map((r,i)=>[r.route_id,i])),edgeIndex=new Map(edges.map((e,i)=>[e.id,i]));
const timeline={};
for(const d of dates)timeline[d]={routes:Array.from({length:24},()=>Array(routes.length).fill(0)),entries:Array.from({length:24},()=>({arrivals:0,departures:0,by_endpoint:{}}))};
for(const r of csv('route_hourly.csv')){const d=r.timestamp_local.slice(0,10),h=+r.timestamp_local.slice(11,13);if(timeline[d])timeline[d].routes[h][routeIndex.get(r.route_id)]=+r.expected_trips;}
for(const r of csv('entry_hourly_by_origin.csv')){const d=r.timestamp_local.slice(0,10),h=+r.timestamp_local.slice(11,13);if(!timeline[d])continue;const t=timeline[d].entries[h];t[r.direction]+=+r.candidate_events;t.by_endpoint[r.endpoint_id]??={arrivals:0,departures:0};t.by_endpoint[r.endpoint_id][r.direction]+=+r.candidate_events;}
// Streaming avoids constructing a million CSV row objects. Keep the exact
// estimated passages (rounded only for visualization), not pseudo density.
let edgeDay=null,edgeHours=null,peakEdgePassages=0;
const flush=()=>{if(edgeDay&&dates.includes(edgeDay))write(out+'/flows/'+edgeDay+'.json',edgeHours);};
for await(const line of readline.createInterface({input:fs.createReadStream(path.join(source,'edge_hourly.csv')),crlfDelay:Infinity})){
  if(!line.startsWith('2026-'))continue;const [stamp,id,value]=line.split(','),d=stamp.slice(0,10),h=+stamp.slice(11,13);
  if(d!==edgeDay){flush();edgeDay=d;edgeHours=Array.from({length:24},()=>[]);}
  assert(edgeIndex.has(id));peakEdgePassages=Math.max(peakEdgePassages,+value);if(+value>0)edgeHours[h].push(edgeIndex.get(id),Math.round(+value*1000)/1000);
}flush();
write(out+'/catalog.json',{revision:saved.revision,dates,endpoints:state.endpoints,facilities,stores});
write(out+'/usage.json',{basis:'이용인원 (결제건수 기준·가공값)',hourly_basis:'월별 시간대 매출 구성비로 일자별 가공 이용인원을 배분한 추정치. 영업시간 밖 발생도 유지.',dates,stores:usages});
write(priv+'/sales.json',{dates,stores:sales,basis:'패턴 보존 가공 매출. 원금액 아님. 시간대는 월별 구성비 적용 추정.'});
write(out+'/network.json',{revision:saved.revision,max_edge_passages:peakEdgePassages,routes,edges,endpoints:state.endpoints,connections:state.connections.map(c=>({id:c.id,name:c.name,kind:c.kind,status:c.status}))});
write(out+'/timeline.json',timeline);
write(out+'/methodology.json',{parameters:json(path.join(source,'parameters.json')),summary:json(path.join(source,'summary.json')),origins:csv('origin_endpoint_mapping.csv'),daily:csv('origin_daily.csv')});
write(priv+'/workbench-seed.json',saved);
const register=json(path.join(editor,'public/data/route-review/register.json'));
const originEntries=json(path.join(editor,'public/data/route-review/origin-entries.json'));
write(priv+'/validation.json',{grid:{source_revision:grid.source_revision},points:workbenchPoints(register.register,destinations,grid,originEntries).map(p=>({review_id:p.review_id,record_kind:p.record_kind,geometry:p.geometry,floor:p.floor}))});
const originsHourly=csv('origin_hourly.csv');
for(const o of state.origins){write(out+'/origins/'+o.id+'.json',{note:'운행일과 자정 이월을 보존한 원천/추정 자료. GTX·주차장 시간대는 명시된 추정 기준 적용.',rows:originsHourly.filter(r=>r.origin_id===o.id).map(r=>({service_date:r.service_date,source_hour:r.service_hour,series_id:r.source_series,metric:r.direction==='arrivals'?'passenger_alightings':'passenger_boardings',value:r.source_events||r.station_candidate_events,value_class:r.value_class,include_in_total:'합계 기준 참조'}))});}
write('public/data/route-review/destinations.json',destinations);
// This is a new service snapshot, never an overwrite of the user-operated editor.
write('data-private/location-workbench/state.json',saved);
console.log('Compiled: '+facilities.length+' facilities, '+stores.length+' approved stores, '+routes.length+' routes. Daily/hourly reconciliation passed.');
if(process.argv.includes('--graph')){
  const mesh=await loadWalkability(root,grid);console.log('Mesh validation ready');
  const graph=buildWalkingGraph(grid,state,{segment:mesh.segment}),connections=new Map(state.connections.map(c=>[c.id,c]));
  const expanded=path=>{const ids=[];for(const e of path.edges){const c=connections.get(e.connection_id),p=c?connectionPath(c,e.from,e.to):[e.from,e.to];ids.push(...(ids.length?p.slice(1):p));}return ids;};
  const facilityRoutes=[];
  for(const endpoint of state.endpoints){const result=shortestFrom(graph,endpoint.access_id);for(const f of facilities.filter(f=>f.access_id)){
    const p=preferredFacilityPath(graph,endpoint,f,shortestPath(graph,result,f.access_id));if(!p)continue;const ids=expanded(p);
    facilityRoutes.push({route_id:'VISIT-'+endpoint.id+'-'+f.id,from_endpoint:endpoint.id,to_facility:f.id,distance_m:p.distance_m,connections:p.edges.filter(e=>e.connection_id).length,status:'draft',...(p.routing_policy?{routing_policy:p.routing_policy}:{}),point_ids:ids,coordinates:ids.map(id=>{const v=byPoint.get(id);return [v.lon,v.lat,v.model_walk_ground_z]}),floors:ids.map(id=>byPoint.get(id).floor)});
  }}
  // Free movement follows only mesh-tested edges. Inter-floor rides retain paths.
  write(out+'/walk-graph.json',{revision:saved.revision,origin:grid.origin,points:graph.points.map(p=>[p.review_id,p.floor,p.lon,p.lat,p.model_walk_ground_z,...p.enu]),adj:graph.adj.map(row=>row.map(e=>[e.to,+e.cost.toFixed(4),e.connection_id])),connections:state.connections.map(c=>({...c,coordinates:(c.path||c.stops||[c.from,c.to]).map(id=>{let p=byPoint.get(id);return [p.lon,p.lat,p.model_walk_ground_z]})}))});
  write(out+'/facility-routes.json',facilityRoutes);
  write(out+'/routing-coverage.json',{graph:graph.stats,mesh:mesh.stats(),facilities:facilities.length,with_access:facilities.filter(f=>f.access_id).length,routes:facilityRoutes.length,without_access:facilities.filter(f=>!f.access_id).map(f=>({id:f.id,name:f.name})),field_verified:false});
  console.log(JSON.stringify({graph:graph.stats,mesh:mesh.stats(),facilityRoutes:facilityRoutes.length}));
}

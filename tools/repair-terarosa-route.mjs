import fs from 'node:fs';
import {preferredFacilityPath} from './preferred-facility-path.mjs';
const base=new URL('../public/data/experience/',import.meta.url);
const read=f=>JSON.parse(fs.readFileSync(new URL(f,base),'utf8'));
const w=read('walk-graph.json'), catalog=read('catalog.json'),routes=read('facility-routes.json');
const points=w.points.map(p=>({review_id:p[0],floor:p[1]}));
const graph={points,ids:new Map(points.map((p,i)=>[p.review_id,i])),adj:w.adj.map(row=>row.map(e=>({to:e[0],cost:e[1],connection_id:e[2]})))};
const endpoint=catalog.endpoints.find(e=>e.id==='OD-be79931e-9d7f-4aec-8d0c-19f76da23762');
const facility=catalog.facilities.find(f=>f.id==='DEST-F03WL006-S01');
const path=preferredFacilityPath(graph,endpoint,facility,null), ids=[],locations=new Map(w.points.map(p=>[p[0],{coordinates:p.slice(2,5),floor:p[1]}]));
for(const e of path.edges){
  const c=w.connections.find(c=>c.id===e.connection_id),segment=c?c.path:[e.from,e.to];
  if(c){if(segment[0]!==e.from || segment.at(-1)!==e.to) throw Error('Escalator direction mismatch');
    c.path.forEach((id,i)=>locations.set(id,{coordinates:c.coordinates[i],floor:locations.get(id)?.floor||'2F'}));}
  ids.push(...(ids.length?segment.slice(1):segment));
}
const route=routes.find(r=>r.from_endpoint===endpoint.id && r.to_facility===facility.id);
if(!route) throw Error('Existing route missing');
Object.assign(route,{distance_m:path.distance_m,connections:1,routing_policy:path.routing_policy,point_ids:ids,
  coordinates:ids.map(id=>locations.get(id).coordinates),floors:ids.map(id=>locations.get(id).floor)});
if(process.argv.includes('--write')) fs.writeFileSync(new URL('facility-routes.json',base),JSON.stringify(routes));
console.log(JSON.stringify({route_id:route.route_id,distance_m:route.distance_m,policy:route.routing_policy,points:ids.length}));

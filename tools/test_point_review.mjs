import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {POINT_LAYERS,buildPointRegister,filterPoints,mapFeature,validGeometry,areaDraft,assignPointRole} from '../src/point-review-core.js';
import {retiredWhole,retiredTriangle,visibleFragments,retirementFiles} from './point-retirement.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const {register,matching}=read('../public/data/route-review/register.json');
const destinations=read('../public/data/route-review/destinations.json'),grid=read('../public/data/route-review/grid-all.json');
const points=buildPointRegister(register,destinations,grid);
assert.deepEqual(Object.values(POINT_LAYERS).map(x=>x.color),['#43dc83','#ffffff','#4299ff','#ffd24a']);
assert.equal(new Set(points.map(p=>p.review_id)).size,points.length);
assert.equal(points.filter(p=>p.layer==='connector').length,141);
assert.equal(points.filter(p=>p.layer==='facility').length,171);
assert.equal(points.filter(p=>p.layer==='waypoint').length,grid.points.length);
assert.ok(points.every(p=>p.user_approved===false&&p.routing_enabled===false&&p.surveyed===false));
assert.ok(points.filter(p=>p.layer==='connector').every(p=>p.connection_id===null&&p.paired_point_id===null&&p.landing_verified===false&&p.parent_type==='waypoint'));
assert.ok(matching.directional_route_reviews.every(r=>r.routing_enabled===false&&r.walkable_polyline===null));
const blueIds=new Set(points.filter(p=>p.layer==='connector').flatMap(p=>p.source_ids));
assert.ok(points.filter(p=>p.layer==='facility').every(p=>p.source_ids.every(id=>!blueIds.has(id))));
assert.ok(points.filter(p=>p.layer==='waypoint').every(p=>p.geometry_checked&&mapFeature(p)));
assert.ok(points.some(p=>p.layer==='facility'&&!mapFeature(p)&&p.label.includes('화장실')));
assert.equal(filterPoints(points,{query:'LOC-022'})[0].review_id,'G1');
for(const [f,s] of Object.entries(grid.floors))assert.equal(filterPoints(points,{floor:f,layer:'waypoint'}).length,s.points);
assert.ok(Object.entries(grid.floors).filter(([f])=>f!=='RF').every(([,s])=>s.floor_grid_points>0));
assert.equal(grid.floors.RF.status,'floor_geometry_unavailable');
for(const model of ['F02FL002','F02FL003','F02FL004'])assert.ok(grid.points.filter(p=>p.source_ids.includes(model)).length>70,model+' coverage');
for(const model of ['F01FL008','B07FL002','F03FL002','F01CL002'])assert.ok(!grid.points.some(p=>p.source_ids.includes(model)),model+' must not become walking floor');
assert.ok(grid.floors['2F'].retired_triangles>2000);
assert.ok(grid.floors['B3'].retired_triangles>400);
assert.ok(grid.floors['3F'].retired_triangles>100);
for(const id of ['TREAD-B03MV001--201--82','GRID-B1-87-33','GRID-B2-40-8'])assert.ok(!grid.points.some(p=>p.review_id===id),'headroom collision: '+id);
assert.equal(filterPoints(points,{query:'DINGDONG'}).length,1);
for(const s of grid.customSources){assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../'+s.file,import.meta.url))).digest('hex'),s.sha256,`${s.file} changed: regenerate floor candidates`);}
const inside=(p,vs)=>{let hit=false;for(let i=0,j=vs.length-1;i<vs.length;j=i++)if((vs[i][1]>p[1])!==(vs[j][1]>p[1])&&p[0]<(vs[j][0]-vs[i][0])*(p[1]-vs[i][1])/(vs[j][1]-vs[i][1])+vs[i][0])hit=!hit;return hit;};
for(const p of grid.points){
  const spacing=p.point_kind==='connector_tread'?grid.tread_spacing_m:grid.spacing_m;
  assert.equal(Math.abs(p.enu[0]%spacing),0);assert.equal(Math.abs(p.enu[1]%spacing),0);
  assert.ok(p.enu.every(Number.isFinite));
  assert.ok(grid.customFootprints.filter(c=>c.floor===p.floor).every(c=>!inside(p.enu,c.vertices)),p.review_id);
}
assert.ok(grid.customFootprints.every(c=>c.vertices.flat().every(Number.isFinite)));
for(const m of ['F02MV007','F02MV002','F01MV010','B07MV001','B06MV005','F03MV003']){
  const ps=grid.points.filter(p=>p.source_ids.includes(m));assert.ok(ps.length>50,m);assert.ok(Math.max(...ps.map(p=>p.enu[2]))-Math.min(...ps.map(p=>p.enu[2]))>2,m+' follows tread elevation');
}
const base=points.find(p=>p.record_kind==='walk_point');
assert.ok(points.filter(p=>p.point_kind==='connector_tread').every(p=>p.grid_spacing===.5));
for(const role of Object.keys(POINT_LAYERS)){const marked=assignPointRole(base,role,{label:'검토점'});assert.equal(marked.layer,role);assert.deepEqual(marked.geometry,base.geometry);assert.equal(marked.routing_enabled,false);assert.equal(marked.paired_point_id,null);assert.equal(marked.user_approved,false);}
assert.throws(()=>assignPointRole(points.find(p=>p.record_kind==='source_reference'),'od'));
assert.throws(()=>assignPointRole(base,'arbitrary'));
assert.throws(()=>assignPointRole(base,'od',{label:' '}));
assert.equal(retiredWhole({FLOOR:'2F',MODEL_NAME:'F02WL072',TD_ID:'arbitrary'}),false);
assert.deepEqual(visibleFragments([[15.49,-1,9.5],[15.49,-.5,9.5],[15.49,-1,10]]),[]);
for(const file of retirementFiles){const d=read('../app/'+file);for(const t of d.triangles||[])assert.ok(retiredTriangle(t.points,t.uv),file);}
const vertices=[[126.97,37.554,36.19],[126.97005,37.554,36.19],[126.97005,37.55405,36.2],[126.97,37.55405,36.19]];
const area=areaDraft(vertices,{id:'TEST-AREA',label:'테스트',floor:'2F',source_id:'G1'});
assert.ok(validGeometry(area.geometry));assert.equal(area.routing_enabled,false);assert.equal(mapFeature(area).geometry.type,'Polygon');
assert.throws(()=>areaDraft([vertices[0],vertices[1],vertices[0]],{floor:'2F'}));
assert.throws(()=>areaDraft([vertices[0],vertices[2],vertices[1],vertices[3]],{floor:'2F'}));
assert.throws(()=>areaDraft(vertices.map((v,i)=>i===1?[v[0],v[1],50]:v),{floor:'2F'}));
assert.throws(()=>areaDraft(vertices,{floor:'UNKNOWN'}));
assert.equal(validGeometry({type:'Point',coordinates:[126.97,37.55,null]}),false);
assert.equal(validGeometry({type:'Polygon',coordinates:[vertices]}),false);
assert.equal(mapFeature({...area,layer:'bad'}),null);
assert.equal(mapFeature({...area,review_id:null}),null);
console.log(`PASS ${points.length} classified candidates, 4 colors, 141 connectors, facility dedup, grid provenance, no route approval, OD polygon validation.`);

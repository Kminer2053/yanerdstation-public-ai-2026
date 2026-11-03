// Store frontage for the "인근 통과" metric: route segments of the flow model that can be reached on foot within
// WALK_LIMIT metres from each store's walking access point (walls excluded by the reviewed walking grid).
// The metric per hour is the busiest of these segments (both directions summed); none reachable => "경로 밖".
// Usage: node tools/build-store-frontage.mjs  (reads public/data/experience/*.json, writes store-frontage.json)
import fs from 'node:fs';
import {walkGraphIndex,snapGround,offsetPoint} from '../src/manager-core.js';

export const WALK_LIMIT=30;
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));

export function buildStoreFrontage({catalog,network,graph,walkLimit=WALK_LIMIT}){
  const wg=walkGraphIndex(graph),P=graph.points,adj=graph.adj;
  // Undirected route segments: both directions of the same grid step count as one place people pass.
  const segments=new Map();
  network.edges.forEach((e,i)=>{if(e.kind!=='walk')return;const k=[e.from_point_id,e.to_point_id].sort().join('|');const s=segments.get(k)||{a:e.from_point_id,b:e.to_point_id,edges:[]};s.edges.push(i);segments.set(k,s);});
  const reach=start=>{
    const d=new Map([[start,0]]),heap=[[0,start]];
    while(heap.length){
      let m=0;for(let i=1;i<heap.length;i++)if(heap[i][0]<heap[m][0])m=i;const [du,u]=heap.splice(m,1)[0];if(du>d.get(u))continue;
      for(const [v,w,link] of adj[u]){if(link||P[v][1]!==P[u][1]||!P[v][0].startsWith('GRID-'))continue;const nd=du+w;if(nd<=walkLimit&&nd<(d.get(v)??Infinity)){d.set(v,nd);heap.push([nd,v]);}}
    }
    return d;
  };
  const stores={};
  for(const f of catalog.facilities){
    const r=f.reference;if(!r)continue;
    let anchor=f.access_id&&wg.byId.has(f.access_id)?f.access_id:null,basis='access';
    // No access point: stand just in front of the storefront (facade normal) rather than behind or inside the booth.
    if(!anchor){const h=r.focus?.cameraHeading,p=Number.isFinite(h)?offsetPoint([r.lon,r.lat,r.height-1.4],h,1.8):[r.lon,r.lat,r.height-1.4],s=snapGround(wg,f.floor,p,{radius:6});anchor=s?.id||null;basis=Number.isFinite(h)?'snapped_storefront':'snapped_reference';}
    if(!anchor){stores[f.id]={anchor:null,anchor_basis:'no_walkable_floor',segments:[]};continue;}
    const d=reach(wg.byId.get(anchor)),found=[];
    for(const s of segments.values()){const dd=Math.min(d.get(wg.byId.get(s.a))??Infinity,d.get(wg.byId.get(s.b))??Infinity);if(dd<=walkLimit)found.push({edges:s.edges,distance_m:Math.round(dd*10)/10});}
    stores[f.id]={anchor,anchor_basis:basis,segments:found.sort((a,b)=>a.distance_m-b.distance_m)};
  }
  return {basis:'매장 보행 출입점에서 보행 격자를 따라 걸어서 '+walkLimit+'m 안에 닿는 유동 모형 이동 경로 구간(양방향 합). 시간별 인근 통과는 이 중 가장 붐비는 구간 값. 닿는 구간이 없으면 경로 밖.',
    walk_limit_m:walkLimit,network_revision:network.revision??null,stores};
}

if(import.meta.url===`file://${process.argv[1]}`){
  const out=buildStoreFrontage({catalog:json('public/data/experience/catalog.json'),network:json('public/data/experience/network.json'),graph:json('public/data/experience/walk-graph.json')});
  fs.writeFileSync('public/data/experience/store-frontage.json',JSON.stringify(out));
  const v=Object.values(out.stores);
  console.log('store-frontage.json: '+v.length+' facilities, '+v.filter(s=>s.segments.length).length+' with route segments within '+out.walk_limit_m+'m walk, '+v.filter(s=>!s.segments.length).length+' off the modelled routes');
}

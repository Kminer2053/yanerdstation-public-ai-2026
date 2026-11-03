import * as T from 'three';
const distance=(p,b)=>Math.hypot(Math.max(b[0]-p.x,0,p.x-b[2]),Math.max(b[1]-p.z,0,p.z-b[3]));
const bounds=positions=>{const xs=[],zs=[];for(let i=0;i<positions.length;i+=3){xs.push(positions[i]);zs.push(positions[i+2]);}return [Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)];};
function subset(base,indices,tile,size){
 const positions=[],uv=[],normals=[],order=[],seen=new Map(),p=base.getAttribute('position'),a=base.getAttribute('uv'),n=base.getAttribute('normal');
 for(const original of indices){let id=seen.get(original);if(id===undefined){id=positions.length/3;seen.set(original,id);positions.push(p.getX(original),p.getY(original),p.getZ(original));normals.push(n.getX(original),n.getY(original),n.getZ(original));uv.push((a.getX(original)*size-tile.left)/tile.size,(a.getY(original)*size-size+tile.top+tile.size)/tile.size);}order.push(id);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(order);return g;
}
// Distant surfaces stay in the shared atlas. Only a few nearby photographs get
// separate detailed textures; leaving the area releases their GPU resources.
export function createDetailStreaming({scene,renderer,hall,architecture,shells,mobile,onChange}){
 const sourceGroups=new Map(shells.map(m=>[m.name,m.geometry])),cache=new Map(),pending=new Set(),failed=new Map(),loader=new T.TextureLoader();let wanted=new Map(),last=-10,disposed=false;
 const candidates=[];
 for(const f of hall.facades){if(!f.detailImage||!f.detailUV)continue;const url=typeof f.detailImage==='string'?f.detailImage:f.detailImage.url;candidates.push({id:'facade:'+f.alias,type:'facade',floors:[f.floor],url,bounds:bounds(f.positions),data:f});}
 for(const p of architecture.detailPages||[])candidates.push({id:'source:'+p.id,type:'source',floors:[...new Set(p.parts.map(part=>architecture.groups.find(g=>g.name===part.group)?.floor))],url:p.url,bounds:p.bounds,data:p,penalty:p.parts.every(p=>p.group==='floors'||p.group.endsWith(':floors'))?5:0});
 function remove(record){scene.remove(record.root);record.root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});record.texture.dispose();}
 function meshFor(entry,texture){
  const root=new T.Group();if(entry.type==='facade'){
   const f=entry.data,g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(f.positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(f.detailUV,2));g.setIndex(f.indices);const material=new T.MeshBasicMaterial({map:texture,side:T.DoubleSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});const mesh=new T.Mesh(g,material);mesh.renderOrder=3;root.add(mesh);
  }else{
   const page=entry.data;for(const part of page.parts){const base=sourceGroups.get(part.group);if(!base||part.group==='floors'||part.group.endsWith(':floors'))continue;const indices=part.indices||part.ranges.flatMap(([start,count])=>Array.from(base.index.array.subarray(start,start+count))),g=subset(base,indices,page.tile,architecture.atlas.width),original=architecture.groups.find(g=>g.name===part.group).material,material=new T.MeshStandardMaterial({...original,map:texture,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:0,polygonOffsetUnits:0,depthWrite:!original.transparent});const mesh=new T.Mesh(g,material);mesh.renderOrder=1;root.add(mesh);}
  }return root;
 }
 function fill(){
  if(disposed)return;for(const [id,entry] of wanted){if(pending.size>=2)break;if(cache.has(id)||pending.has(id)||Date.now()-(failed.get(id)||0)<30_000)continue;pending.add(id);
   loader.loadAsync(entry.url).then(texture=>{if(disposed||!wanted.has(id)){texture.dispose();return;}texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());const root=meshFor(entry,texture);cache.set(id,{root,texture});scene.add(root);onChange?.();}).catch(()=>failed.set(id,Date.now())).finally(()=>{pending.delete(id);fill();});
  }
 }
 return {
  update(position,time,overview,floor,inTransit=false){if(time-last<.6)return;last=time;const chosen=[];
   if(!overview)for(const type of ['facade','source']){const cap=type==='facade'?(mobile?3:5):(mobile?3:6),range=type==='facade'?24:28;chosen.push(...candidates.filter(e=>e.type===type&&(inTransit||e.floors.includes(floor))).map(e=>({e,d:distance(position,e.bounds)+(e.penalty||0)-(cache.has(e.id)?.8:0)})).filter(v=>v.d<range).sort((a,b)=>a.d-b.d).slice(0,cap).map(v=>v.e));}
   wanted=new Map(chosen.map(e=>[e.id,e]));for(const [id,record] of cache)if(!wanted.has(id)){remove(record);cache.delete(id);onChange?.();}fill();
  },
  count(){return cache.size;},
  dispose(){disposed=true;for(const record of cache.values())remove(record);cache.clear();wanted.clear();},
 };
}

import * as T from 'three';

const kinds=new Set(['photo','solid','glass']);
const floors=new Set(['2F','3F']);
const invalid=message=>{throw new Error('신규 시설 데이터가 올바르지 않아요: '+message);};
function validate(custom){
 if(!custom||!Array.isArray(custom.assets)||!Array.isArray(custom.groups)||typeof custom.atlas!=='string'||!custom.atlas)invalid('시설·형상·사진 atlas');
 const assets=new Map();
 for(const asset of custom.assets){if(!asset?.id||typeof asset.id!=='string'||assets.has(asset.id)||!floors.has(asset.floor))invalid('시설 ID 또는 층');assets.set(asset.id,asset);}
 for(const group of custom.groups){
  const {positions,indices,uv,pickRanges}=group;
  if(!kinds.has(group.kind)||!floors.has(group.floor)||!Array.isArray(positions)||positions.length<9||positions.length%3||!positions.every(Number.isFinite))invalid('형상 좌표');
  if(!Array.isArray(indices)||!indices.length||indices.length%3||!indices.every(i=>Number.isInteger(i)&&i>=0&&i<positions.length/3))invalid('삼각형 인덱스');
  if(group.kind==='photo'&&(!Array.isArray(uv)||uv.length!==positions.length/3*2||!uv.every(v=>Number.isFinite(v)&&v>=0&&v<=1)))invalid('사진 UV');
  if(group.opacity!==undefined&&(!Number.isFinite(group.opacity)||group.opacity<0||group.opacity>1))invalid('투명도');
  if(!Array.isArray(pickRanges))invalid('시설 선택 범위');
  let end=0;
  for(const range of pickRanges){const asset=assets.get(range.assetId);if(!asset||asset.floor!==group.floor||range.start!==end||!Number.isInteger(range.count)||range.count<1)invalid('시설 선택 인덱스');end+=range.count;}
  if(end!==indices.length/3)invalid('선택되지 않는 시설 면');
 }
 return assets;
}
function assetForFace(ranges,face){
 let lo=0,hi=ranges.length-1;
 while(lo<=hi){const mid=(lo+hi)>>1,range=ranges[mid];if(face<range.start)hi=mid-1;else if(face>=range.start+range.count)lo=mid+1;else return range.assetId;}
 return null;
}

// Low-detail photos share one atlas. Detailed copies are streamed separately
// by createDetailStreaming, using custom.photos alongside hall.facades.
export async function createCustomWorld({scene,custom,onChange}){
 if(!scene?.add||!scene?.remove)throw new TypeError('createCustomWorld requires a Three scene');
 const assets=validate(custom),meshes=[],materials=new Map();
 const atlas=await new T.TextureLoader().loadAsync(custom.atlas+(custom.atlas.includes('?')?'&':'?')+'v='+encodeURIComponent(custom.version||''));
 atlas.colorSpace=T.SRGBColorSpace;
 atlas.anisotropy=4;
 let disposed=false;
 const materialFor=group=>{
  const key=group.kind==='photo'?'photo':[group.kind,group.color||'#ffffff',group.opacity??1].join(':');
  if(materials.has(key))return materials.get(key);
  const options={color:group.color||'#ffffff',side:T.DoubleSide};
  const material=group.kind==='photo'
   ?new T.MeshBasicMaterial({...options,map:atlas,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2})
   :new T.MeshStandardMaterial({...options,roughness:group.kind==='glass'?.25:.85,metalness:group.kind==='glass'?.07:.03,transparent:group.kind==='glass',opacity:group.opacity??1,depthWrite:group.kind!=='glass'});
  materials.set(key,material);return material;
 };
 const dispose=()=>{
  if(disposed)return;disposed=true;
  for(const mesh of meshes){scene.remove(mesh);mesh.geometry.dispose();}
  for(const material of materials.values())material.dispose();
  atlas.dispose();
 };
 try{
  for(const group of custom.groups){
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(group.positions,3));
   if(group.uv)geometry.setAttribute('uv',new T.Float32BufferAttribute(group.uv,2));
   geometry.setIndex(group.indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
   const mesh=new T.Mesh(geometry,materialFor(group));mesh.name='custom:'+group.name;
   mesh.userData={customFloor:group.floor,pickRanges:group.pickRanges};
   if(group.kind==='photo')mesh.renderOrder=2;
   mesh.updateMatrixWorld();scene.add(mesh);meshes.push(mesh);
  }
  onChange?.();
 }catch(error){dispose();throw error;}
 return {
  meshes,
  setVisibility(floor,overview){
   if(disposed)return;let changed=false;
   for(const mesh of meshes){const visible=!overview||mesh.userData.customFloor===floor;if(mesh.visible!==visible){mesh.visible=visible;changed=true;}}
   if(changed)onChange?.();
  },
  pick(ray){
   if(disposed||typeof ray?.intersectObjects!=='function')return null;
   // Three's raycast does not suppress an object's own visible=false flag.
   for(const hit of ray.intersectObjects(meshes.filter(mesh=>mesh.visible),false)){
    if(!Number.isInteger(hit.faceIndex))continue;
    const assetId=assetForFace(hit.object.userData.pickRanges,hit.faceIndex),asset=assets.get(assetId);
    if(asset)return {distance:hit.distance,assetId,facilityId:asset.facilityId||null};
   }
   return null;
  },
  dispose,
 };
}

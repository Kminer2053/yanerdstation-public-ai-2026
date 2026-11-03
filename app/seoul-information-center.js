import config from './seoul-information-center.json' with {type:'json'};

// The screenshot footprint is independent of the S04 stair-side information zone.
// One flag restores the original blue booth without deleting any source/history.
export const INFORMATION_CENTER=Object.freeze(config);
export const INFORMATION_CENTER_SURFACES=Object.freeze([
  {id:'north-facade',direction:'north',label:'북측면',alias:'INFO-CENTER-NORTH-S01',
    slotKey:'effa08d8ce3b3bd6efd5d793c7c66728088a035096323afdfbd73d422ae55e21',
    image:'/assets/seoul-information-center/north.png',photo:'IMG_6149 2.jpg',width:config.width,height:config.height},
  {id:'south-facade',direction:'south',label:'남측 안내창구',alias:'INFO-CENTER-SOUTH-S01',
    slotKey:'57107fe21ab6823c16ea10169b69714533c783b0b6ae3f53c053a5c4ecfcf174',
    image:'/assets/seoul-information-center/south.png',photo:'IMG_6141 2.jpg',width:config.width,height:config.height+config.signHeight},
  {id:'east-facade',direction:'east',label:'동측면',alias:'INFO-CENTER-EAST-S01',
    slotKey:'4ea96bc7a8040e6f2a8835bf066fd55609392b70d25b19df00e8213587ed5c2e',
    image:'/assets/seoul-information-center/sides.png',photo:'IMG_6140 2.jpg',width:config.depth,height:config.height},
  {id:'west-facade',direction:'west',label:'서측면',alias:'INFO-CENTER-WEST-S01',
    slotKey:'d4dd0266b16c9d1a740ef64f05e4414db187d0f8fb8f7c024647f4de9ef8e1e1',
    image:'/assets/seoul-information-center/sides.png',photo:'IMG_6140 2.jpg',width:config.depth,height:config.height},
]);
export function informationCenterSurface(value){
  return INFORMATION_CENTER_SURFACES.find(s=>[s.id,s.direction,s.alias,s.slotKey].includes(value));
}
export function isInformationCenterSlot(slot){
  return slot?.site_id===config.site && INFORMATION_CENTER_SURFACES.some(s=>
    s.slotKey===slot.slot_key || (slot.target_asset_id===config.id && s.id===slot.target_surface_id));
}
export function isRetiredInformationCenterSlot(slot){
  return config.enabled && slot?.site_id===config.site && slot.slot_alias===config.retired.slotAlias
    && slot.slot_key===config.retired.slotKey;
}
export function informationCenterRetirementStyleConditions(site){
  if(!config.enabled || site!==config.site)return [];
  const r=config.retired;
  return [[`\${FLOOR} === '${config.floor}' && \${MODEL_NAME} === '${r.model}' && \${TD_ID} === '${r.tdId}'`,false]];
}
export function informationCenterPoint(x,y,z=0){
  const a=config.angleDegrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return [config.centerEnu[0]+x*c-y*s,config.centerEnu[1]+x*s+y*c,config.centerEnu[2]+z];
}
export function informationCenterNormalHeading(surface){
  return (({north:0,east:90,south:180,west:270}[surface.direction]-config.angleDegrees)+360)%360;
}
export function informationCenterSurfaceCenter(surface){
  const w=config.width/2,d=config.depth/2,z=surface.height/2;
  return informationCenterPoint(...({north:[0,d,z],south:[0,-d,z],east:[w,0,z],west:[-w,0,z]}[surface.direction]));
}
export function informationCenterQuad(surface){
  const w=config.width/2,d=config.depth/2,h=config.height;
  // Explicit bottom-left to top-left order as viewed from OUTSIDE each face.
  // Sharing the side photo must never mirror the letters on the west face.
  return {north:[[w,d,0],[-w,d,0],[-w,d,h],[w,d,h]],
    south:[[-w,-d,0],[w,-d,0],[w,-d,h],[-w,-d,h]],
    east:[[w,-d,0],[w,d,0],[w,d,h],[w,-d,h]],
    west:[[-w,d,0],[-w,-d,0],[-w,-d,h],[-w,d,h]]}[surface.direction];
}

export async function createInformationCenter(C,viewer,site){
  if(!config.enabled || site!==config.site)return null;
  const frame=C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(...config.origin));
  const fromEnu=p=>C.Matrix4.multiplyByPoint(frame,new C.Cartesian3(...p),new C.Cartesian3());
  const point=(x,y,z)=>fromEnu(informationCenterPoint(x,y,z));
  const rotation=C.Matrix4.multiply(frame,C.Matrix4.fromRotationTranslation(
    C.Matrix3.fromRotationZ(config.angleDegrees*Math.PI/180)),new C.Matrix4());
  const orientation=C.Quaternion.fromRotationMatrix(C.Matrix4.getMatrix3(rotation,new C.Matrix3()));
  const source=new C.CustomDataSource('STATION_ONE_INFORMATION_CENTER');
  await viewer.dataSources.add(source);
  const primitives=viewer.scene.primitives.add(new C.PrimitiveCollection());
  const properties={facilityAssetId:config.id,targetAssetId:config.id,floor:config.floor,surveyed:false};
  // A closed white enclosure hides the retained internal PL004 pillars naturally.
  // No source clipping boxes and no replacement floor are used.
  source.entities.add({id:`${config.id}:body`,name:config.label,properties,
    position:point(0,0,config.height/2),orientation,
    box:{dimensions:new C.Cartesian3(config.width-.024,config.depth-.024,config.height),
      material:C.Color.fromCssColorString('#f3f1eb'),shadows:C.ShadowMode.DISABLED}});
  const south=INFORMATION_CENTER_SURFACES[1],left=-config.width/2+config.width*561/2172,
    right=-config.width/2+config.width*1618/2172;
  source.entities.add({id:`${config.id}:sign-body`,name:`${config.label} 상부 간판`,properties,
    position:point((left+right)/2,-config.depth/2+.105,config.height+config.signHeight/2),orientation,
    box:{dimensions:new C.Cartesian3(right-left,.20,config.signHeight),material:C.Color.fromCssColorString('#eeeae3')}});
  const records=[];
  function photo(surface,part,localCorners,crop){
    const corners=localCorners.map(p=>point(...p));
    const edge1=C.Cartesian3.subtract(corners[1],corners[0],new C.Cartesian3()),
      edge2=C.Cartesian3.subtract(corners[3],corners[0],new C.Cartesian3());
    const n=C.Cartesian3.normalize(C.Cartesian3.cross(edge1,edge2,new C.Cartesian3()),new C.Cartesian3());
    // Direct Geometry keeps every ST attached to its own vertex; polygon
    // projection/triangulation otherwise changes orientation on opposing walls.
    const geometry=new C.Geometry({attributes:{
      position:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.DOUBLE,componentsPerAttribute:3,
        values:new Float64Array(corners.flatMap(p=>[p.x,p.y,p.z]))}),
      normal:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.FLOAT,componentsPerAttribute:3,
        values:new Float32Array(Array.from({length:4},()=>[n.x,n.y,n.z]).flat())}),
      st:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.FLOAT,componentsPerAttribute:2,
        values:new Float32Array([0,0,1,0,1,1,0,1])})},indices:new Uint16Array([0,1,2,0,2,3]),
      primitiveType:C.PrimitiveType.TRIANGLES,boundingSphere:C.BoundingSphere.fromPoints(corners)});
    const material=new C.Material({fabric:{type:'InformationCenterPhoto',uniforms:{image:surface.image,
      cropMin:new C.Cartesian2(crop[0],crop[1]),cropSpan:new C.Cartesian2(crop[2],crop[3])},
      source:`czm_material czm_getMaterial(czm_materialInput materialInput) {
        czm_material m=czm_getDefaultMaterial(materialInput);
        vec2 uv=vec2(cropMin.x+materialInput.st.x*cropSpan.x,1.0-cropMin.y-(1.0-materialInput.st.y)*cropSpan.y);
        m.diffuse=texture(image,uv).rgb;m.alpha=1.0;return m;
      }`}});
    primitives.add(new C.Primitive({geometryInstances:new C.GeometryInstance({geometry,
      id:new C.Entity({id:`${config.id}:${part}`,name:`${config.label} · ${surface.label}`,
        properties:{...properties,targetSurfaceId:surface.id,replacementSlot:surface.alias,replacementSlotKey:surface.slotKey,sourcePhoto:surface.photo}})}),
      appearance:new C.MaterialAppearance({material,materialSupport:C.MaterialAppearance.MaterialSupport.TEXTURED,
        flat:true,faceForward:true,closed:false,translucent:false}),asynchronous:false}));
    records.push({surface,material,url:'',request:0});
  }
  for(const surface of INFORMATION_CENTER_SURFACES){
    photo(surface,surface.id,informationCenterQuad(surface),surface.direction==='south'?[0,228/724,1,496/724]:[0,0,1,1]);
  }
  // Only the photographed raised sign, never the generated opaque top corners.
  photo(south,'south-sign',[[left,-config.depth/2,config.height],[right,-config.depth/2,config.height],
    [right,-config.depth/2,config.height+config.signHeight],[left,-config.depth/2,config.height+config.signHeight]],
    [561/2172,6/724,1057/2172,222/724]);
  let disposed=false;
  return {source,primitives,
    setVisible(show){source.show=Boolean(show);primitives.show=Boolean(show);viewer.scene.requestRender();},
    setReplacements(replacements=[]){for(const r of records){
      const url=replacements.find(item=>item.slot_key===r.surface.slotKey)?.image_url||'';
      if(url===r.url)continue;r.url=url;const request=++r.request;
      if(!url){r.material.uniforms.image=r.surface.image;viewer.scene.requestRender();continue;}
      const image=new Image();image.crossOrigin='anonymous';
      image.onload=()=>{if(disposed||request!==r.request)return;r.material.uniforms.image=image;viewer.scene.requestRender();};
      image.onerror=()=>{if(disposed||request!==r.request)return;r.url='';r.material.uniforms.image=r.surface.image;viewer.scene.requestRender();};
      image.src=url;
    }},
    surfacePosition(surfaceId,extra=0){const s=informationCenterSurface(surfaceId)||south;
      const p=informationCenterSurfaceCenter(s);p[2]+=extra;return fromEnu(p);},
    focus(surfaceId,duration=.7){const s=informationCenterSurface(surfaceId)||south;
      const center=this.surfacePosition(s.id),heading=(informationCenterNormalHeading(s)+180)%360;
      viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);
      viewer.camera.flyToBoundingSphere(new C.BoundingSphere(center,s.width/2),{duration,
        // The retained north-side overhead display blocks a low, distant view.
        offset:new C.HeadingPitchRange(C.Math.toRadians(heading),s.direction==='north'?-.62:-.14,
          s.direction==='north'?15:Math.max(8,s.width*.95))});return true;},
    destroy(){disposed=true;records.forEach(r=>r.request++);viewer.dataSources.remove(source,true);viewer.scene.primitives.remove(primitives);}
  };
}

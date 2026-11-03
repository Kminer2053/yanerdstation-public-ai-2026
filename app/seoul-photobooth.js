import config from './seoul-photobooth.json' with {type:'json'};
export const PHOTOBOOTH=Object.freeze(config);
export function isPhotoboothSlot(slot){return slot?.site_id===config.site &&
  (slot.slot_key===config.surface.slotKey || slot.target_asset_id===config.id);}
export function photoboothSurface(value){return [config.id,config.surface.id,config.surface.alias,config.surface.slotKey].includes(value)?config.surface:null;}
export function photoboothPoint(x,y,z=0){
  const a=config.normalHeading*Math.PI/180,n=[Math.sin(a),Math.cos(a)],t=[-n[1],n[0]];
  return [config.frontCenterEnu[0]+x*t[0]+y*n[0],config.frontCenterEnu[1]+x*t[1]+y*n[1],config.frontCenterEnu[2]+z];
}
export function photoboothSurfaceCenter(){return photoboothPoint(0,0,config.height/2);}
export function photoboothQuad(){const w=config.width/2,h=config.height;return [[-w,0,0],[w,0,0],[w,0,h],[-w,0,h]].map(p=>photoboothPoint(...p));}
export async function createPhotobooth(C,viewer,site){
  if(!config.enabled || site!==config.site)return null;
  const frame=C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(...config.origin));
  const world=p=>C.Matrix4.multiplyByPoint(frame,new C.Cartesian3(...p),new C.Cartesian3());
  const source=new C.CustomDataSource(config.id);await viewer.dataSources.add(source);
  const collection=viewer.scene.primitives.add(new C.PrimitiveCollection());
  const properties={facilityAssetId:config.id,targetAssetId:config.id,floor:config.floor,surveyed:false};
  const angle=(config.normalHeading)*Math.PI/180;
  const rotation=C.Matrix4.multiply(frame,C.Matrix4.fromRotationTranslation(C.Matrix3.fromRotationZ(angle)),new C.Matrix4());
  const orientation=C.Quaternion.fromRotationMatrix(C.Matrix4.getMatrix3(rotation,new C.Matrix3()));
  // Neutral enclosure for unseen faces. The source station wall/floor is untouched.
  source.entities.add({id:`${config.id}:enclosure`,name:config.label,properties,
    position:world(photoboothPoint(0,-config.depth/2,config.height/2)),orientation,
    box:{dimensions:new C.Cartesian3(config.width-.01,config.depth-.02,config.height),
      material:C.Color.fromCssColorString('#f4f3ee'),shadows:C.ShadowMode.DISABLED}});
  const corners=photoboothQuad().map(world),edge1=C.Cartesian3.subtract(corners[1],corners[0],new C.Cartesian3()),
    edge2=C.Cartesian3.subtract(corners[3],corners[0],new C.Cartesian3());
  const n=C.Cartesian3.normalize(C.Cartesian3.cross(edge1,edge2,new C.Cartesian3()),new C.Cartesian3());
  const geometry=new C.Geometry({attributes:{
    position:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.DOUBLE,componentsPerAttribute:3,values:new Float64Array(corners.flatMap(p=>[p.x,p.y,p.z]))}),
    normal:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.FLOAT,componentsPerAttribute:3,values:new Float32Array(Array.from({length:4},()=>[n.x,n.y,n.z]).flat())}),
    st:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.FLOAT,componentsPerAttribute:2,values:new Float32Array([0,0,1,0,1,1,0,1])})},
    indices:new Uint16Array([0,1,2,0,2,3]),primitiveType:C.PrimitiveType.TRIANGLES,boundingSphere:C.BoundingSphere.fromPoints(corners)});
  const material=new C.Material({fabric:{type:'PhotoboothPhoto',uniforms:{image:config.surface.image},
    source:`czm_material czm_getMaterial(czm_materialInput materialInput){czm_material m=czm_getDefaultMaterial(materialInput);m.diffuse=texture(image,materialInput.st).rgb;m.alpha=1.0;return m;}`}});
  collection.add(new C.Primitive({geometryInstances:new C.GeometryInstance({geometry,id:new C.Entity({
    id:`${config.id}:${config.surface.id}`,name:config.label,properties:{...properties,targetSurfaceId:config.surface.id,
      replacementSlot:config.surface.alias,replacementSlotKey:config.surface.slotKey,sourcePhoto:config.surface.photo}})}),
    appearance:new C.MaterialAppearance({material,materialSupport:C.MaterialAppearance.MaterialSupport.TEXTURED,flat:true,faceForward:true,closed:false,translucent:false}),asynchronous:false}));
  let disposed=false,current='',request=0;
  return {source,collection,
    setVisible(show){source.show=!!show;collection.show=!!show;viewer.scene.requestRender();},
    setReplacements(replacements=[]){const url=replacements.find(r=>r.slot_key===config.surface.slotKey)?.image_url||'';
      if(url===current)return;current=url;const revision=++request;
      const reset=()=>{material.uniforms.image=config.surface.image;viewer.scene.requestRender();};
      if(!url){reset();return;}const image=new Image();image.crossOrigin='anonymous';
      image.onload=()=>{if(disposed||revision!==request)return;material.uniforms.image=image;viewer.scene.requestRender();};
      image.onerror=()=>{if(disposed||revision!==request)return;current='';reset();};image.src=url;},
    surfacePosition(extra=0){const p=photoboothSurfaceCenter();p[2]+=extra;return world(p);},
    focus(duration=.7,normalHeading=config.normalHeading){viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);
      viewer.camera.flyToBoundingSphere(new C.BoundingSphere(this.surfacePosition(),config.width/2),{duration,
        offset:new C.HeadingPitchRange(C.Math.toRadians((normalHeading+180)%360),-.10,config.width*1.55)});return true;},
    destroy(){disposed=true;request++;viewer.dataSources.remove(source,true);viewer.scene.primitives.remove(collection);}
  };
}

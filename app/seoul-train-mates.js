// User-confirmed constraint: rear wall flush with the escalator's south side.
// B_1_25_10.bin F003 / F02MV011 decoded side edge in the app's ENU frame.
export const TRAIN_MATES_ESCALATOR_EDGE = Object.freeze({
  start:[-100.01969251,-36.42668300],end:[-87.02213494,-41.14981527],
  tangent:[.939868932045,-.341535343086],inwardNormal:[.341535343086,.939868932045],
  // F004/F02WL060 under-escalator side projects 8.56cm outside the handrail.
  // Use the outer supporting line to touch it without penetrating either mesh.
  supportingOffset:-68.482180777736,
});
export const TRAIN_MATES = Object.freeze({
  id:'TRAIN-MATES-SEOUL-2F', name:'TRAIN MATES · 철도기념품', floor:'2F', zoneId:'Z-2F-02',
  centerEast:-95.029287651896, centerNorth:-40.782623097138, baseUp:36.23, headingDeg:19.9704431,
  width:9.792, depth:4.608, height:2.72, signHeight:0.49, scaleX:1, scaleY:1, scaleZ:1,
  origin:[126.97120460405696,37.55452066661308,0],
});
export const TRAIN_MATES_SURFACES = Object.freeze([
  {id:'south-front',alias:'TRAIN-MATES-FRONT-S01',image:'/assets/seoul-train-mates/south-front.png',width:9.792,height:3.21},
  {id:'east-side',alias:'TRAIN-MATES-RIGHT-S01',image:'/assets/seoul-train-mates/east-side.png',width:4.608,height:2.72},
  {id:'west-side',alias:'TRAIN-MATES-LEFT-S01',image:'/assets/seoul-train-mates/east-side.png',width:4.608,height:2.72},
]);
// User requested the identical east photo on west; align the shell opening to it.
// Photo coordinates are a visual reference, not surveyed west-side dimensions.
export const TRAIN_MATES_WEST_ENTRANCE = Object.freeze({id:'west-entrance',centerY:2.304-4.608*1231/1681,width:4.608*356/1681,height:2.72*821/935,estimated:true});
export function isTrainMatesSlot(slot) {
  return slot?.target_asset_id===TRAIN_MATES.id || TRAIN_MATES_SURFACES.some(s=>s.alias===(slot?.slot_alias||slot?.imageId));
}
export function trainMatesPoint(placement,x,y,z) {
  const a=placement.headingDeg*Math.PI/180;
  return [placement.centerEast+x*Math.cos(a)+y*Math.sin(a),
    placement.centerNorth-x*Math.sin(a)+y*Math.cos(a),placement.baseUp+z];
}
export function buildTrainMates(Cesium,viewer,source,placement,enuPosition) {
  const a=TRAIN_MATES,w=a.width/2,d=a.depth/2,h=a.height;
  const point=(x,y,z)=>enuPosition(Cesium,...trainMatesPoint(placement,x,y,z));
  const properties={assetId:a.id,targetAssetId:a.id,zoneId:a.zoneId,floor:a.floor,surveyed:false};
  const position=point(0,0,0);
  const orientation=Cesium.Transforms.headingPitchRollQuaternion(position,new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(placement.headingDeg),0,0));
  const box=(suffix,x,y,z,width,depth,height,color,extra={})=>source.entities.add({
    id:`asset:${a.id}:${suffix}`,name:a.name,properties:{...properties,...extra},position:point(x,y,z+height/2),orientation,
    box:{dimensions:new Cesium.Cartesian3(width,depth,height),material:Cesium.Color.fromCssColorString(color)},
  });
  // West wall has a real open doorway, not a painted door on a blocking box.
  box('rear',0,d-.04,0,a.width,.08,h,'#536c63');
  const door=TRAIN_MATES_WEST_ENTRANCE,doorSouth=door.centerY-door.width/2,doorNorth=door.centerY+door.width/2;
  const westProperties={targetSurfaceId:door.id,placementEstimated:true,entrance:true};
  // Recess the shell 2cm behind the photo plane to avoid coplanar flickering.
  box('west-south',-w+.06,(-d+doorSouth)/2,0,.08,d+doorSouth,h,'#536c63');
  box('west-north',-w+.06,(d+doorNorth)/2,0,.08,d-doorNorth,h,'#536c63');
  box('west-entrance-lintel',-w+.06,door.centerY,door.height,.08,door.width,h-door.height,'#536c63',westProperties);
  for(const y of [doorSouth,doorNorth])box(`west-door-jamb-${y}`, -w+.05,y,0,.08,.055,door.height,'#91a99f',westProperties);
  box('west-door-header',-w+.05,door.centerY,door.height-.055,.08,door.width,.055,'#91a99f',westProperties);
  box('upper-front',0,-d+.04,h-.08,a.width,.08,.08,'#628077');
  box('upper-east',w-.04,0,h-.08,.08,a.depth,.08,'#628077');
  const primitives=viewer.scene.primitives.add(new Cesium.PrimitiveCollection());
  const records=[];
  function photo(surface,part,corners,min,span) {
    const material=new Cesium.Material({fabric:{type:'TrainMatesPhoto',uniforms:{image:surface.image,
      cropMin:new Cesium.Cartesian2(...min),cropSpan:new Cesium.Cartesian2(...span),flipV:surface.id==='east-side'?1:0},
      source:`czm_material czm_getMaterial(czm_materialInput materialInput) {
        czm_material m=czm_getDefaultMaterial(materialInput);
        // Crops use image top-left pixels; Cesium uploads this PNG bottom-up.
        float t=mix(materialInput.st.y,1.0-materialInput.st.y,flipV);
        vec2 uv=vec2(cropMin.x+materialInput.st.x*cropSpan.x,
          1.0-cropMin.y-(1.0-t)*cropSpan.y);
        vec4 c=texture(image,uv);m.diffuse=c.rgb;m.alpha=1.0;return m;
      }`}});
    const geometry=new Cesium.CoplanarPolygonGeometry({
      polygonHierarchy:new Cesium.PolygonHierarchy(corners.map(p=>point(...p))),
      textureCoordinates:new Cesium.PolygonHierarchy([[0,0],[1,0],[1,1],[0,1]].map(p=>new Cesium.Cartesian2(...p))),
      vertexFormat:Cesium.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
    });
    primitives.add(new Cesium.Primitive({geometryInstances:new Cesium.GeometryInstance({geometry,
      id:new Cesium.Entity({id:`asset:${a.id}:${part}`,name:`${a.name} · ${surface.alias}`,
        properties:{...properties,targetSurfaceId:surface.id,replacementSlot:surface.alias}})}),
      appearance:new Cesium.MaterialAppearance({material,materialSupport:Cesium.MaterialAppearance.MaterialSupport.TEXTURED,
        flat:true,faceForward:true,closed:false,translucent:false}),asynchronous:false}));
    records.push({surface,material,url:'',request:0});
  }
  const front=TRAIN_MATES_SURFACES[0],side=TRAIN_MATES_SURFACES[1],west=TRAIN_MATES_SURFACES[2];
  // The generated atlas has opaque unused upper corners: never draw those pixels.
  // Preserve a raised, half-width sign instead of a full-width rectangular banner.
  photo(front,'south-front',[[-w,-d,0],[w,-d,0],[w,-d,h],[-w,-d,h]],[0,120/770],[1,650/770]);
  const signLeft=-w+a.width*505/2042,signRight=-w+a.width*1538/2042;
  photo(front,'south-sign',[[signLeft,-d,h],[signRight,-d,h],[signRight,-d,h+a.signHeight],[signLeft,-d,h+a.signHeight]],
    [506/2042,6/770],[1030/2042,111/770]);
  photo(side,'east-side',[[w,-d,0],[w,d,0],[w,d,h],[w,-d,h]],[0,0],[1,1]);
  // Viewed from west: image left is north, image right is south. Do not mirror pixels.
  photo(west,'west-side',[[-w,d,0],[-w,-d,0],[-w,-d,h],[-w,d,h]],[0,0],[1,1]);
  let disposed=false;
  return {
    setVisible(show){primitives.show=Boolean(show);},
    setReplacements(replacements=[]){
      for(const r of records){
        const item=replacements.find(item=>isTrainMatesSlot(item.slot)&&item.slot?.target_surface_id===r.surface.id);
        const url=item?.image_url||'';if(url===r.url)continue;r.url=url;const request=++r.request;
        if(!url){r.material.uniforms.image=r.surface.image;viewer.scene.requestRender();continue;}
        const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{
          if(disposed||r.request!==request)return;r.material.uniforms.image=img;viewer.scene.requestRender();};
        img.onerror=()=>{if(disposed||r.request!==request)return;
          r.url='';r.material.uniforms.image=r.surface.image;viewer.scene.requestRender();};img.src=url;
      }
    },
    surfacePosition(surfaceId,extra=0){return surfaceId==='west-side'||surfaceId==='west-entrance'?point(-w,0,h/2+extra):surfaceId==='east-side'?point(w,0,h/2+extra):point(0,-d,(h+a.signHeight)/2+extra);},
    focus(surfaceId,duration=.7){
      const west=surfaceId==='west-side'||surfaceId==='west-entrance',side=surfaceId==='east-side'||west;const center=this.surfacePosition(surfaceId);
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(center,side?d:w),{duration,
        offset:new Cesium.HeadingPitchRange(Cesium.Math.toRadians(placement.headingDeg+(west?90:side?250:0)),west?-.12:side?-.3:-.12,west?5.5:side?8:14)});
    },
    destroy(){disposed=true;records.forEach(r=>r.request++);viewer.scene.primitives.remove(primitives);},
  };
}

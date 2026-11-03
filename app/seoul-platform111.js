import config from './seoul-platform111.json' with {type:'json'};
import windowLayout from './seoul-platform111-window.json' with {type:'json'};
import {acquirePlatformSlides,PLATFORM111_SLIDES} from './platform111-slides.js';
export const PLATFORM111=Object.freeze(config);
// One catalog facility and two slots; the 3F presentation follows the selected window bank.
export const PLATFORM111_WINDOW=Object.freeze(windowLayout);
export const PLATFORM111_SURFACES=Object.freeze([config.media,config.tids]);
export const platform111VisibleOnFloor=floor=>config.enabled && [config.floor,windowLayout.floor].includes(floor);
export const platform111Surface=value=>PLATFORM111_SURFACES.find(s=>[s.id,s.alias,s.slotKey].includes(value));
export function isPlatform111Slot(slot){return slot?.site_id===config.site &&
  (PLATFORM111_SURFACES.some(s=>s.slotKey===slot.slot_key) || slot.target_asset_id===config.id);}
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function platform111Spans(surface,layout=config){
  const scale=layout.length/config.length;
  let total=0;const result=[];
  for(let i=1;i<layout.points.length;i++){
    const a=layout.points[i-1],b=layout.points[i],length=distance(a,b),lo=Math.max(total,surface.start*scale),hi=Math.min(total+length,surface.end*scale);
    if(hi-lo>1e-7){const at=s=>a.map((n,k)=>n+(b[k]-n)*(s-total)/length);
      result.push({a:at(lo),b:at(hi),start:lo/scale,end:hi/scale,physicalLength:hi-lo,normal:[(b[1]-a[1])/length,-(b[0]-a[0])/length,0]});}
    total+=length;
  }return result;
}
export function platform111SurfaceCenter(surface,layout=config){
  const s=(surface.start+surface.end)/2,span=platform111Spans(surface,layout).find(p=>p.start<=s && p.end>=s);
  const t=(s-span.start)/(span.end-span.start);
  return span.a.map((n,k)=>n+(span.b[k]-n)*t+(k===2?layout.height/2:0));
}
// Unit square -> photographed quadrilateral, in top-left image coordinates.
// Sampling the actual photo avoids inventing timetable text during image repair.
export function platform111Homography(q){
  const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=q;
  const dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3,dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3;
  const det=dx1*dy2-dx2*dy1,g=(dx3*dy2-dx2*dy3)/det,h=(dx1*dy3-dx3*dy1)/det;
  return [[x1-x0+g*x1,x3-x0+h*x3,x0],[y1-y0+g*y1,y3-y0+h*y3,y0],[g,h,1]];
}
export const createPlatform111Window=(C,viewer,site)=>createPlatform111(C,viewer,site,windowLayout);
export async function createPlatform111(C,viewer,site,layout=config){
  if(!config.enabled || site!==config.site)return null;
  const frame=C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(...layout.origin));
  const world=p=>C.Matrix4.multiplyByPoint(frame,new C.Cartesian3(...p),new C.Cartesian3());
  const collection=viewer.scene.primitives.add(new C.PrimitiveCollection());
  const source=new C.CustomDataSource(layout.id);await viewer.dataSources.add(source);
  const properties={facilityAssetId:config.id,targetAssetId:config.id,floor:layout.floor,surveyed:false};
  const records=[];
  for(const surface of PLATFORM111_SURFACES){
    const homography=platform111Homography(config.tids.photoQuad),crop=config.media.crop;
    const material=new C.Material({fabric:{type:'Platform111TwoFrames',uniforms:{image:surface.image,baseline:1,slideMode:0,frameIndex:0,slideImage:C.Material.DefaultImageId,textImage:PLATFORM111_SLIDES.text,
      slideRepeat:(surface.end-surface.start)*(layout.length/config.length)/(layout.height*PLATFORM111_SLIDES.aspect),
      textRepeat:(surface.end-surface.start)*(layout.length/config.length)/(layout.height*PLATFORM111_SLIDES.textAspect),
      photoMode:surface===config.tids?1:0,repeatCount:(surface.end-surface.start)*(layout.length/config.length)/(config.media.repeatPeriod*layout.height/config.height),
      cropMin:new C.Cartesian2(crop[0],crop[1]),cropSpan:new C.Cartesian2(crop[2],crop[3]),
      h0:new C.Cartesian3(...homography[0]),h1:new C.Cartesian3(...homography[1]),h2:new C.Cartesian3(...homography[2])},
      source:`czm_material czm_getMaterial(czm_materialInput materialInput){
        czm_material m=czm_getDefaultMaterial(materialInput);vec2 st=materialInput.st;vec2 uv=st;
        if(slideMode>0.5){
          // Preserve each frame's aspect ratio and the train/logo direction.
          float repeatCount=frameIndex>0.5?textRepeat:slideRepeat;
          uv=vec2(fract(st.x*repeatCount),st.y);
        }
        else if(baseline>0.5){
          if(photoMode>0.5){vec3 p=vec3(st.x,1.0-st.y,1.0);float w=dot(h2,p);uv=vec2(dot(h0,p)/w,1.0-dot(h1,p)/w);}
          else{float u=1.0-abs(mod(st.x*repeatCount,2.0)-1.0);uv=vec2(cropMin.x+u*cropSpan.x,1.0-cropMin.y-(1.0-st.y)*cropSpan.y);}
        }
        vec3 color=slideMode>0.5?(frameIndex>0.5?texture(textImage,uv).rgb:texture(slideImage,uv).rgb):texture(image,uv).rgb;
        m.diffuse=vec3(0.0);m.emission=color;m.alpha=1.0;return m;
      }`}});
    records.push({surface,material,url:'',request:0,image:surface.image,baseline:1});
    for(const [index,span] of platform111Spans(surface,layout).entries()){
      const {a,b,normal}=span,corners=[a,b,b.map((n,k)=>n+(k===2?layout.height:0)),a.map((n,k)=>n+(k===2?layout.height:0))].map(world);
      const edge1=C.Cartesian3.subtract(corners[1],corners[0],new C.Cartesian3()),edge2=C.Cartesian3.subtract(corners[3],corners[0],new C.Cartesian3());
      const n=C.Cartesian3.normalize(C.Cartesian3.cross(edge1,edge2,new C.Cartesian3()),new C.Cartesian3());
      const u0=(span.start-surface.start)/(surface.end-surface.start),u1=(span.end-surface.start)/(surface.end-surface.start);
      const geometry=new C.Geometry({attributes:{
        position:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.DOUBLE,componentsPerAttribute:3,values:new Float64Array(corners.flatMap(p=>[p.x,p.y,p.z]))}),
        normal:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.FLOAT,componentsPerAttribute:3,values:new Float32Array(Array.from({length:4},()=>[n.x,n.y,n.z]).flat())}),
        st:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.FLOAT,componentsPerAttribute:2,values:new Float32Array([u0,0,u1,0,u1,1,u0,1])})},
        indices:new Uint16Array([0,1,2,0,2,3]),primitiveType:C.PrimitiveType.TRIANGLES,boundingSphere:C.BoundingSphere.fromPoints(corners)});
      const entity=new C.Entity({id:`${layout.id}:${surface.id}:${index}`,name:`${config.label} · ${surface.label}`,
        properties:{...properties,targetSurfaceId:surface.id,replacementSlot:surface.alias,replacementSlotKey:surface.slotKey}});
      collection.add(new C.Primitive({geometryInstances:new C.GeometryInstance({geometry,id:entity}),
        appearance:new C.MaterialAppearance({material,materialSupport:C.MaterialAppearance.MaterialSupport.TEXTURED,flat:true,faceForward:true,closed:false,translucent:false}),asynchronous:false}));
      // The window backing stays within its exact top/bottom bounds: no skirt into the void.
      const angle=Math.atan2(b[1]-a[1],b[0]-a[0]);
      const rotation=C.Matrix4.multiply(frame,C.Matrix4.fromRotationTranslation(C.Matrix3.fromRotationZ(angle)),new C.Matrix4());
      const orientation=C.Quaternion.fromRotationMatrix(C.Matrix4.getMatrix3(rotation,new C.Matrix3()));
      const center=a.map((v,k)=>(v+b[k])/2-normal[k]*(layout.depth/2+.015));
      source.entities.add({id:`${entity.id}:back`,name:config.label,properties,position:world([center[0],center[1],center[2]+layout.height/2]),orientation,
        box:{dimensions:new C.Cartesian3(span.physicalLength+.003,layout.depth,layout.height+(layout.backingHeightExtra??.10)),material:C.Color.fromCssColorString('#12191c'),shadows:C.ShadowMode.DISABLED}});
    }
  }
  let disposed=false,visible=true,near=false,poster=null;
  const mediaRecord=records.find(r=>r.surface===config.media);
  const refresh=r=>{
    const slide=r===mediaRecord&&poster;
    // Keep the preloaded full-bleed slide separate from asynchronous catalog
    // image requests, which can otherwise finish later and overwrite its texture.
    r.material.uniforms.image=r.image;r.material.uniforms.baseline=r.baseline;
    if(slide)r.material.uniforms.slideImage=slide;
    r.material.uniforms.slideMode=slide?1:0;viewer.scene.requestRender();
  };
  const playback=acquirePlatformSlides(viewer,index=>{mediaRecord.material.uniforms.frameIndex=index;});
  const photoCredit=new C.Credit(PLATFORM111_SLIDES.creditHtml);
  const posterImage=new Image();posterImage.onload=()=>{if(!disposed){poster=posterImage;refresh(mediaRecord);}};posterImage.src=PLATFORM111_SLIDES.image;
  const sphere=C.BoundingSphere.fromPoints(layout.points.map(p=>world(p)));
  function visibility(){
    if(disposed)return;
    const camera=viewer.camera,range=C.Cartesian3.distance(camera.positionWC,sphere.center)-sphere.radius;
    const frustum=camera.frustum.computeCullingVolume(camera.positionWC,camera.directionWC,camera.upWC);
    near=visible&&range<230&&frustum.computeVisibility(sphere)!==C.Intersect.OUTSIDE;
    if(near&&poster&&mediaRecord.material.uniforms.frameIndex===0)viewer.creditDisplay.addCreditToNextFrame(photoCredit);
    playback.setActive(near);
  }
  const remove=viewer.scene.preRender.addEventListener(visibility);
  return {source,collection,
    setVisible(show){visible=!!show;source.show=visible;collection.show=visible;visibility();viewer.scene.requestRender();},
    setReplacements(replacements=[]){for(const r of records){
      const url=replacements.find(item=>item.slot_key===r.surface.slotKey)?.image_url||'';
      if(url===r.url)continue;r.url=url;const request=++r.request;
      const reset=()=>{r.image=r.surface.image;r.baseline=1;refresh(r);};
      if(!url){reset();continue;}
      const image=new Image();image.crossOrigin='anonymous';
      image.onload=()=>{if(disposed||request!==r.request)return;r.image=image;r.baseline=0;refresh(r);};
      image.onerror=()=>{if(disposed||request!==r.request)return;r.url='';reset();};image.src=url;
    }},
    surfacePosition(id,extra=0){const p=platform111SurfaceCenter(platform111Surface(id)||config.media,layout);p[2]+=extra;return world(p);},
    focus(id,duration=.7){const surface=platform111Surface(id)||config.media,isTids=surface===config.tids;
      const center=isTids?this.surfacePosition(surface.id):world(layout.focusCenter||[39,53,config.points[0][2]+config.height/2]);
      viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);
      viewer.camera.flyToBoundingSphere(new C.BoundingSphere(center,isTids?6:49),{duration,
        offset:new C.HeadingPitchRange(C.Math.toRadians(isTids?170:145),isTids?-.08:-.32,isTids?19:104)});return true;},
    destroy(){disposed=true;remove();playback.destroy();posterImage.onload=null;records.forEach(r=>r.request++);viewer.dataSources.remove(source,true);viewer.scene.primitives.remove(collection);}
  };
}

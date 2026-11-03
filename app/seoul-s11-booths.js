// User-confirmed 2026-09-14 black line: the RIGHT edge of the VERTICAL blue
// platform-13 panel, not the overhead 13/14 sign. Source geometry stays intact.
import retirement from './seoul-s11-retirement.json' with { type: 'json' };
import { retirementTriangleShaderChecks } from './seoul-feedback-retirement.js';

export const S11_ZONE = Object.freeze({
  site:'S202103', floor:'2F', origin:[126.97082,37.55363,27.2],
  oldJoint:[-40.1990892187,-0.2311856683,9.0583546939],
  tangent:[0.9860995457,-0.1661556079], normal:[0.1661556079,0.9860995457],
  shift:-2.5025387871, width:6.005749806, height:3.1127909461, depth:3.52691,
  anchorLocalX:-8.5082885931,
  sourcePhoto:'12. 2층 선상 에그폭탄주먹밥, 앤티앤즈.jpg',
  image:'/assets/seoul-s11-booths/egg-auntie-combined-front.png',
  atlasWidth:2172, atlasHeight:724, facadeHeightPx:709,
});
export const S11_RETIRED_SIGN = 'F02WL072-S10';
export const S11_SHOPS = Object.freeze([
  {id:'SEOUL-2F-AUNTIE-ANNES-01',label:'앤티앤즈 · 13번 승강장 앞',alias:'F02WL072-S11',
    slotKey:'fef09e7b7f5b1a87e771afa3bccb17b73b72345333cc9c626530ed38c5cd6c08',
    eastX:S11_ZONE.shift,width:S11_ZONE.width,imageX:847,imageWidth:1325},
  {id:'SEOUL-2F-EGG-RICEBALL-01',label:'에그폭탄&주먹밥 · 신설 매장',alias:'EGG-RICEBALL-FRONT-S01',
    slotKey:'cc073594e381ee854157e2028304acf2868c0f7fe19bef38cc758c48b8574389',
    eastX:S11_ZONE.shift+S11_ZONE.width*847/1325,width:S11_ZONE.width*847/1325,imageX:0,imageWidth:847},
]);

export function s11Point(x,y=0,z=0) {
  const a=S11_ZONE;
  return [a.oldJoint[0]+a.tangent[0]*x+a.normal[0]*y,
    a.oldJoint[1]+a.tangent[1]*x+a.normal[1]*y,a.oldJoint[2]+z];
}
export function s11ShopCenter(shop) {return s11Point(shop.eastX-shop.width/2,0.015,S11_ZONE.height/2);}
export function s11ShopForSlot(slot) {
  return S11_SHOPS.find(s=>s.slotKey===slot?.slot_key || s.alias===slot?.slot_alias || s.id===slot?.target_asset_id);
}
export function s11RetirementDeclarations(triangleChecks = retirementTriangleShaderChecks) {
  return `bool isS11RetirementPoint(vec3 p, vec2 rawUv) {
    if(p.x < -46.70 || p.x > -37.63 || p.y < -3.73 || p.y > 0.79 || p.z < 9.04 || p.z > 12.19) return false;
    return ${triangleChecks(retirement.triangles)};
  }`;
}

export async function createS11Booths(Cesium,viewer,site) {
  if(site!==S11_ZONE.site)return null;
  const frame=Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(...S11_ZONE.origin));
  const point=(x,y,z)=>Cesium.Matrix4.multiplyByPoint(frame,new Cesium.Cartesian3(...s11Point(x,y,z)),new Cesium.Cartesian3());
  const angle=Math.atan2(S11_ZONE.tangent[1],S11_ZONE.tangent[0]);
  const rotation=Cesium.Matrix4.multiply(frame,Cesium.Matrix4.fromRotationTranslation(Cesium.Matrix3.fromRotationZ(angle)),new Cesium.Matrix4());
  const orientation=Cesium.Quaternion.fromRotationMatrix(Cesium.Matrix4.getMatrix3(rotation,new Cesium.Matrix3()));
  const source=new Cesium.CustomDataSource('STATION_ONE_S11_CURRENT_SHOPS');
  await viewer.dataSources.add(source);
  const primitives=viewer.scene.primitives.add(new Cesium.PrimitiveCollection());
  const records=new Map();
  for(const shop of S11_SHOPS) {
    const properties={facilityAssetId:shop.id,targetAssetId:shop.id,targetSurfaceId:'front-facade',
      replacementSlot:shop.alias,replacementSlotKey:shop.slotKey,floor:'2F',source:S11_ZONE.sourcePhoto,surveyed:false};
    source.entities.add({id:`${shop.id}:body`,name:shop.label,properties,
      position:point(shop.eastX-shop.width/2,-S11_ZONE.depth/2,S11_ZONE.height/2),orientation,
      box:{dimensions:new Cesium.Cartesian3(shop.width,S11_ZONE.depth,S11_ZONE.height),
        material:Cesium.Color.fromCssColorString('#525a5b'),shadows:Cesium.ShadowMode.ENABLED}});
    const corners=[[shop.eastX,0],[shop.eastX-shop.width,0],
      [shop.eastX-shop.width,S11_ZONE.height],[shop.eastX,S11_ZONE.height]].map(([x,z])=>point(x,0.018,z));
    const material=new Cesium.Material({fabric:{type:'S11Facade',uniforms:{image:S11_ZONE.image,
      cropMin:new Cesium.Cartesian2(shop.imageX/2172,0),cropSpan:new Cesium.Cartesian2(shop.imageWidth/2172,709/724)},
      source:`czm_material czm_getMaterial(czm_materialInput materialInput) {
        czm_material m=czm_getDefaultMaterial(materialInput);
        vec2 photoUv=vec2(materialInput.st.x,1.0-materialInput.st.y);
        vec4 c=texture(image,cropMin+photoUv*cropSpan); m.diffuse=c.rgb; m.alpha=1.0; return m;
      }`}});
    const geometry=new Cesium.CoplanarPolygonGeometry({polygonHierarchy:new Cesium.PolygonHierarchy(corners),
      textureCoordinates:new Cesium.PolygonHierarchy([[0,0],[1,0],[1,1],[0,1]].map(p=>new Cesium.Cartesian2(...p))),
      vertexFormat:Cesium.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat});
    const primitive=primitives.add(new Cesium.Primitive({geometryInstances:new Cesium.GeometryInstance({
      id:new Cesium.Entity({id:`${shop.id}:front-facade`,name:shop.label,properties}),geometry}),
      appearance:new Cesium.MaterialAppearance({material,materialSupport:Cesium.MaterialAppearance.MaterialSupport.TEXTURED,
        flat:true,faceForward:true,closed:false,translucent:false}),asynchronous:false}));
    records.set(shop.slotKey,{shop,material,primitive,url:'',request:0});
  }
  let disposed=false;
  return {
    source,primitives,
    setVisible(show){source.show=Boolean(show);primitives.show=Boolean(show);viewer.scene.requestRender();},
    setReplacements(replacements=[]){
      for(const [key,record] of records){
        const replacement=replacements.find(r=>r.slot_key===key),url=replacement?.image_url||'';
        if(record.url===url)continue;
        record.url=url;const request=++record.request;
        if(!url){record.material.uniforms.image=S11_ZONE.image;
          record.material.uniforms.cropMin=new Cesium.Cartesian2(record.shop.imageX/2172,0);
          record.material.uniforms.cropSpan=new Cesium.Cartesian2(record.shop.imageWidth/2172,709/724);
          viewer.scene.requestRender();continue;}
        const image=new Image();image.crossOrigin='anonymous';
        image.onload=()=>{if(disposed||request!==record.request)return;
          record.material.uniforms.image=image;record.material.uniforms.cropMin=new Cesium.Cartesian2(0,0);
          record.material.uniforms.cropSpan=new Cesium.Cartesian2(1,1);viewer.scene.requestRender();};
        image.onerror=()=>{if(request===record.request)record.url='';};image.src=url;
      }
    },
    focus(assetId,duration=0.7){
      const shop=S11_SHOPS.find(s=>s.id===assetId||s.alias===assetId);
      const east=shop?shop.eastX:S11_SHOPS[1].eastX;
      const width=shop?shop.width:S11_SHOPS.reduce((n,s)=>n+s.width,0);
      const center=point(east-width/2,-0.25,S11_ZONE.height/2);
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(center,width/2),{duration,
        // Remain in front of the shop, inside the concourse-side barrier.
        offset:new Cesium.HeadingPitchRange(Math.PI-angle,-0.18,Math.max(7,Math.min(12,width*0.95+2)))});
      return true;
    },
    destroy(){disposed=true;for(const r of records.values())r.request++;
      viewer.dataSources.remove(source,true);viewer.scene.primitives.remove(primitives);},
  };
}

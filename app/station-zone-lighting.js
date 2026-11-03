import zones from './seoul-lighting-zones.json' with {type:'json'};
export {zones as SEOUL_LIGHTING_ZONES};
export function inTriangle(p,t){
 const [a,b,c]=t,d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
 if(Math.abs(d)<1e-8)return false;
 const u=((b[1]-c[1])*(p[0]-c[0])+(c[0]-b[0])*(p[1]-c[1]))/d;
 const v=((c[1]-a[1])*(p[0]-c[0])+(a[0]-c[0])*(p[1]-c[1]))/d;
 return u>=-1e-6&&v>=-1e-6&&u+v<=1.000001;
}
export function stationLightingZone(p){
 if(p[2]<8.6||p[2]>14.8||!zones.floors.some(t=>inTriangle(p,t)))return null;
 return zones.slabs.some(t=>inTriangle(p,t))?'led':'daylight';
}
export function zoneDaylight(hour){return hour<=5.5||hour>=19.5?0:Math.sin(Math.PI*(hour-5.5)/14);}

// Two draw passes, no hundreds of shadow-casting point lights. The depth-based
// colour pass is spatial (ENU footprint + elevation), never a whole-camera tint.
export function createStationZoneLighting(C,viewer,{renderedFloors=()=>['2F']}={}){
 const scene=viewer.scene,frame=C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(...zones.origin));
 const inverse=C.Matrix4.inverseTransformation(frame,new C.Matrix4()),eyeToLocal=new C.Matrix4();
 const world=p=>C.Matrix4.multiplyByPoint(frame,new C.Cartesian3(...p),new C.Cartesian3());
 const [x0,y0,x1,y1]=zones.bounds,canvas=document.createElement('canvas');canvas.width=canvas.height=512;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,512,512);
 const draw=(ts,color)=>{ctx.fillStyle=color;for(const t of ts){ctx.beginPath();t.forEach((v,i)=>ctx[i?'lineTo':'moveTo']((v[0]-x0)/(x1-x0)*512,(y1-v[1])/(y1-y0)*512));ctx.closePath();ctx.fill();}};
 draw(zones.floors,'#00ff00');ctx.globalCompositeOperation='lighter';draw(zones.slabs,'#ff0000');
 let hour=12,destroyed=false;
 const positions=[],st=[],normals=[],indices=[];
 const normal=C.Matrix4.multiplyByPointAsVector(frame,new C.Cartesian3(0,0,-1),new C.Cartesian3());
 for(const t of zones.slabs){
  const start=positions.length/3;
  for(const p of t){const q=world([p[0],p[1],p[2]-zones.ceilingDrop]);positions.push(q.x,q.y,q.z);normals.push(normal.x,normal.y,normal.z);st.push((p[0]-x0)/(x1-x0),(p[1]-y0)/(y1-y0));}
  indices.push(start,start+2,start+1);
 }
 // MaterialAppearance's flag alone does not override a custom Fabric material:
 // its default translucency sent this opaque ceiling through the translucent
 // pass, leaving black gaps at walking height. Keep it in the opaque depth pass.
 const ceilingMaterial=new C.Material({translucent:false,fabric:{type:'StationSquareLedCeiling',uniforms:{panelSpacing:zones.panelSpacing,panelSize:zones.panelSize,localBounds:new C.Cartesian4(x0,y0,x1-x0,y1-y0)},source:`
 czm_material czm_getMaterial(czm_materialInput materialInput){
  czm_material m=czm_getDefaultMaterial(materialInput);vec2 p=materialInput.st*localBounds.zw+localBounds.xy;
  vec2 seam=abs(fract(p/0.6)-0.5);float tileLine=smoothstep(0.478,0.495,max(seam.x,seam.y));
  vec2 cell=abs(mod(p+panelSpacing*0.5,panelSpacing)-panelSpacing*0.5);
  float d=max(cell.x,cell.y),led=1.0-smoothstep(panelSize*0.5-0.012,panelSize*0.5,d);
  float rim=1.0-smoothstep(panelSize*0.5+0.035,panelSize*0.5+0.055,d);
  float halo=exp(-max(d-panelSize*.5,0.0)*3.8)*0.045;
  vec3 base=mix(vec3(0.80,0.80,0.76),vec3(0.60,0.63,0.62),tileLine*.42);
  base=mix(base,vec3(.57,.61,.62),rim);base=mix(base,vec3(.96,.985,1.0),led);
  m.diffuse=vec3(0.0);m.emission=base+halo;m.alpha=1.0;return m;
 }`}});
 const geometry=new C.Geometry({attributes:{
  position:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.DOUBLE,componentsPerAttribute:3,values:new Float64Array(positions)}),
  normal:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.FLOAT,componentsPerAttribute:3,values:new Float32Array(normals)}),
  st:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.FLOAT,componentsPerAttribute:2,values:new Float32Array(st)})},indices:new Uint16Array(indices),primitiveType:C.PrimitiveType.TRIANGLES,boundingSphere:C.BoundingSphere.fromVertices(positions)});
 const ceiling=scene.primitives.add(new C.Primitive({geometryInstances:new C.GeometryInstance({geometry,id:'SEOUL-2F-LED-CEILING'}),appearance:new C.MaterialAppearance({material:ceilingMaterial,materialSupport:C.MaterialAppearance.MaterialSupport.TEXTURED,flat:true,faceForward:false,closed:false,translucent:false,renderState:{cull:{enabled:true,face:C.CullFace.BACK}}}),asynchronous:false,allowPicking:false}));
 let stage;
 try{stage=scene.postProcessStages.add(new C.PostProcessStage({name:'station-spatial-lighting',uniforms:{
  coverage:canvas.toDataURL(),eyeToLocal:()=>C.Matrix4.multiply(inverse,viewer.camera.inverseViewMatrix,eyeToLocal),
  bounds:new C.Cartesian4(x0,y0,x1-x0,y1-y0),daylight:()=>zoneDaylight(hour),
  sunset:()=>Math.max(0,1-Math.abs(hour-18)/2.0)
 },fragmentShader:`
 uniform sampler2D colorTexture;uniform sampler2D depthTexture;uniform sampler2D coverage;
 uniform mat4 eyeToLocal;uniform vec4 bounds;uniform float daylight;uniform float sunset;
 in vec2 v_textureCoordinates;
 void main(){
  vec4 color=texture(colorTexture,v_textureCoordinates);float z=czm_unpackDepth(texture(depthTexture,v_textureCoordinates));
  if(z<=0.000001||z>=.999999){out_FragColor=color;return;}
  vec4 eye=czm_windowToEyeCoordinates(gl_FragCoord.xy,z);vec3 local=(eyeToLocal*(eye/eye.w)).xyz;
  vec2 uv=(local.xy-bounds.xy)/bounds.zw;
  if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0)))){out_FragColor=color;return;}
  vec2 mask=texture(coverage,uv).rg;
  float floorBand=smoothstep(8.5,8.95,local.z)*(1.0-smoothstep(13.4,14.8,local.z));
  float weight=mask.g*floorBand,covered=mask.r;
  vec3 led=color.rgb*1.035+vec3(.027,.030,.032);
  float panes=pow(.5+.5*cos(local.y*.95+local.x*.075),8.0);
  float windowWash=(.022+panes*.037)*daylight;
  vec3 sky=color.rgb*mix(.82,1.08,daylight)+vec3(.025,.037,.052)*daylight+vec3(windowWash)+vec3(.06,.022,0.0)*sunset;
  vec3 lit=mix(sky,led,covered);out_FragColor=vec4(mix(color.rgb,clamp(lit,0.0,1.0),weight),color.a);
 }`}));}catch{ /* Geometry still works on devices without depth post-processing. */ }
 const localCamera=new C.Cartesian3();
 function update(){
  if(destroyed)return;
  C.Matrix4.multiplyByPoint(inverse,viewer.camera.positionWC,localCamera);
  const floors=renderedFloors()||[],on2f=floors.includes('2F');
  // Keep floor/zone overviews and multi-floor management unobstructed.
  ceiling.show=on2f&&floors.length===1&&localCamera.z<13.65&&localCamera.z>8.4;
  if(stage)stage.enabled=on2f;
 }
 const remove=scene.preRender.addEventListener(update);update();
 return {setHour(h){hour=h;},zoneAtCamera(){C.Matrix4.multiplyByPoint(inverse,viewer.camera.positionWC,localCamera);return stationLightingZone([localCamera.x,localCamera.y,localCamera.z]);},destroy(){destroyed=true;remove();scene.primitives.remove(ceiling);if(stage)scene.postProcessStages.remove(stage);}};
}

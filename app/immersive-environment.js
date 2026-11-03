import {zoneEnvironment} from '../src/feedback-core.js';
import {createStationZoneLighting} from './station-zone-lighting.js';
export function immersiveEnvironment(C,viewer,post,hooks={}){
 const zones=createStationZoneLighting(C,viewer,hooks);
 let hour=12,requested='auto',effective='outdoor',last='',stage=null;
 const sunPos=()=>{const t=Math.max(0,Math.min(1,(hour-5)/15));return {alt:hour>=5&&hour<=20?Math.sin(t*Math.PI)*1.3:-0.3,az:(60+t*240)*Math.PI/180};};
 const shader=`uniform sampler2D colorTexture;
 uniform sampler2D depthTexture;
 uniform float daylight;
 uniform float warmGlow;
 uniform float cameraHeading;
 uniform float cameraPitch;
 uniform float sunAz;
 uniform float sunAlt;
 in vec2 v_textureCoordinates;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
 float fbm(vec2 p){float n=0.0,a=0.5;for(int i=0;i<6;i++){n+=noise(p)*a;p=p*2.04+vec2(13.1,7.7);a*=0.48;}return n;}
 void main(){vec4 scene=texture(colorTexture,v_textureCoordinates);float depth=czm_unpackDepth(texture(depthTexture,v_textureCoordinates));bool clearColor=distance(scene.rgb,vec3(0.6784314,0.8,0.8784314))<0.04;if(!clearColor||(depth>0.000001&&depth<0.999999)){out_FragColor=scene;return;}
 vec2 uv=v_textureCoordinates;float elevation=atan((uv.y-0.5)*1.35)+cameraPitch;float high=smoothstep(-0.12,0.9,elevation);
 vec3 horizon=mix(vec3(0.04,0.06,0.12),vec3(0.72,0.85,0.93),daylight);
 vec3 zenith=mix(vec3(0.008,0.018,0.06),vec3(0.15,0.42,0.72),daylight);
 horizon=mix(horizon,vec3(0.95,0.55,0.35),warmGlow*0.85);
 zenith=mix(zenith,vec3(0.45,0.35,0.55),warmGlow*0.3);
 vec3 sky=mix(horizon,zenith,high);
 float relAz=mod(sunAz-cameraHeading-(uv.x-0.5)*2.2+3.14159,6.28318)-3.14159;
 float relEl=sunAlt-(elevation-cameraPitch);float sunDist=length(vec2(relAz*0.75,relEl));
 if(sunAlt>-0.05){vec3 sunCol=mix(vec3(1.0,0.55,0.2),vec3(1.0,0.95,0.85),smoothstep(-0.05,0.8,sunAlt));float glow=exp(-sunDist*3.5)*max(0.0,daylight+warmGlow*0.5)*0.7;sky+=sunCol*glow;float disc=smoothstep(0.04,0.028,sunDist)*smoothstep(-0.05,0.05,sunAlt);sky=mix(sky,vec3(1.0,0.98,0.9),disc);}
 if(daylight<0.45){float moonRelAz=mod(sunAz+3.14159-cameraHeading-(uv.x-0.5)*2.2+3.14159,6.28318)-3.14159;float moonEl=max(0.15,0.7-sunAlt)-(elevation-cameraPitch);float moonDist=length(vec2(moonRelAz*0.75,moonEl));float moon=smoothstep(0.03,0.018,moonDist)*(1.0-daylight);float moonGlow=exp(-moonDist*5.0)*(1.0-daylight)*0.18;sky+=vec3(0.6,0.68,0.8)*(moon+moonGlow);}
 vec2 cp=vec2(uv.x*3.5+cameraHeading*1.7,1.8/max(0.22,elevation+0.5));float cloud=smoothstep(0.44,0.72,fbm(cp))*0.7+smoothstep(0.38,0.75,fbm(cp*2.3+vec2(4.7,2.1)))*0.3;cloud*=smoothstep(-0.08,0.3,elevation)*(0.6+0.25*daylight);
 float cloudSun=max(0.0,dot(normalize(vec2(uv.x-0.5,elevation*0.5+0.01)),normalize(vec2(relAz,sunAlt+0.01))))*0.35;
 vec3 cloudCol=mix(vec3(0.18,0.22,0.30),vec3(0.96,0.97,0.98),daylight);cloudCol=mix(cloudCol,mix(vec3(0.95,0.6,0.35),vec3(1.0,0.98,0.95),daylight),cloudSun);sky=mix(sky,cloudCol,cloud);
 float starH=hash(floor(vec2(uv.x+cameraHeading*0.2,uv.y+cameraPitch)*vec2(1100.0,700.0)));float star=step(0.9975,starH)*(1.0-daylight)*(1.0-cloud)*smoothstep(0.0,0.35,elevation)*(0.5+0.5*starH);sky+=vec3(star*0.75);
 float haze=smoothstep(0.12,-0.06,elevation)*daylight*0.3;sky=mix(sky,vec3(0.82,0.88,0.92),haze);
 sky=mix(mix(vec3(0.04,0.055,0.065),vec3(0.55,0.60,0.58),daylight),sky,smoothstep(-0.65,-0.06,elevation));out_FragColor=vec4(sky,1.0);}`;
 try{stage=viewer.scene.postProcessStages.add(new C.PostProcessStage({name:'station-procedural-sky',fragmentShader:shader,uniforms:{
  daylight:()=>Math.max(0,Math.min(1,(Math.sin((hour-6)/24*Math.PI*2)+.13)*1.25)),
  warmGlow:()=>Math.max(Math.max(0,1-Math.abs(hour-6)/2.3),Math.max(0,1-Math.abs(hour-18.5)/2.3)),
  cameraHeading:()=>viewer.camera.heading,cameraPitch:()=>viewer.camera.pitch,
  sunAz:()=>sunPos().az,sunAlt:()=>sunPos().alt
 }}));}catch{post({notice:'하늘 효과를 지원하지 않아 기본 배경으로 표시합니다.'});}
 function tick(){const p=viewer.camera.positionCartographic,zone=zones.zoneAtCamera();effective=requested==='auto'?zoneEnvironment(zone,[C.Math.toDegrees(p.longitude),C.Math.toDegrees(p.latitude),p.height]):requested;const key=effective+hour+zone;if(key===last)return;last=key;if(stage)stage.enabled=effective==='outdoor';
  const dayI=Math.max(0.35,0.5+Math.max(0,Math.sin(Math.max(0,Math.min(1,(hour-5)/15))*Math.PI))*0.9);
  viewer.scene.backgroundColor=C.Color.fromCssColorString(effective==='indoor'?'#e3e9e4':'#adcce0');viewer.scene.light=new C.SunLight({intensity:effective==='indoor'?1.55:dayI});viewer.scene.requestRender();post({lighting:effective==='indoor'?(zone==='led'?'사각 LED · 낮은 천장':'주광색 실내'):zone==='daylight'?'시간대 자연채광 · 상부 개방 공간':'시간대 야외 자연채광',environmentBasis:requested!=='auto'?'수동':zone?'3층 바닥 투영·2층 바닥 기반 / 조도는 시각화 추정':'카메라 좌표·근사 공간 경계'});}
 const remove=viewer.scene.preRender.addEventListener(tick);
 return {set(h,e){hour=h;zones.setHour(h);requested=['auto','indoor','outdoor'].includes(e)?e:'auto';last='';tick();},destroy(){remove();zones.destroy();if(stage)viewer.scene.postProcessStages.remove(stage);}};
}

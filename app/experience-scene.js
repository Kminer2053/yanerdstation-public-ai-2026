import {makePath,samplePath,skyForHour,trafficStyle,coordinateDistance} from '../src/experience-core.js';
import {immersiveEnvironment} from './immersive-environment.js';
import {createCrowdLayer} from './crowd-layer.js';
import {createFacilityMarkers} from './facility-markers.js';
import {createManagerOverlay} from './manager-overlay.js';
import {buildWalkIndex,toLocal,toLonLat,slideMove,openHeading,cellAt} from '../src/crowd-core.js';
import {createExplorerAvatar} from './explorer-avatar.js';
import {createPlayState,resetPlay,playAction,tickPlay} from '../src/exploration-play.js';
import {floorExplorePoint} from '../src/feedback-core.js';
import {createZoneAnalysis} from './zone-analysis.js';
export function createExperienceScene(C,viewer,hooks){
  const overlay=new C.CustomDataSource('experience-guidance');viewer.dataSources.add(overlay);
  const analysis=new C.CustomDataSource('spatial-retail-analysis');viewer.dataSources.add(analysis);
  let viewTarget=[126.97065,37.55395,36],viewRange=190,viewHeading=325,viewPitch=-48;
  const keys=new Set(),touchKeys=new Set();
  const clearKeys=()=>{keys.clear();touchKeys.clear();};
  const hasKey=k=>keys.has(k)||touchKeys.has(k);
  let route=null,path=null,distance=0,playing=false,mode='overview',speed=2.4,last=performance.now(),time=0,hour=12,environment='auto',flowRoutes=[],flowValues=[],flowMax=1,free=null,graph=null,heading=0,pitch=-.07,disposed=false,drawnFlows=[],flowStyle='arrows';
  let bob=true,graphPromise=null,departure=null,visibleFloors=null,walkIndex=null,birdFloor='2F',birdHeight=36,markerClock=1e9,lookDrag=null;
  const MOVE_KEYS=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','ShiftLeft','ShiftRight','Equal','Minus','NumpadAdd','NumpadSubtract','PageUp','PageDown']);
  const post=data=>{if(window.parent!==window)window.parent.postMessage({type:'station-one:experience-state',...data},location.origin)};
  const renderedFloors=()=>hooks.renderedFloors?.()??visibleFloors??(free?.floor?[free.floor]:null);
  const environmentLayer=immersiveEnvironment(C,viewer,post,{renderedFloors});
  const crowd=createCrowdLayer(C,viewer,{loadIndex:loadWalkIndex,loadCirculation:()=>fetch('/data/experience/circulation-3f.json').then(r=>{if(!r.ok)throw Error('3층 순환 경로 없음');return r.json();}),post,mobile:matchMedia('(max-width:650px)').matches,renderedFloors});
  const markers=createFacilityMarkers(C,viewer);
  const cart=(p,offset=0)=>C.Cartesian3.fromDegrees(p[0],p[1],p[2]+offset);
  const valid=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)&&p[0]>126.95&&p[0]<126.99&&p[1]>37.53&&p[1]<37.58&&p[2]>-80&&p[2]<120;
  const managerOverlay=createManagerOverlay(C,viewer,{post,valid});
  const zoneLayer=createZoneAnalysis(C,viewer);
  let exploreView='first',avatarRange=4,rayLimit=4,rayClock=0,playLabel='';
  const play=createPlayState(),avatar=createExplorerAvatar(C,viewer,{onError:()=>{exploreView='first';resetPlay(play);post({mode,exploreView,error:'아바타를 불러오지 못해 1인칭으로 전환했습니다.'});}});
  const endPlay=()=>{resetPlay(play);avatar.hide();};
  function actionPlay(action){if(playAction(play,action,{mode,view:exploreView,riding:Boolean(free?.ride)})){post({playAction:action});setCamera();viewer.scene.requestRender();}}
  function thirdCamera(){
    // Camera clearance is cosmetic too: never feed its height/range back to navigation.
    pitch=Math.max(-.65,Math.min(-.12,pitch));
    const target=cart(free.position,1.05+play.jumpHeight*.3),back=new C.Cartesian3(-Math.sin(heading)*Math.cos(pitch),-Math.cos(heading)*Math.cos(pitch),-Math.sin(pitch));
    let range=4;
    if(!free.ride)for(let d=.3;d<=4;d+=.2){if(cellAt(walkIndex,free.floor,free.x+back.x*d,free.y+back.y*d,free.h)<0){range=Math.max(.55,d-.25);break;}}
    if(performance.now()-rayClock>140){
      rayClock=performance.now();rayLimit=4;
      try{const dir=C.Cartesian3.normalize(C.Matrix4.multiplyByPointAsVector(C.Transforms.eastNorthUpToFixedFrame(target),back,new C.Cartesian3()),new C.Cartesian3());
        for(const hit of viewer.scene.drillPickFromRay(new C.Ray(target,dir),8)||[]){const o=hit?.object;if(!hit.position||!(o instanceof C.Cesium3DTileFeature||o?.primitive instanceof C.Cesium3DTileset))continue;const d=C.Cartesian3.distance(target,hit.position);if(d>.2)rayLimit=Math.min(rayLimit,Math.max(.55,d-.25));}
      }catch{}
    }
    range=Math.min(range,rayLimit);avatarRange=range<avatarRange?range:Math.min(range,avatarRange+.045);
    viewer.camera.lookAt(target,new C.HeadingPitchRange(heading,pitch,avatarRange));viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);
    avatar.update({visible:avatarRange>.85,position:free.position,heading,walked:free.walked,moving:free.moving&&!free.ride,play});
    const label=play.pose|| (play.jumpTime!==null?'jump':free.moving?'walking':'idle');if(label!==playLabel){playLabel=label;post({avatarState:label});}
  }
  async function changeExploreView(view){
    if(!['first','third'].includes(view)||!['bird','explore'].includes(mode))return;
    if(mode==='bird'){const c=C.Cartographic.fromCartesian(groundTarget());await startExplore({floor:birdFloor,point:[C.Math.toDegrees(c.longitude),C.Math.toDegrees(c.latitude),birdHeight],perspective:view});return;}
    exploreView=view;endPlay();pitch=view==='third'?-.25:-.05;avatarRange=rayLimit=4;rayClock=0;
    if(view==='third')avatar.load();setCamera();post({mode,exploreView});
  }
  const chooseFloor=f=>{if(f&&free?.floor!==f){hooks.setFloor(f);if(free)free.floor=f;post({activeFloor:f});}};
  function moveView(duration=.5){
    zoneLayer.setMode(viewPitch<-80?'top':'front',viewHeading);
    viewer.camera.cancelFlight();viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);
    viewer.camera.flyToBoundingSphere(new C.BoundingSphere(cart(viewTarget),1),{duration,offset:new C.HeadingPitchRange(C.Math.toRadians(viewHeading),C.Math.toRadians(viewPitch),viewRange)});
  }
  const ahead=(p,deg,m)=>{const a=C.Math.toRadians(deg),k=Math.cos(C.Math.toRadians(p[1]))*111320;return [p[0]+Math.sin(a)*m/k,p[1]+Math.cos(a)*m/111320,p[2]];};
  // Free distance from a spot back towards the camera: the first building surface on that ray (people, markers and
  // overlays are not obstacles). Unknown (tiles not ready, picking unsupported): the wanted distance.
  function clearRange(point,headingDeg,pitchDeg,max){
    try{
      const h=C.Math.toRadians(headingDeg),p=C.Math.toRadians(pitchDeg),target=cart(point,.3);
      const back=new C.Cartesian3(-Math.sin(h)*Math.cos(p),-Math.cos(h)*Math.cos(p),-Math.sin(p));
      const dir=C.Cartesian3.normalize(C.Matrix4.multiplyByPointAsVector(C.Transforms.eastNorthUpToFixedFrame(target),back,new C.Cartesian3()),new C.Cartesian3());
      const hits=viewer.scene.drillPickFromRay(new C.Ray(target,dir),8)||[];
      for(const hit of hits){const o=hit?.object;if(!hit.position||!(o instanceof C.Cesium3DTileFeature||o?.primitive instanceof C.Cesium3DTileset))continue;
        const d=C.Cartesian3.distance(target,hit.position);if(d<.4)continue;return Math.max(4,Math.min(max,d-1.5));}
    }catch{}
    return max;
  }
  function cameraControl(d){
    // Look at one spot (store focus): the rotate / 정면 buttons then turn around it. The camera backs off only as far as
    // the building allows (walls, neighbouring shop boxes, low ceilings); when blocked early it looks down more steeply.
    // With a facade (point on its base, normal = its front direction) the spot in front and the angle are searched in
    // order — 6 m ahead straight on, then closer and turned — and the first view with enough room is taken.
    if(d.command==='look'){
      if(!valid(d.point))return;if(mode!=='overview'&&mode!=='bird')restore();
      const want=Number.isFinite(d.range)?Math.max(8,Math.min(400,d.range)):viewRange,first=Number.isFinite(d.pitch)?Math.max(-89,Math.min(-10,d.pitch)):viewPitch;
      const normal=Number.isFinite(d.normal)?d.normal:null,straight=Number.isFinite(d.heading)?d.heading:viewHeading;
      const tries=normal===null?[[0,0,first],[0,0,-38],[0,0,-55]]:[[6,0,first],[6,0,-38],[4,-25,first],[4,25,first],[4,0,-55],[2.5,-45,-38],[2.5,45,-38],[2.5,0,-65]];
      let best=null;
      for(const [off,turn,pitch] of tries){
        const target=normal===null?d.point.slice():ahead(d.point,normal,off),heading=((normal===null?straight:normal+180+turn)%360+360)%360,r=clearRange(target,heading,pitch,want);
        if(!best||r>best.r+1)best={target,heading,pitch,r};if(r>=Math.min(want,13))break;
      }
      viewTarget=best.target;viewHeading=best.heading;viewPitch=best.pitch;viewRange=best.r;
      post({lookView:{heading:Math.round(viewHeading),pitch:viewPitch,range:Math.round(viewRange*10)/10}});moveView(.9);return;
    }
    if(d.command==='view'){if(mode!=='overview'&&mode!=='bird')restore();if(Number.isFinite(d.heading))viewHeading=d.heading;if(Number.isFinite(d.pitch)){const was=viewPitch;viewPitch=Math.max(-89,Math.min(-10,d.pitch));if((was<-80)!==(viewPitch<-80))viewRange*=viewPitch<-80?2.6/2.9:2.9/2.6;}moveView(.8);return;}
    const turn=Math.max(5,Math.min(180,Number(d.step)||15));
    if(d.command==='home'){if(mode==='bird')birdHome();else if(mode==='explore')startBird().catch(e=>post({error:e.message}));else restore();return;}
    if(mode==='bird'&&d.command==='top'){orbit(0,-89,.5);return;}
    if(mode==='bird'&&d.command==='oblique'){orbit(0,-35,.5);return;}
    if(mode==='bird'&&(d.command==='rotate-left'||d.command==='rotate-right')){orbit(C.Math.toRadians(d.command==='rotate-left'?-turn:turn),null,.4);return;}
    if(mode!=='overview'&&mode!=='bird')restore();
    if(d.command==='restore'){
      const v=d.view;if(!v||!Array.isArray(v.position)||!valid([v.position[0],v.position[1],36])||!Number.isFinite(v.position[2])||v.position[2]<-80||v.position[2]>2000||![v.heading,v.pitch,v.roll].every(Number.isFinite))return;
      viewer.camera.flyTo({destination:cart(v.position),orientation:{heading:v.heading,pitch:v.pitch,roll:v.roll},duration:.5});return;
    }
    if(d.command==='top'){viewPitch=-89;moveView();return;}
    if(d.command==='oblique'){viewPitch=-35;moveView();return;}
    if(d.command==='rotate-left'||d.command==='rotate-right'){
      viewHeading=((viewHeading+(d.command==='rotate-left'?-turn:turn))%360+360)%360;moveView();return;
    }
    const step=Math.max(3,Math.min(25,viewer.camera.positionCartographic.height*.06));
    if(d.command==='zoom-in')viewer.camera.zoomIn(step*2);
    if(d.command==='zoom-out')viewer.camera.zoomOut(step*2);
    if(d.command==='left')viewer.camera.moveLeft(step);
    if(d.command==='right')viewer.camera.moveRight(step);
    if(d.command==='up')viewer.camera.moveUp(step);
    if(d.command==='down')viewer.camera.moveDown(step);
    viewer.scene.requestRender();
  }
  function spatial(data){
    if(!data.zone||!Array.isArray(data.rows))return;analysis.entities.removeAll();
    const rows=data.rows.filter(r=>valid(r.point)),points=rows.map(r=>r.point),zone=data.zone;
    visibleFloors=[zone.floor];hooks.showFloors(visibleFloors);
    const h=points.length?Math.min(...points.map(p=>p[2]))-1.5:36;
    if(zone.radius&&valid(zone.center))analysis.entities.add({position:cart(zone.center),ellipse:{semiMajorAxis:zone.radius,semiMinorAxis:zone.radius,height:h,material:C.Color.fromCssColorString('#0b98b0').withAlpha(.1),outline:true,outlineColor:C.Color.fromCssColorString('#0b98b0')}});
    else if(Array.isArray(zone.bounds)&&zone.bounds.length===4&&zone.bounds.every(Number.isFinite)){
      const [w,s,e,n]=zone.bounds;analysis.entities.add({rectangle:{coordinates:C.Rectangle.fromDegrees(w,s,e,n),height:h,material:C.Color.fromCssColorString('#0b98b0').withAlpha(.07),outline:true,outlineColor:C.Color.fromCssColorString('#0b98b0')}});
    }
    zoneLayer.show({...data,rows});
    if(data.fit){
      endPlay();mode='overview';playing=false;free=null;clearKeys();viewer.scene.screenSpaceCameraController.enableInputs=true;
      let radius=16;
      if(points.length){viewTarget=[0,1,2].map(k=>points.reduce((s,p)=>s+p[k],0)/points.length);radius=Math.max(16,...points.map(p=>coordinateDistance(p,viewTarget)));}
      else if(zone.center){viewTarget=zone.center;radius=zone.radius;}
      else{const [w,s,e,n]=zone.bounds;viewTarget=[(w+e)/2,(s+n)/2,h];radius=60;}
      // Front view (30°) needs more distance than the top view to keep every store in frame.
      viewHeading=Number.isFinite(data.view?.heading)?data.view.heading:zone.heading||325;viewPitch=Number.isFinite(data.view?.pitch)?data.view.pitch:zone.pitch??-30;
      viewRange=Math.max(60,radius*(viewPitch<-80?2.6:2.9));moveView(.9);
    }
    viewer.scene.requestRender();
  }
  function light(){environmentLayer.set(hour,environment);}
  function line(points,color,width=4){const walkMode=mode==='walk'||mode==='explore';return overlay.entities.add({polyline:{positions:points.map(p=>cart(p,walkMode?.08:.3)),width:walkMode?Math.max(2,width-1):width,material:C.Color.fromCssColorString(color).withAlpha(walkMode?.65:1),arcType:C.ArcType.NONE,...(mode==='overview'?{depthFailMaterial:C.Color.fromCssColorString(color).withAlpha(.75)}:{})}})}
  function marker(point,label,color='#087f78'){const depth=mode==='overview'?Infinity:0;overlay.entities.add({position:cart(point,mode==='overview'?.45:.15),point:{pixelSize:mode==='overview'?11:8,color:C.Color.fromCssColorString(color),outlineColor:C.Color.WHITE,outlineWidth:2,disableDepthTestDistance:depth},label:{text:label,font:'bold 13px sans-serif',fillColor:C.Color.WHITE,showBackground:true,backgroundColor:C.Color.fromCssColorString('#102a38').withAlpha(.92),pixelOffset:new C.Cartesian2(0,-24),disableDepthTestDistance:depth}})}
  function drawRoute(fit=true){
    overlay.entities.removeAll();drawnFlows=[];
    if(!route)return;
    line(route.coordinates,'#05c9a6',6);marker(route.coordinates[0],'출발','#09a75f');marker(route.coordinates.at(-1),'도착','#c38816');
    let count=0;for(let i=1;i<route.floors.length;i++)if(route.floors[i]!==route.floors[i-1]){count++;marker(route.coordinates[i],'C'+count+' · '+route.floors[i-1]+' → '+route.floors[i],'#367fde');}
    visibleFloors=[...new Set(route.floors)];hooks.showFloors(visibleFloors);
    if(fit){viewer.scene.screenSpaceCameraController.enableInputs=true;viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);viewer.zoomTo(overlay,new C.HeadingPitchRange(C.Math.toRadians(325),C.Math.toRadians(-48),Math.max(45,Math.min(650,path.length*.7))));}
  }
  function showFlow(data){
    flowRoutes=data.routes||flowRoutes;flowValues=data.values||flowValues;flowMax=data.max||flowMax;flowStyle=data.style||flowStyle;
    crowd.setData({routes:flowRoutes,values:flowValues,edges:data.edges||[],edgeValues:data.edgeValues||[],...(data.endpointGeo?{endpointGeo:data.endpointGeo}:{}),...(Number.isInteger(data.hour)?{hour:data.hour}:{})});
    if(mode!=='overview'||data.render===false){if(data.clearLines&&!route&&mode==='overview'){overlay.entities.removeAll();drawnFlows=[];viewer.scene.requestRender();}crowd.refresh();return}
    overlay.entities.removeAll();drawnFlows=[];const edges=data.edges||[],values=data.lineValues||data.edgeValues||[];const max=Math.max(1,data.edgeMax||0,...values.filter((_,i)=>i%2));
    const floors=new Set();
    for(let n=0;n<values.length;n+=2){const e=edges[values[n]],value=values[n+1];if(!e||!e.coordinates.every(valid))continue;floors.add(e.from_floor);floors.add(e.to_floor);const style=trafficStyle(value,max);
      if(flowStyle==='dots'){const p=samplePath(makePath(e.coordinates),coordinateDistance(...e.coordinates)/2).point;overlay.entities.add({position:cart(p,.25),point:{pixelSize:3+8*Math.sqrt(style.ratio),color:C.Color.fromCssColorString(style.color).withAlpha(.75),disableDepthTestDistance:Infinity}});}
      else{const ent=line(e.coordinates,style.color,flowStyle==='mist'?style.width*4:style.width);if(flowStyle==='arrows')ent.polyline.material=new C.PolylineArrowMaterialProperty(C.Color.fromCssColorString(style.color));if(flowStyle==='mist')ent.polyline.material=new C.PolylineGlowMaterialProperty({glowPower:.35,color:C.Color.fromCssColorString(style.color).withAlpha(.6)});ent.polyline.depthFailMaterial=ent.polyline.material;drawnFlows.push(ent);}
    }
    if(floors.size&&!data.keepFloors){visibleFloors=[...floors];hooks.showFloors(visibleFloors);}
    if(data.fit&&values.length)viewer.zoomTo(overlay,new C.HeadingPitchRange(C.Math.toRadians(325),C.Math.toRadians(-48),0));
    viewer.scene.requestRender();crowd.refresh();post({flowSegments:values.length/2});
  }
  function restore(){endPlay();mode='overview';playing=false;free=null;clearKeys();lookDrag=null;viewer.scene.canvas.style.cursor='';markerClock=1e9;viewer.scene.screenSpaceCameraController.enableInputs=true;viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);if(route)drawRoute();else{visibleFloors=null;hooks.overview();}post({mode,playing});crowd.refresh();}
  async function startWalk(){
    if(!path||path.points.length<2){post({error:'먼저 보행 경로를 선택하세요.'});return}
    await loadGraph();endPlay();mode='walk';drawRoute(false);playing=true;free={floor:null};viewer.scene.screenSpaceCameraController.enableInputs=false;viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);viewer.camera.frustum.near=.08;if(viewer.camera.frustum.fov)viewer.camera.frustum.fov=C.Math.toRadians(72);setCamera();post({mode,playing,notice:'1인칭 따라걷기 · 아래 막대로 일시정지·속도 조절 · Esc 또는 [조망으로] 복귀'});crowd.refresh();
  }
  function setCamera(){
    if(mode==='walk'&&path){
      const here=samplePath(path,distance),ahead=samplePath(path,Math.min(path.length,distance+1.3));
      chooseFloor(here.floor);const eye=1.65+(bob&&playing?Math.sin(distance*9)*.025:0),a=cart(here.point,eye),b=cart(ahead.point,eye),enu=C.Transforms.eastNorthUpToFixedFrame(a),inv=C.Matrix4.inverseTransformation(enu,new C.Matrix4()),local=C.Matrix4.multiplyByPoint(inv,b,new C.Cartesian3());
      const h=distance<path.length-.1?Math.atan2(local.x,local.y):viewer.camera.heading;
      viewer.camera.setView({destination:a,orientation:{heading:h,pitch:-.06+(bob&&playing?Math.sin(distance*4.5)*.004:0),roll:0}});
    }else if(mode==='explore'&&free){
      if(exploreView==='third'){thirdCamera();return;}
      avatar.hide();
      const a=cart(free.position,1.65+(bob&&free.moving?Math.sin(free.walked*8)*.022:0));viewer.camera.setView({destination:a,orientation:{heading,pitch,roll:0}});
    }
  }
  async function loadGraph(){if(!graph){graphPromise??=fetch('/data/experience/walk-graph.json').then(r=>{if(!r.ok)throw Error('보행 공간 연결 실패');return r.json();}).then(g=>graph=g).catch(e=>{graphPromise=null;throw e;});await graphPromise;}return graph;}
  async function loadWalkIndex(){if(!walkIndex)walkIndex=buildWalkIndex(await loadGraph());return walkIndex;}
  const floorCache=new Map();
  function floorInfo(floor){
    if(!floorCache.has(floor)){
      const pts=graph.points.filter(p=>p[1]===floor&&p[0].startsWith('GRID-')),hs=pts.map(p=>p[4]).sort((a,b)=>a-b);
      floorCache.set(floor,pts.length?{level:hs[Math.floor(hs.length/2)],sphere:C.BoundingSphere.fromPoints(pts.map(p=>cart(p.slice(2,5))))}:null);
    }
    return floorCache.get(floor);
  }
  function nearestOnFloor(floor,x,y,maxDistance=40){
    let best=-1,bd=maxDistance*maxDistance;
    for(let i=0;i<graph.points.length;i++){const p=graph.points[i];if(p[1]!==floor||!p[0].startsWith('GRID-'))continue;const d=(p[5]-x)**2+(p[6]-y)**2;if(d<bd){bd=d;best=i;}}
    return best;
  }
  // Where the bird-view camera is looking on the shown floor (the orbit and panning centre).
  function groundTarget(){
    const cam=viewer.camera,up=C.Ellipsoid.WGS84.geodeticSurfaceNormal(cam.positionWC,new C.Cartesian3()),down=-C.Cartesian3.dot(cam.directionWC,up);
    const above=cam.positionCartographic.height-birdHeight,t=down>.08?above/down:Math.min(250,Math.max(30,above*3));
    return C.Cartesian3.add(cam.positionWC,C.Cartesian3.multiplyByScalar(cam.directionWC,Math.max(1,t),new C.Cartesian3()),new C.Cartesian3());
  }
  function orbit(dHeading=0,pitchDeg=null,duration=0){
    const cam=viewer.camera,t=groundTarget(),range=C.Cartesian3.distance(cam.positionWC,t),offset=new C.HeadingPitchRange(cam.heading+dHeading,pitchDeg===null?cam.pitch:C.Math.toRadians(pitchDeg),range);
    if(duration){cam.flyToBoundingSphere(new C.BoundingSphere(t,1),{duration,offset});return;}
    cam.lookAt(t,offset);cam.lookAtTransform(C.Matrix4.IDENTITY);
  }
  function birdHome(){const s=floorInfo(birdFloor)?.sphere;if(s)viewer.camera.flyToBoundingSphere(s,{duration:.7,offset:new C.HeadingPitchRange(viewer.camera.heading,C.Math.toRadians(-50),s.radius*2.1)});}
  // Bird view: one floor seen from above, scrolled by drag, wheel or keys; markers stay clickable.
  async function startBird(target={}){
    const ix=await loadWalkIndex();let floor=target.floor,p=valid(target.point)?target.point:null;
    const fromFirst=mode==='explore'&&free;
    if(!p&&fromFirst){floor??=free.floor;p=free.position;}
    if(!p&&mode==='bird'&&floor&&floor!==birdFloor){
      const c=C.Cartographic.fromCartesian(groundTarget()),[x,y]=toLocal(ix,C.Math.toDegrees(c.longitude),C.Math.toDegrees(c.latitude)),cell=nearestOnFloor(floor,x,y,30);
      if(cell>=0)p=graph.points[cell].slice(2,5);
    }
    floor??=birdFloor;p??=floorExplorePoint(graph,floor);
    if(!p)throw Error('이 층에는 둘러볼 보행 공간이 없습니다.');
    endPlay();mode='bird';playing=false;free=null;clearKeys();lookDrag=null;overlay.entities.removeAll();drawnFlows=[];visibleFloors=null;
    birdFloor=floor;birdHeight=p[2];hooks.setFloor(floor);post({activeFloor:floor});
    viewer.scene.screenSpaceCameraController.enableInputs=true;viewer.scene.canvas.style.cursor='';viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);
    if(target.whole)birdHome();else viewer.camera.flyToBoundingSphere(new C.BoundingSphere(cart(p),1),{duration:.8,offset:new C.HeadingPitchRange(viewer.camera.heading,C.Math.toRadians(fromFirst?-40:-55),fromFirst?40:85)});
    markerClock=1e9;post({mode,playing,birdFloor:floor,notice:'조망 · 드래그·휠 또는 방향키로 이동 · Q/E 회전 · +/- 확대 · 원형점을 누르면 시설 정보'});crowd.refresh();
  }
  function stepBird(dt){
    const has=hasKey,cam=viewer.camera;
    const f=(has('KeyW')||has('ArrowUp')?1:0)-(has('KeyS')||has('ArrowDown')?1:0),r=(has('KeyD')||has('ArrowRight')?1:0)-(has('KeyA')||has('ArrowLeft')?1:0);
    const turn=(has('KeyE')?1:0)-(has('KeyQ')?1:0),zoom=(has('Equal')||has('NumpadAdd')||has('PageUp')?1:0)-(has('Minus')||has('NumpadSubtract')||has('PageDown')?1:0);
    if(!f&&!r&&!turn&&!zoom)return false;
    const above=Math.max(4,cam.positionCartographic.height-birdHeight),v=Math.max(6,above*.55)*dt*(has('ShiftLeft')||has('ShiftRight')?2.5:1);
    if(f||r){
      const h=cam.heading,e=Math.sin(h)*f+Math.cos(h)*r,n=Math.cos(h)*f-Math.sin(h)*r,m=C.Transforms.eastNorthUpToFixedFrame(cam.positionWC);
      const dir=new C.Cartesian3(m[0]*e+m[4]*n,m[1]*e+m[5]*n,m[2]*e+m[6]*n),area=floorInfo(birdFloor)?.sphere;C.Cartesian3.normalize(dir,dir);
      const before=area?C.Cartesian3.distance(groundTarget(),area.center):0;cam.move(dir,v);
      // Keep the view over the station: do not scroll further away once past the floor edge.
      if(area){const after=C.Cartesian3.distance(groundTarget(),area.center);if(after>area.radius+40&&after>before)cam.move(dir,-v);}
    }
    if(turn)orbit(turn*dt*1.3);
    if(zoom){const drop=zoom*v,sin=Math.max(.2,-Math.sin(cam.pitch));if(above-drop*sin>5&&above-drop*sin<600)cam.moveForward(drop);}
    return true;
  }
  // First person: continuous walking on the 2 m walkable grid (walls stop you, you slide along them).
  async function startExplore(target=null){
    const ix=await loadWalkIndex();
    const floor=target?.floor||(path?samplePath(path,distance).floor:'2F');
    const p=target?.point||(path?samplePath(path,distance).point:floorExplorePoint(graph,floor));
    if(!p)throw Error('보행 시작 위치가 없습니다.');
    const [x,y]=toLocal(ix,p[0],p[1]);let c=nearestOnFloor(floor,x,y,25);
    if(c<0){c=nearestOnFloor(floor,x,y,600);if(c>=0)post({notice:'가장 가까운 보행 가능 지점에서 시작합니다.'});}
    if(c<0)throw Error('이 층에는 걸을 수 있는 공간이 없습니다. 다른 위치를 고르세요.');
    const g=graph.points[c];
    endPlay();exploreView=target?.perspective==='third'?'third':target?.perspective==='first'?'first':exploreView;avatarRange=rayLimit=4;rayClock=0;
    mode='explore';overlay.entities.removeAll();drawnFlows=[];playing=false;clearKeys();lookDrag=null;visibleFloors=null;
    free={index:c,x:g[5],y:g[6],h:g[4],position:g.slice(2,5),floor:null,ride:null,links:[],linkKey:null,walked:0,moving:false};
    heading=openHeading(ix,g[1],g[5],g[6],g[4]);pitch=exploreView==='third'?-.25:-.05;chooseFloor(g[1]);if(exploreView==='third')avatar.load();
    viewer.scene.screenSpaceCameraController.enableInputs=false;viewer.scene.canvas.style.cursor='grab';viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);viewer.camera.frustum.near=.08;if(viewer.camera.frustum.fov)viewer.camera.frustum.fov=C.Math.toRadians(72);setCamera();
    markerClock=1e9;post({mode,playing,exploreView,notice:exploreView==='third'?'3인칭 · WASD 이동 · 드래그로 시점 · Space 점프 · 1~4 포즈 · Enter 층간 이동':'1인칭 · ↑↓ 걷기 · ←→ 돌기 · A/D 옆걸음 · 드래그로 둘러보기 · Shift 빠르게 · Esc 조망'});crowd.refresh();nearbyConnections();
  }
  // Stairs, escalators and lifts that start at or next to the current cell.
  function nearbyConnections(){
    if(!free||!graph)return;
    const cells=[free.index,...graph.adj[free.index].filter(e=>!e[2]).map(e=>e[0])],links=[];
    for(const c of cells)for(const e of graph.adj[c])if(e[2]&&!links.some(l=>l.to===e[0]))links.push({from:c,to:e[0],conn:e[2]});
    free.links=links;const key=links.map(l=>l.to).join(',');if(key===free.linkKey)return;free.linkKey=key;
    post({nearby:links.map(l=>({to:l.to,name:(graph.connections.find(c=>c.id===l.conn)?.name||'층간 연결')+' → '+graph.points[l.to][1]}))});
  }
  function stepFree(dt){
    if(!free)return;const has=hasKey;
    const turn=(has('ArrowRight')||has('KeyE')?1:0)-(has('ArrowLeft')||has('KeyQ')?1:0);if(turn)heading+=turn*dt*1.5;
    if(has('PageUp'))pitch=Math.min(.7,pitch+dt*.8);if(has('PageDown'))pitch=Math.max(-.8,pitch-dt*.8);
    if(free.ride){
      tickPlay(play,dt,{riding:true});free.moving=false;
      const r=free.ride;r.distance=Math.min(r.path.length,r.distance+dt*Math.max(1.2,speed*.6));free.position=samplePath(r.path,r.distance).point;
      if(r.distance>=r.path.length){const g=graph.points[r.to];Object.assign(free,{index:r.to,x:g[5],y:g[6],h:g[4],position:g.slice(2,5),ride:null,linkKey:null});visibleFloors=null;chooseFloor(g[1]);nearbyConnections();}
      setCamera();return;
    }
    const fwd=(has('ArrowUp')||has('KeyW')?1:0)-(has('ArrowDown')||has('KeyS')?1:0),side=(has('KeyD')?1:0)-(has('KeyA')?1:0);free.moving=false;
    if((fwd||side)&&walkIndex){
      const step=1.45*(has('ShiftLeft')||has('ShiftRight')?2.2:1)*dt/Math.hypot(fwd,side);
      const m=slideMove(walkIndex,free.floor,free.x,free.y,free.h,(Math.sin(heading)*fwd+Math.cos(heading)*side)*step,(Math.cos(heading)*fwd-Math.sin(heading)*side)*step);
      if(m){
        free.walked+=Math.hypot(m.x-free.x,m.y-free.y);free.moving=true;free.x=m.x;free.y=m.y;free.h+=(m.h-free.h)*Math.min(1,dt*10);
        const [lon,lat]=toLonLat(walkIndex,m.x,m.y);free.position=[lon,lat,free.h];
        if(m.cell!==free.index){free.index=m.cell;nearbyConnections();}
      }
    }
    tickPlay(play,dt,{moving:Boolean(fwd||side||turn)});setCamera();
  }
  function ride(to){
    if(!free||free.ride)return;const link=free.links?.find(l=>l.to===to),from=link?.from??free.index,e=graph.adj[from].find(e=>e[0]===to&&e[2]);if(!e)return;
    const c=graph.connections.find(c=>c.id===e[2]),a=graph.points[from],b=graph.points[to];let coords=c.coordinates;
    if(c.kind==='elevator')coords=[a.slice(2,5),b.slice(2,5)];else if(coordinateDistance(coords.at(-1),a.slice(2,5))<coordinateDistance(coords[0],a.slice(2,5)))coords=[...coords].reverse();
    resetPlay(play);visibleFloors=[...new Set([a[1],b[1]])];hooks.showFloors(visibleFloors);free.ride={to,path:makePath([free.position,...coords]),distance:0};post({notice:'층간 이동 미리보기 · 실제 운행 방향/개찰 통제는 현장 확인'});
  }
  const rideNearest=()=>{if(free?.links?.length)ride(free.links[0].to);};
  // Exactly the current 3D view, read right after Cesium draws the frame (the WebGL buffer is not preserved).
  function capturePhoto(){
    const remove=viewer.scene.postRender.addEventListener(()=>{remove();viewer.scene.canvas.toBlob(blob=>post(blob?{photo:blob,photoMode:mode,photoView:exploreView,photoFloor:free?.floor||(mode==='bird'?birdFloor:renderedFloors()?.[0])||''}:{error:'사진을 만들지 못했습니다. 다시 시도하세요.'}),'image/png');});
    viewer.scene.requestRender();
  }
  function animate(now){
    if(disposed)return;const raw=document.hidden?0:now-last,dt=Math.min(.08,raw/1000);last=now;time+=dt;
    if(mode==='walk'&&playing&&path){distance=Math.min(path.length,distance+dt*speed);setCamera();if(distance===path.length){playing=false;post({notice:'경로 도착 · [다시 걷기] 또는 [조망으로]',playing,arrived:true});}if(Math.floor(now/250)!==Math.floor((now-dt*1000)/250))post({progress:path.length?distance/path.length:0,metres:distance,floor:samplePath(path,distance).floor});}
    let moved=false;
    if(mode==='explore'&&!document.hidden)stepFree(dt);else if(mode==='bird'&&!document.hidden)moved=stepBird(dt);
    crowd.tick(dt,time,raw);
    markerClock+=raw;if(markerClock>200){markerClock=0;markers.update(mode,renderedFloors());moved=true;}
    if(playing||crowd.active||mode==='explore'||moved)viewer.scene.requestRender();requestAnimationFrame(animate);
  }
  const keydown=e=>{
    if(mode==='walk'&&e.code==='Escape'){restore();return;}
    if(mode!=='explore'&&mode!=='bird')return;
    if(e.code==='Escape'){if(mode==='explore')startBird().catch(err=>post({error:err.message}));return;}
    if(mode==='explore'&&e.code==='Enter'){e.preventDefault();if(!e.repeat)rideNearest();return;}
    if(mode==='explore'&&exploreView==='third'&&['Space','Digit1','Digit2','Digit3','Digit4'].includes(e.code)){e.preventDefault();if(!e.repeat)actionPlay(({Space:'jump',Digit1:'wave',Digit2:'bow',Digit3:'cheer',Digit4:'photo'})[e.code]);return;}
    if(MOVE_KEYS.has(e.code)){e.preventDefault();keys.add(e.code);}
  };
  const keyup=e=>keys.delete(e.code);
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',()=>keys.clear());
  const receive=async e=>{if(e.origin!==location.origin||e.source!==window.parent||e.data?.type!=='station-one:experience')return;const d=e.data;try{
    if(d.action==='route'){if(!d.route||!Array.isArray(d.route.coordinates)||d.route.coordinates.length<2||d.route.coordinates.length>20000||!d.route.coordinates.every(valid))throw Error('경로 좌표를 확인하세요.');route=d.route;path=makePath(route.coordinates,route.floors);distance=0;if(d.fit===false&&mode==='overview')drawRoute(false);else restore();post({route:route.route_id});}
    else if(d.action==='walk')await startWalk();
    else if(d.action==='explore')await startExplore(departure);
    else if(d.action==='set-start'&&valid(d.point))departure={floor:d.floor,point:d.point};
    else if(d.action==='overview')restore();
    else if(d.action==='clear-route'){route=null;path=null;overlay.entities.removeAll();drawnFlows=[];restore();}
    else if(d.action==='camera')cameraControl(d);
    else if(d.action==='analysis')spatial(d);
    else if(d.action==='analysis-clear'){analysis.entities.removeAll();zoneLayer.clear();}
    else if(d.action==='analysis-time')zoneLayer.setTime(Number(d.t));
    else if(d.action==='capture-view'){
      const p=viewer.camera.positionCartographic;post({viewKey:d.key,view:{position:[C.Math.toDegrees(p.longitude),C.Math.toDegrees(p.latitude),p.height],heading:viewer.camera.heading,pitch:viewer.camera.pitch,roll:viewer.camera.roll}});
    }
    else if(d.action==='play'){if(!playing&&path&&distance>=path.length)distance=0;playing=!playing;post({playing});}
    else if(d.action==='seek'&&path){distance=Math.max(0,Math.min(1,Number(d.value)||0))*path.length;setCamera();}
    else if(d.action==='speed')speed=[.8,1.2,2.4,3.6].includes(Number(d.value))?Number(d.value):2.4;
    else if(d.action==='bob')bob=Boolean(d.enabled);
    else if(d.action==='teleport'){await loadGraph();const p=valid(d.point)?d.point:floorExplorePoint(graph,d.floor);if(p)await startExplore({floor:d.floor,point:p,perspective:d.perspective});else post({error:'이 층에 보행 가능한 지점이 없습니다.'});}
    else if(d.action==='lighting'){hour=Math.max(0,Math.min(23,Number(d.hour)||0));environment=['auto','indoor','outdoor'].includes(d.environment)?d.environment:'auto';light();}
    else if(d.action==='flow')showFlow(d);
    else if(d.action==='people')crowd.setEnabled(d.enabled);
    else if(d.action==='key'){if(MOVE_KEYS.has(d.key)){if(d.down)keys.add(d.key);else keys.delete(d.key);}}
    else if(d.action==='touch-keys'&&Array.isArray(d.keys)&&d.keys.length<=MOVE_KEYS.size){touchKeys.clear();if(mode==='explore')for(const key of d.keys)if(MOVE_KEYS.has(key))touchKeys.add(key);}
    else if(d.action==='bird')await startBird({floor:d.floor,point:d.point,whole:Boolean(d.whole)});
    else if(d.action==='explore-view')await changeExploreView(d.view);
    else if(d.action==='play-action')actionPlay(d.value);
    else if(d.action==='first'){if(mode==='bird'){const c=C.Cartographic.fromCartesian(groundTarget());await startExplore({floor:birdFloor,point:[C.Math.toDegrees(c.longitude),C.Math.toDegrees(c.latitude),birdHeight]});}else if(mode!=='explore')await startExplore(departure);}
    else if(d.action==='facilities'){const items=Array.isArray(d.items)?d.items.slice(0,2000):[];markers.set(items,await loadWalkIndex());markerClock=1e9;}
    else if(d.action==='markers'){markers.setEnabled(d.enabled);markerClock=1e9;}
    else if(d.action==='manager-overlay'){const floors=Array.isArray(d.floors)?d.floors.filter(f=>['B7','B6','B3','B2','B1','1F','2F','3F','4F','RF'].includes(f)):[];if(floors.length){visibleFloors=[...new Set(floors)];hooks.showFloors(visibleFloors);}managerOverlay.show(d);}
    else if(d.action==='manager-overlay-clear')managerOverlay.clear();
    else if(d.action==='floors'){
      // Manager overview floor choice: one floor (normal colours) or several (translucent stack).
      const floors=(Array.isArray(d.floors)?d.floors:[]).filter(f=>['B7','B6','B3','B2','B1','1F','2F','3F','4F','RF'].includes(f));
      if(floors.length===1){visibleFloors=null;hooks.setFloor(floors[0]);if(d.fit)hooks.overview();}
      else if(floors.length>1){visibleFloors=[...new Set(floors)];hooks.showFloors(visibleFloors);if(d.fit){viewTarget=[126.97065,37.55395,30];viewRange=260;viewHeading=325;viewPitch=-40;moveView(.8);}}
      crowd.refresh();viewer.scene.requestRender();
    }
    else if(d.action==='manager-overlay-focus')managerOverlay.focus(String(d.id||''));
    else if(d.action==='photo')capturePhoto();
    else if(d.action==='ride-nearest')rideNearest();
    else if(d.action==='ride')ride(Number(d.to));
    else if(d.action==='focus'&&valid(d.point)){restore();hooks.setFloor(d.floor);viewer.camera.flyTo({destination:cart(d.point,30),orientation:{heading:C.Math.toRadians(325),pitch:C.Math.toRadians(-60),roll:0},duration:.8});}
  }catch(error){post({error:error.message});}};
  const canvas=viewer.scene.canvas,picker=new C.ScreenSpaceEventHandler(canvas);let hoverAt=0;
  picker.setInputAction(e=>{if(mode!=='bird'&&mode!=='explore')return;const id=markers.pick(e.position)||markers.nearest(e.position,16);if(id)post({facility:id});},C.ScreenSpaceEventType.LEFT_CLICK);
  picker.setInputAction(e=>{if((mode!=='bird'&&mode!=='explore')||lookDrag)return;const now=performance.now();if(now-hoverAt<90)return;hoverAt=now;const id=markers.nearest(e.endPosition,14);markers.hover(id);markerClock=1e9;canvas.style.cursor=id?'pointer':mode==='explore'?'grab':'';},C.ScreenSpaceEventType.MOUSE_MOVE);
  // First-person look: drag the view like a photo sphere (drag right turns left).
  const lookDown=e=>{if(mode!=='explore'||(e.pointerType==='mouse'&&e.button!==0))return;lookDrag={x:e.clientX,y:e.clientY,h:heading,p:pitch,moved:false};};
  const lookMove=e=>{if(!lookDrag)return;const dx=e.clientX-lookDrag.x,dy=e.clientY-lookDrag.y;if(!lookDrag.moved&&Math.hypot(dx,dy)<4)return;lookDrag.moved=true;canvas.style.cursor='grabbing';heading=lookDrag.h-dx*.005;pitch=Math.max(-.8,Math.min(.7,lookDrag.p+dy*.004));if(mode==='explore'){setCamera();viewer.scene.requestRender();}};
  const lookUp=()=>{if(!lookDrag)return;lookDrag=null;canvas.style.cursor=mode==='explore'?'grab':'';};
  canvas.addEventListener('pointerdown',lookDown);window.addEventListener('pointermove',lookMove);window.addEventListener('pointerup',lookUp);window.addEventListener('pointercancel',lookUp);
  window.addEventListener('message',receive);light();requestAnimationFrame(animate);post({ready:true,mode});
  return {destroy(){disposed=true;avatar.destroy();environmentLayer.destroy();crowd.destroy();markers.destroy();managerOverlay.destroy();zoneLayer.destroy();picker.destroy();canvas.removeEventListener('pointerdown',lookDown);window.removeEventListener('pointermove',lookMove);window.removeEventListener('pointerup',lookUp);window.removeEventListener('pointercancel',lookUp);clearKeys();window.removeEventListener('message',receive);window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);viewer.dataSources.remove(overlay,true);viewer.dataSources.remove(analysis,true);}};
}

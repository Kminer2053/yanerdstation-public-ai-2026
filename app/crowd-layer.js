import {buildLane,lanePoint,cellAt,lineHeight,snapWalkable,walkNeighbors,toLocal,toLonLat,crowdComposition,agentCounts,upperShare,upperAgents,pickWeighted,selectNearest,randomInPolygon,rand} from '../src/crowd-core.js';
import {CrowdDeadlineQueue,poseInterval,dotInterval,offscreenDelay,catchUpAgent} from '../src/crowd-scheduling.js';

// Clothing colours of person-0..3.glb (linear material factors converted to sRGB), so a dot turns into the same-looking person.
const CLOTHING=['#34807f','#c96c5a','#3f5580','#c29a42'];
// Skinned people are CPU-bound in Cesium (joint matrices per model), so only nearby walkers animate.
const MODEL_RANGE=420,ANIMATE_RANGE=90,STEP=1.5;

export function createCrowdLayer(C,viewer,{loadIndex,loadCirculation=null,renderedFloors,post,mobile=false}){
  const modelLayer=viewer.scene.primitives.add(new C.PrimitiveCollection());
  const dotLayer=viewer.scene.primitives.add(new C.PointPrimitiveCollection());
  const colors=CLOTHING.map(c=>C.Color.fromCssColorString(c)),dotScale=new C.NearFarScalar(30,1.7,500,.85);
  const scratch=new C.Cartesian3(),sphere=new C.BoundingSphere(new C.Cartesian3(),1.2),hpr=new C.HeadingPitchRoll();
  const slots=[],free=[[],[],[],[]],agents=[],visibleDots=[],deadlines=new CrowdDeadlineQueue();
  const lodPosition=new C.Cartesian3(),lodDirection=new C.Cartesian3();
  let ix=null,lanes=[],routesRef=null,epInfo=new Map(),input=null,signature='',comp=null,counts=null,enabled=false,disposed=false;
  let circ=null,loops=null,stayW=null,upper=0;
  let time=0,stepTime=null,pausedAt=null,lodClock=1,needLod=true,version=0,loading=false,loadFailed=false,lastStatus='';
  const minPool=mobile?24:40,maxPool=mobile?160:600;
  let poolLimit=mobile?80:240,agentCap=mobile?3000:10000,frameMs=16,adaptClock=0;

  const progress=a=>a.dur>0?Math.min(1,Math.max(0,(time-a.t0)/a.dur)):1;
  const floorNow=a=>progress(a)<.5?a.f0:a.f1;
  const position=(a,out)=>C.Cartesian3.lerp(a.e0,a.e1,progress(a),out);
  function newAgent(id){return {id,variant:id%4,rs:(Math.imul(id+1,2654435761)^0x5bd1e995)|0,active:false,kind:0,e0:new C.Cartesian3(),e1:new C.Cartesian3(),x0:0,y0:0,h0:0,f0:null,x1:0,y1:0,h1:0,f1:null,t0:0,dur:0,walked:0,segLen:0,yaw:0,yawT:0,model:null,dot:null,vis:false,want:false,d2:0};}

  function place(a,x,y,h,floor){
    a.x0=a.x1=x;a.y0=a.y1=y;a.h0=a.h1=h;a.f0=a.f1=floor;a.segLen=0;
    const [lon,lat]=toLonLat(ix,x,y);C.Cartesian3.fromDegrees(lon,lat,h,C.Ellipsoid.WGS84,a.e1);C.Cartesian3.clone(a.e1,a.e0);a.t0=stepTime??time;a.dur=0;
  }
  function moveTo(a,x,y,h,floor,speed){
    const dx=x-a.x1,dy=y-a.y1,dist=Math.hypot(dx,dy,h-a.h1);
    a.walked+=a.segLen;a.x0=a.x1;a.y0=a.y1;a.h0=a.h1;a.f0=a.f1;a.x1=x;a.y1=y;a.h1=h;a.f1=floor;
    if(Math.hypot(dx,dy)>.05)a.yawT=Math.atan2(dx,dy);
    const e=a.e0;a.e0=a.e1;a.e1=e;const [lon,lat]=toLonLat(ix,x,y);C.Cartesian3.fromDegrees(lon,lat,h,C.Ellipsoid.WGS84,a.e1);
    a.segLen=dist;a.t0=stepTime??time;a.dur=Math.max(.05,dist/speed);
  }
  function stand(a,seconds){a.walked+=a.segLen;a.segLen=0;a.x0=a.x1;a.y0=a.y1;a.h0=a.h1;a.f0=a.f1;C.Cartesian3.clone(a.e1,a.e0);a.t0=stepTime??time;a.dur=seconds;}

  function advance(a){
    try{catchUpAgent(a,time,(agent,due)=>{stepTime=due;(agent.kind===0?walkerNext:agent.kind===3?circulatorNext:wanderNext)(agent);});}
    finally{stepTime=null;}
    if(a.active)deadlines.schedule(a,a.t0+a.dur+offscreenDelay(a));
  }

  function prepareRoutes(routes){
    if(routesRef===routes)return;routesRef=routes;epInfo=new Map();
    lanes=routes.map(r=>r.coordinates?.length>=4&&r.floors?.length===r.coordinates.length?buildLane(ix,r):null);
    const info=id=>{if(!epInfo.has(id))epInfo.set(id,{from:[],to:[],byDest:new Map(),h:null,floor:null,x:0,y:0});return epInfo.get(id);};
    routes.forEach((r,i)=>{
      if(!lanes[i])return;const l=lanes[i],a=info(r.from_endpoint),b=info(r.to_endpoint);
      a.from.push(i);a.byDest.set(r.to_endpoint,i);b.to.push(i);
      if(a.h===null){a.h=l.H[1];a.floor=l.floors[1];a.x=l.X[1];a.y=l.Y[1];}
      if(b.h===null){b.h=l.H[l.n-2];b.floor=l.floors[l.n-2];b.x=l.X[l.n-2];b.y=l.Y[l.n-2];}
    });
  }
  // A walkable spot inside the endpoint area (platform, gate, entrance), or the route's first grid point there.
  function endpointSpot(id,a){
    const ep=input.endpointGeo?.[id],e=epInfo.get(id);if(!e)return null;
    for(let k=0;k<4;k++){
      const p=randomInPolygon(ep?.geo,rand(a),rand(a),rand(a));if(!p)break;
      const [x,y]=toLocal(ix,p[0],p[1]),c=cellAt(ix,e.floor,x,y,e.h,1.5);
      if(c>=0)return {x,y,h:ix.graph.points[c][4],floor:e.floor};
    }
    const c=snapWalkable(ix,e.floor,e.x,e.y,e.h,6);
    return c>=0?{x:ix.graph.points[c][5],y:ix.graph.points[c][6],h:ix.graph.points[c][4],floor:e.floor}:null;
  }

  function spawnWalker(a,mid){
    const items=[];comp.routeW.forEach((w,i)=>{if(lanes[i]&&w>0)items.push([i,w]);});
    const ri=pickWeighted(items,rand(a));if(ri===null){spawnWanderer(a,2);return;}
    const lane=lanes[ri],r=routesRef[ri];
    a.kind=0;a.lane=lane;a.cursor={i:0};a.speed=.95+rand(a)*.5;a.u0=Math.max(-.9,Math.min(.9,(rand(a)+rand(a)-1)*.9+.12));a.u=a.u0;
    a.end=endpointSpot(r.to_endpoint,a);
    if(mid){
      a.s=lane.S[1]+rand(a)*(lane.S[lane.n-2]-lane.S[1]);const p=lanePoint(ix,lane,a.s,a.u,a.cursor);
      place(a,p.x,p.y,p.h,p.floor);a.phase=1;a.dur=rand(a)*1.5;return;
    }
    const start=endpointSpot(r.from_endpoint,a),first=lanePoint(ix,lane,lane.S[1],0,a.cursor);
    if(start&&start.floor===first.floor&&lineHeight(ix,start.floor,start.x,start.y,start.h,first.x,first.y)!==null){place(a,start.x,start.y,start.h,start.floor);a.phase=0;}
    else{place(a,first.x,first.y,first.h,first.floor);a.phase=1;a.s=lane.S[1];}
  }
  // One step along the lane with a gentle sideways drift, never past `limit` or the next lane vertex.
  function laneStep(a,limit){
    const L=a.lane;let vertex=limit;for(let i=a.cursor.i+1;i<L.n-1;i++)if(L.S[i]>a.s+1e-6){vertex=L.S[i];break;}
    const s1=Math.min(limit,a.s+STEP,vertex);
    a.u=Math.max(-.95,Math.min(.95,a.u+(rand(a)-.5)*.14+(a.u0-a.u)*.08));
    const open=p=>p.floor!==a.f1||cellAt(ix,a.f1,a.x1,a.y1,a.h1,.9)<0||cellAt(ix,p.floor,p.x,p.y,p.h,.9)<0||lineHeight(ix,a.f1,a.x1,a.y1,a.h1,p.x,p.y)!==null;
    let p=lanePoint(ix,L,s1,a.u,a.cursor);
    if(a.u&&!open(p)){a.u*=.4;p=lanePoint(ix,L,s1,a.u,a.cursor);}
    // Sidestep back onto the route line first; the clearance scan guarantees that sideways line is open.
    if(a.u&&!open(p)){a.u=0;p=lanePoint(ix,L,a.s,0,a.cursor);moveTo(a,p.x,p.y,p.h,p.floor,a.speed);return;}
    a.s=s1;moveTo(a,p.x,p.y,p.h,p.floor,a.speed);
  }
  function walkerNext(a){
    const L=a.lane,end=L.S[L.n-2];
    if(a.phase===0){a.phase=1;a.s=L.S[1];const p=lanePoint(ix,L,a.s,0,a.cursor);moveTo(a,p.x,p.y,p.h,p.floor,a.speed);return;}
    if(a.phase===1){
      if(a.s>=end-1e-3){
        a.phase=2;const e=a.end;
        if(e&&e.floor===a.f1&&lineHeight(ix,e.floor,a.x1,a.y1,a.h1,e.x,e.y)!==null)moveTo(a,e.x,e.y,e.h,e.floor,a.speed);else stand(a,.3);
        return;
      }
      laneStep(a,end);return;
    }
    spawnWalker(a,false);
  }

  // 3F hall circulators (the hall's share of the 2F concourse dwellers): ride up, pass the shops and the hall, ride
  // down and go round the closed loop again. Some stop at a shop front or rest in the hall on the way. They start
  // anywhere on a loop, about a third already stopped, so the hall is not empty at the first frame.
  function spawnCirculator(a){
    const items=[];loops.forEach((l,i)=>{if(l)items.push([i,circ.routes[i].weight??1]);});
    const ri=pickWeighted(items,rand(a));if(ri===null){spawnWanderer(a,2);return;}
    const lane=loops[ri],stops=circ.routes[ri].stops||[],first=stops.length&&rand(a)<.35?stops[Math.floor(rand(a)*stops.length)]:null;
    a.kind=3;a.lane=lane;a.loop=ri;a.cursor={i:0};a.phase=1;a.speed=.8+rand(a)*.45;a.u0=Math.max(-.9,Math.min(.9,(rand(a)+rand(a)-1)*.9+.12));a.u=a.u0;
    a.s=first?lane.S[first.i]:lane.S[1]+rand(a)*(lane.S[lane.n-2]-lane.S[1]);
    a.stop=stops.findIndex(st=>lane.S[st.i]>a.s+1e-6);if(a.stop<0)a.stop=stops.length;
    const p=lanePoint(ix,lane,a.s,a.u,a.cursor);place(a,p.x,p.y,p.h,p.floor);
    if(first&&stopAt(a,first,true))return;
    a.yawT=a.yaw=rand(a)*Math.PI*2;a.dur=rand(a)*1.5;
  }
  // Step off the loop to a spot near the stop (shop front or hall), facing the shop, then come back to the same place.
  function stopAt(a,st,now=false){
    const conf=circ.pause?.[st.kind];if(!conf||!Array.isArray(st.spot))return false;
    const [sx,sy]=toLocal(ix,st.spot[0],st.spot[1]);
    for(let k=0;k<4;k++){
      const ang=rand(a)*Math.PI*2,d=rand(a)*(conf.radius||1.5),x=sx+Math.sin(ang)*d,y=sy+Math.cos(ang)*d,h=lineHeight(ix,a.f1,a.x1,a.y1,a.h1,x,y);
      if(h===null)continue;
      a.back=[a.x1,a.y1,a.h1,a.f1];a.pause=conf.min+rand(a)*(conf.max-conf.min);a.face=Number.isFinite(st.face)?st.face*Math.PI/180:null;
      if(now){place(a,x,y,h,a.f1);a.yawT=a.yaw=a.face??rand(a)*Math.PI*2;stand(a,rand(a)*a.pause);a.phase=5;}
      else{moveTo(a,x,y,h,a.f1,a.speed*.85);a.phase=4;}
      return true;
    }
    return false;
  }
  function circulatorNext(a){
    const L=a.lane,stops=circ.routes[a.loop].stops||[],end=L.S[L.n-2];
    if(a.phase===4){stand(a,a.pause);if(a.face!==null)a.yawT=a.face;a.phase=5;return;}
    if(a.phase===5){a.phase=1;const [x,y,h,f]=a.back;moveTo(a,x,y,h,f,a.speed);return;}
    if(a.s>=end-1e-3){a.s=L.S[1];a.cursor={i:0};a.stop=0;const p=lanePoint(ix,L,a.s,a.u,a.cursor);moveTo(a,p.x,p.y,p.h,p.floor,a.speed);return;}
    let st=stops[a.stop];
    if(st&&a.s>=L.S[st.i]-1e-3){a.stop++;if(rand(a)<(circ.pause?.[st.kind]?.p??0)&&stopAt(a,st))return;st=stops[a.stop];}
    laneStep(a,st?Math.min(end,L.S[st.i]):end);
  }

  // Waiting and unassigned-arrival people: milling around a spot, only along straight lines that stay on walkable cells.
  function spawnWanderer(a,kind){
    a.kind=kind;a.lane=null;let spot=null;
    if(kind===1&&comp.dwellW.size){spot=endpointSpot(pickWeighted([...comp.dwellW],rand(a)),a);a.radius=4+rand(a)*6;a.standP=.7;a.speed=.4+rand(a)*.4;}
    else if(comp.ambientW.size){
      const id=pickWeighted([...(stayW||comp.ambientW)],rand(a)),e=epInfo.get(id),split=input.endpointGeo?.[id]?.ambientSplit;let ri=null;
      if(e&&split)ri=pickWeighted(Object.entries(split).map(([d,w])=>[e.byDest.get(d),w]).filter(([i])=>i!==undefined),rand(a));
      if(e&&ri===null&&e.from.length)ri=pickWeighted(e.from.map(i=>[i,(comp.routeW[i]||0)+.01]),rand(a));
      if(ri!==null){
        const lane=lanes[ri],p=lanePoint(ix,lane,lane.S[1]+rand(a)*(lane.S[lane.n-2]-lane.S[1]),(rand(a)*2-1)*.95,{i:0}),c=snapWalkable(ix,p.floor,p.x,p.y,p.h,6);
        if(c>=0)spot={x:ix.graph.points[c][5],y:ix.graph.points[c][6],h:ix.graph.points[c][4],floor:p.floor};
      }
      spot??=endpointSpot(id,a);a.radius=7+rand(a)*9;a.standP=.4;a.speed=.55+rand(a)*.6;
    }
    if(!spot){a.active=false;return;}
    a.ax=spot.x;a.ay=spot.y;place(a,spot.x,spot.y,spot.h,spot.floor);
    const d=rand(a)*a.radius,ang=rand(a)*Math.PI*2,tx=spot.x+Math.sin(ang)*d,ty=spot.y+Math.cos(ang)*d,h=lineHeight(ix,spot.floor,spot.x,spot.y,spot.h,tx,ty);
    if(h!==null)place(a,tx,ty,h,spot.floor);
    a.yawT=a.yaw=ang;a.moving=false;a.dur=rand(a)*8;
  }
  function wanderNext(a){
    if(a.moving&&rand(a)<a.standP){a.moving=false;stand(a,a.kind===1?6+rand(a)*26:2+rand(a)*10);return;}
    for(let k=0;k<5;k++){
      const hx=a.ax-a.x1,hy=a.ay-a.y1,far=Math.hypot(hx,hy)>a.radius*.7;
      const ang=far?Math.atan2(hx,hy)+(rand(a)-.5)*1.4:rand(a)<.6?a.yawT+(rand(a)-.5)*2.2:rand(a)*Math.PI*2;
      const d=1.5+rand(a)*Math.min(7,a.radius*.8),tx=a.x1+Math.sin(ang)*d,ty=a.y1+Math.cos(ang)*d;
      if(!far&&Math.hypot(tx-a.ax,ty-a.ay)>a.radius)continue;
      const h=lineHeight(ix,a.f1,a.x1,a.y1,a.h1,tx,ty);if(h===null)continue;
      a.moving=true;moveTo(a,tx,ty,h,a.f1,a.speed);return;
    }
    const c=cellAt(ix,a.f1,a.x1,a.y1,a.h1,1.5),nb=c>=0?walkNeighbors(ix,c):[];
    if(nb.length){const p=ix.graph.points[nb[Math.floor(rand(a)*nb.length)]];a.moving=true;moveTo(a,p[5],p[6],p[4],a.f1,a.speed);}
    else stand(a,3);
  }

  function signatureOf(d){
    let e=0;for(let k=1;k<(d.edgeValues?.length||0);k+=2)e+=d.edgeValues[k];
    const ep=Object.entries(d.endpointGeo||{}).map(([id,v])=>id+':'+(v.dwell||0)+':'+(v.ambient||0)).join(',');
    return (d.values||[]).join(',')+'|'+e.toFixed(1)+'|'+ep+'|'+agentCap+'|'+(d.hour??'');
  }
  async function rebuild(force=false){
    if(!enabled||!input?.routes?.length)return;
    const sig=signatureOf(input);if(!force&&sig===signature)return;
    const v=++version;
    if(!ix){try{ix=await loadIndex();}catch(e){post({notice:'보행 공간 자료를 불러오지 못해 가상 보행자를 표시하지 않습니다.'});return;}}
    // Without the 3F circulation data every dweller stays downstairs, as before.
    if(!circ&&loadCirculation){try{circ=await loadCirculation();}catch(e){circ={routes:[]};}}
    if(disposed||v!==version)return;
    loops??=(circ?.routes||[]).map(r=>r.coordinates?.length>=4&&r.floors?.length===r.coordinates.length?buildLane(ix,r):null);
    signature=sig;prepareRoutes(input.routes);
    comp=crowdComposition({routes:routesRef,values:input.values,edges:input.edges,edgeValues:input.edgeValues,endpoints:input.endpointGeo||{}});
    ({upper,stay:stayW}=upperShare(comp,loops.some(Boolean)?circ.share:null,input.hour));
    counts=agentCounts(comp,agentCap);counts.upper=upperAgents(counts,comp,upper);
    while(agents.length<counts.total)agents.push(newAgent(agents.length));
    deadlines.clear();visibleDots.length=0;
    agents.forEach((a,i)=>{
      a.active=i<counts.total;a.walked=0;a.segLen=0;
      if(!a.active){if(a.model)unbind(a.model);if(a.dot)a.dot.show=false;return;}
      const k=i-counts.walk-counts.dwell;
      if(i<counts.walk)spawnWalker(a,true);else if(k<0)spawnWanderer(a,1);else if(k<counts.upper)spawnCirculator(a);else spawnWanderer(a,2);
      a.yaw=a.yawT;a.dotAt=0;a.inView=false;
      if(a.active)deadlines.schedule(a,a.t0+a.dur+offscreenDelay(a));
    });
    needLod=true;
  }

  async function makeSlot(variant){
    const model=await C.Model.fromGltfAsync({url:'/assets/walk-crowd/person-'+variant+'.glb',scale:.98,allowPicking:false,show:false,shadows:C.ShadowMode.DISABLED});
    const slot={model,variant,agent:null,ready:false,animating:false,posed:false,still:0,poseAt:0,poseDistance:0};
    model.readyEvent.addEventListener(()=>{if(model.isDestroyed())return;model.activeAnimations.animateWhilePaused=true;slot.ready=true;});
    modelLayer.add(model);return slot;
  }
  // Removing the walk clip keeps the last pose, so standing or distant people cost no joint updates.
  function animate(s,on){
    if(!s.ready||s.animating===on)return;s.animating=on;s.still=0;
    if(on)s.model.activeAnimations.addAll({loop:C.ModelAnimationLoop.REPEAT,animationTime:duration=>s.poseDistance/1.3/duration});
    else s.model.activeAnimations.removeAll();
  }
  async function loadSlots(target){
    if(loading||loadFailed)return;loading=true;
    try{
      while(!disposed&&slots.length<Math.min(poolLimit,target)){
        const batch=[];for(let k=0;k<6&&slots.length+batch.length<Math.min(poolLimit,target);k++)batch.push(makeSlot((slots.length+batch.length)%4));
        for(const s of await Promise.all(batch)){if(disposed){s.model.destroy();continue;}slots.push(s);free[s.variant].push(s);}
        needLod=true;
      }
    }catch(e){loadFailed=true;post({notice:'사람 모델 일부를 불러오지 못해 점으로 표시합니다.'});}
    loading=false;
  }
  function bind(a){
    let s=free[a.variant].pop();if(!s)for(const f of free)if((s=f.pop()))break;if(!s)return;
    s.agent=a;s.posed=false;s.poseAt=0;a.model=s;a.yaw=a.yawT;updateModel(s);s.model.show=true;if(a.dot)a.dot.show=false;
  }
  function unbind(s){animate(s,false);s.model.show=false;if(s.agent)s.agent.model=null;s.agent=null;free[s.variant].push(s);}
  function updateModel(s){
    const a=s.agent;position(a,scratch);hpr.heading=a.yaw-Math.PI/2;
    s.model.modelMatrix=C.Transforms.headingPitchRollToFixedFrame(scratch,hpr,C.Ellipsoid.WGS84,C.Transforms.eastNorthUpToFixedFrame,s.model.modelMatrix);
  }
  function placeDot(a){position(a,scratch);const k=.9/C.Cartesian3.magnitude(scratch);scratch.x+=scratch.x*k;scratch.y+=scratch.y*k;scratch.z+=scratch.z*k;a.dot.position=scratch;}

  function lod(){
    const floors=renderedFloors(),shown=f=>!floors||floors.includes(f),cam=viewer.camera;
    C.Cartesian3.clone(cam.positionWC,lodPosition);C.Cartesian3.clone(cam.directionWC,lodDirection);
    const cull=cam.frustum.computeCullingVolume(cam.positionWC,cam.directionWC,cam.upWC),cands=[];
    for(const a of agents){
      // At most half a second of hidden motion is caught up before culling, so
      // returning to a floor or turning round never shows a stale position.
      if(a.active&&time>=a.t0+a.dur)advance(a);
      const wasInView=a.inView;
      a.vis=enabled&&a.active&&shown(floorNow(a));a.want=false;a.inView=false;if(!a.vis)continue;
      position(a,sphere.center);if(cull.computeVisibility(sphere)===C.Intersect.OUTSIDE)continue;a.inView=true;
      if(!wasInView)deadlines.schedule(a,a.t0+a.dur);
      a.d2=C.Cartesian3.distanceSquared(sphere.center,cam.positionWC);
      if(a.d2<1.44){a.vis=false;continue;}
      if(a.d2<MODEL_RANGE*MODEL_RANGE)cands.push(a);
    }
    for(const a of selectNearest(cands,Math.min(poolLimit,slots.length)))a.want=true;
    for(const s of slots)if(s.agent&&!s.agent.want)unbind(s);
    for(const a of cands)if(a.want&&!a.model)bind(a);
    let models=0,dots=0;visibleDots.length=0;
    for(const a of agents){
      const dot=a.vis&&a.inView&&!a.model;
      if(dot&&!a.dot)a.dot=dotLayer.add({color:colors[a.variant],pixelSize:3,outlineWidth:0,scaleByDistance:dotScale,show:false});
      if(a.dot){if(dot){if(!a.dot.show){placeDot(a);a.dotAt=time+dotInterval(a.d2)*(1+a.id%8)/8;}visibleDots.push(a);}if(a.dot.show!==dot)a.dot.show=dot;}
      if(a.model)models++;else if(dot&&a.inView)dots++;
    }
    const wanted=Math.min(poolLimit,cands.length);if(enabled&&slots.length<wanted)loadSlots(wanted);
    status(models,dots,floors);
  }
  function status(models,dots,floors){
    const msg={avatars:models,farAvatars:dots,expected:comp?.expected??0,simulated:enabled&&counts?counts.total:0,upper:comp?Math.round(upper):0,floors:floors?floors.join('·'):'전 층',crowdEnabled:enabled};
    const key=JSON.stringify(msg);if(key!==lastStatus){lastStatus=key;post(msg);}
  }
  // Person-model budget follows the real frame time: fewer when the device struggles, more when it has headroom.
  function adapt(rawMs){
    if(!(rawMs>0&&rawMs<250))return;frameMs+=(rawMs-frameMs)*.06;adaptClock+=rawMs;if(adaptClock<1500)return;adaptClock=0;
    const bound=slots.reduce((n,s)=>n+(s.agent?1:0),0);
    if(frameMs>38&&poolLimit>minPool){poolLimit=Math.max(minPool,Math.floor(poolLimit*.8));needLod=true;}
    else if(frameMs>45&&agentCap>1500){agentCap=Math.max(1500,Math.floor(agentCap*.8));rebuild(true);}
    else if(frameMs<24&&poolLimit<maxPool&&bound>=poolLimit*.95){poolLimit=Math.min(maxPool,Math.ceil(poolLimit*1.12));needLod=true;}
  }

  return {
    setData(d){input={...input,...d};rebuild();},
    setEnabled(v){
      enabled=Boolean(v);
      if(!enabled){pausedAt??=time;visibleDots.length=0;for(const s of slots)if(s.agent)unbind(s);for(const a of agents)if(a.dot)a.dot.show=false;status(0,0,renderedFloors());return;}
      // People OFF is a pause. Do not replay minutes of hidden work in one frame
      // when the user switches people back on (camera comparison does this too).
      if(pausedAt!==null){const gap=time-pausedAt;deadlines.clear();for(const a of agents)if(a.active){a.t0+=gap;deadlines.schedule(a,a.t0+a.dur);}pausedAt=null;}
      rebuild();needLod=true;
    },
    refresh(){needLod=true;},
    tick(dt,t,rawMs=0){
      time=t;if(!enabled||!comp||disposed||document.hidden)return;
      adapt(rawMs);
      for(let a;(a=deadlines.take(time));)if(a.active)advance(a);
      const cam=viewer.camera,cameraMoved=C.Cartesian3.distanceSquared(cam.positionWC,lodPosition)>.25||C.Cartesian3.distanceSquared(cam.directionWC,lodDirection)>.0016;
      lodClock+=dt;if(needLod||lodClock>.25||(cameraMoved&&lodClock>.08)){lodClock=0;needLod=false;lod();}
      const turn=Math.min(1,dt*5);
      for(const s of slots){
        const a=s.agent;if(!a)continue;
        const moving=a.segLen>0&&time<a.t0+a.dur;
        if(s.ready&&((moving&&a.d2<ANIMATE_RANGE*ANIMATE_RANGE)||!s.posed)){
          if(!s.posed||time>=s.poseAt){s.poseDistance=a.walked+a.segLen*progress(a);s.poseAt=time+poseInterval(a.d2);}
          animate(s,true);s.posed=true;s.still=0;
        }else if(s.animating&&++s.still>2)animate(s,false);
        let d=a.yawT-a.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));
        if(moving||Math.abs(d)>.002){a.yaw+=d*turn;updateModel(s);}
      }
      for(const a of visibleDots)if(time>=a.dotAt){if(a.segLen>0)placeDot(a);a.dotAt=time+dotInterval(a.d2);}
    },
    get active(){return enabled&&!!comp&&agents.length>0;},
    destroy(){disposed=true;version++;deadlines.clear();visibleDots.length=0;viewer.scene.primitives.remove(modelLayer);viewer.scene.primitives.remove(dotLayer);},
  };
}

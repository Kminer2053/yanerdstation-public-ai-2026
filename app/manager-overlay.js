// Manager review marks: facility reference, walking access point, pickable floor points and route steps.
// Clicking only reports the mark id (or, while drawing a route, the clicked floor position) to the parent page;
// nothing here edits the model or the register.
const KINDS={
  facility:{color:'#ffd24a',size:13},
  access:{color:'#22c55e',size:16},
  candidate:{color:'#ffffff',size:9,pick:true},
  step:{color:'#22d3ee',size:10,pick:true},
  connection:{color:'#4299ff',size:13,pick:true},
  anchor:{color:'#f472b6',size:13},
  landing:{color:'#a855f7',size:14,pick:true},
  // Operations feed situations (manager overview).
  critical:{color:'#ef4444',size:17,pick:true,pulse:true},
  warning:{color:'#f59e0b',size:15,pick:true},
  advice:{color:'#14b8a6',size:13,pick:true},
  data:{color:'#8b5cf6',size:13,pick:true},
  progress:{color:'#3b82f6',size:14,pick:true},
};
const LABEL_RANGE={step:90,landing:160};
const MAX_MARKS=2000,MAX_LINES=320,MAX_LINE_POINTS=6000;
const LABEL_ORDER=['critical','warning','progress','access','facility','advice','data','landing','connection','anchor','step'];
// Nearest spots first; labels stay next to their point (a far-shifted label would read as another point's).
const LABEL_SLOTS=[[0,-24],[0,-50],[-70,-24],[70,-24],[0,-76],[0,24],[-70,-50],[70,-50],[-70,24],[70,24]];
// Hangul is about a full em wide at 13px; Latin, digits and symbols about half.
const labelWidth=t=>[...t].reduce((w,c)=>w+(/[\u3131-\uD79D]/.test(c)?13.5:7.4),0)+16;

export function createManagerOverlay(C,viewer,{post,valid}){
  const source=new C.CustomDataSource('manager-review');viewer.dataSources.add(source);
  const canvas=viewer.scene.canvas,handler=new C.ScreenSpaceEventHandler(canvas);
  let marks=[],lines=[],selected=null,hover=null,moveAt=0,drawMode=false,drawHeight=null,layoutKey='',layoutDirty=true,generation=0;
  // Fresh entity ids per repaint: re-adding an id removed during suspended events keeps Cesium drawing the old entity.
  const entityOf=new Map();
  // Screen-space label layout: nudges labels apart and hides the ones that cannot be placed. Positions never move.
  const removeLayout=viewer.scene.preRender.addEventListener(()=>{
    const labelled=marks.filter(m=>m.label);if(!labelled.length)return;
    const cam=viewer.camera,W=canvas.clientWidth,H=canvas.clientHeight,key=[W,H,...[cam.positionWC,cam.directionWC].flatMap(p=>[p.x.toFixed(2),p.y.toFixed(2),p.z.toFixed(2)])].join(',');
    if(!layoutDirty&&key===layoutKey)return;layoutDirty=false;layoutKey=key;
    // Every visible point is an obstacle too, so a label never hides another point.
    const boxes=marks.filter(m=>m.kind!=='candidate').map(m=>C.SceneTransforms.worldToWindowCoordinates(viewer.scene,cart(m.point))).filter(Boolean).map(p=>({x:p.x-10,y:p.y-10,w:20,h:20}));
    const rank=m=>m.id===selected?-1:(LABEL_ORDER.indexOf(m.kind)+1||99);
    for(const m of [...labelled].sort((a,b)=>rank(a)-rank(b))){
      const e=entityOf.get(m.id);if(!e?.label)continue;
      const p=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,cart(m.point));
      if(!p||p.x<0||p.y<0||p.x>W||p.y>H){e.label.show=false;continue;}
      const w=labelWidth(m.label),h=24;let placed=null;
      for(const [dx,dy] of LABEL_SLOTS){
        const b={x:p.x+dx-w/2,y:p.y+dy-h/2,w,h};if(b.x<0||b.y<0||b.x+w>W||b.y+h>H)continue;
        if(boxes.some(o=>b.x<o.x+o.w&&b.x+w>o.x&&b.y<o.y+o.h&&b.y+h>o.y))continue;placed={dx,dy,b};break;}
      e.label.show=Boolean(placed);if(placed){boxes.push(placed.b);e.label.pixelOffset=new C.Cartesian2(placed.dx,placed.dy);}
    }
    // Entity changes made here are drawn on the next frame; the scene renders on request only.
    viewer.scene.requestRender();
  });
  const cart=(p,o=.3)=>C.Cartesian3.fromDegrees(p[0],p[1],p[2]+o);
  const color=c=>C.Color.fromCssColorString(c);
  const text=(v,n)=>typeof v==='string'&&v.length<=n;
  function style(m){
    const k=KINDS[m.kind],on=m.id===selected||m.id===hover;
    // Critical situations breathe so they are found at a glance (the crowd keeps the scene rendering).
    const size=k.pulse&&!on?new C.CallbackProperty(()=>k.size+5*Math.abs(Math.sin(performance.now()/260)),false):k.size+(on?6:0);
    return {pixelSize:size,color:color(on&&m.kind==='candidate'?'#facc15':k.color),outlineColor:color(on?'#facc15':'#07151c'),outlineWidth:on?3:1.5,
      // Floor candidates stay depth tested so points behind walls cannot be chosen.
      disableDepthTestDistance:m.kind==='candidate'?0:Number.POSITIVE_INFINITY};
  }
  function paint(){
    source.entities.suspendEvents();source.entities.removeAll();entityOf.clear();generation++;
    for(const l of lines){
      const material=l.dashed?new C.PolylineDashMaterialProperty({color:color(l.color),dashLength:12}):color(l.color);
      source.entities.add({polyline:{positions:l.coordinates.map(c=>cart(c,.35)),width:l.width,arcType:C.ArcType.NONE,material,depthFailMaterial:l.dashed?new C.PolylineDashMaterialProperty({color:color(l.color).withAlpha(.55),dashLength:12}):color(l.color).withAlpha(.5)}});
    }
    for(const m of marks){
      const on=m.id===selected||m.id===hover;
      entityOf.set(m.id,source.entities.add({id:'manager:'+generation+':'+m.id,properties:{managerId:m.id},position:cart(m.point),point:style(m),
        label:m.label?{text:m.label,font:(on||m.kind!=='step'?'bold ':'')+'13px sans-serif',fillColor:C.Color.WHITE,showBackground:true,
          backgroundColor:color(m.kind==='access'?'#14532d':m.kind==='facility'?'#5b4a0b':m.kind==='critical'?'#7f1d1d':m.kind==='warning'?'#78350f':m.kind==='progress'?'#1e3a8a':'#102a38').withAlpha(.92),pixelOffset:new C.Cartesian2(0,-22),
          disableDepthTestDistance:Number.POSITIVE_INFINITY,...(LABEL_RANGE[m.kind]&&!on?{distanceDisplayCondition:new C.DistanceDisplayCondition(0,LABEL_RANGE[m.kind])}:{})}:undefined}));
    }
    source.entities.resumeEvents();layoutDirty=true;viewer.scene.requestRender();
  }
  function restyle(id){const m=marks.find(m=>m.id===id),e=m&&entityOf.get(id);if(!e)return;const s=style(m);e.point.pixelSize=s.pixelSize;e.point.color=s.color;e.point.outlineColor=s.outlineColor;e.point.outlineWidth=s.outlineWidth;viewer.scene.requestRender();}
  function fly(points,{pitch=-60,min=20,factor=2.8}={}){
    if(!points.length)return;
    const sphere=C.BoundingSphere.fromPoints(points.map(p=>cart(p,0)));
    viewer.camera.cancelFlight();viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);
    viewer.camera.flyToBoundingSphere(sphere,{duration:.8,offset:new C.HeadingPitchRange(viewer.camera.heading,C.Math.toRadians(pitch),Math.max(min,sphere.radius*factor))});
  }
  function show(d){
    const nextMarks=Array.isArray(d.marks)?d.marks:[],nextLines=Array.isArray(d.lines)?d.lines:[];
    if(nextMarks.length>MAX_MARKS||nextLines.length>MAX_LINES||!nextMarks.every(m=>text(m?.id,160)&&KINDS[m.kind]&&valid(m.point)&&(m.label===undefined||text(m.label,120)))
      ||!nextLines.every(l=>Array.isArray(l?.coordinates)&&l.coordinates.length>=2&&l.coordinates.length<=MAX_LINE_POINTS&&l.coordinates.every(valid)))
      throw Error('관리 화면 표시 좌표를 확인하세요.');
    marks=nextMarks.map(m=>({id:m.id,kind:m.kind,point:m.point,label:m.label}));
    lines=nextLines.map(l=>({coordinates:l.coordinates,color:/^#[0-9a-f]{6}$/i.test(l.color)?l.color:'#ffd24a',width:Math.max(1,Math.min(8,Number(l.width)||3)),dashed:Boolean(l.dashed)}));
    selected=text(d.selected,160)?d.selected:null;hover=null;drawMode=Boolean(d.draw);drawHeight=Number.isFinite(d.draw?.height)?d.draw.height:null;canvas.style.cursor=drawMode?'crosshair':'';paint();
    if(d.view&&valid(d.view.point))fly([d.view.point],{pitch:Math.max(-89,Math.min(-20,Number(d.view.pitch)||-60)),min:Math.max(12,Math.min(200,Number(d.view.range)||45)),factor:1});
    else if(d.fit)fly([...marks.map(m=>m.point),...lines.flatMap(l=>l.coordinates)]);
  }
  function focus(id){const m=marks.find(m=>m.id===id);if(!m)return;selected=id;paint();fly([m.point],{pitch:-50,min:24,factor:1});}
  function clear(){marks=[];lines=[];selected=hover=null;drawMode=false;drawHeight=null;source.entities.removeAll();canvas.style.cursor='';viewer.scene.requestRender();}
  // Surface under the cursor; when it is missing (void, see-through surface) or far from the working floor
  // level (wall top, roof), the point where the view ray meets that floor level is used instead.
  function groundAt(pos){
    const hit=viewer.scene.pickPositionSupported?viewer.scene.pickPosition(pos):null,c=hit&&C.Cartographic.fromCartesian(hit);
    if(c&&(drawHeight===null||Math.abs(c.height-drawHeight)<=2.5))return c;
    const ray=drawHeight===null?null:viewer.camera.getPickRay(pos);if(!ray)return null;
    const at=t=>C.Cartographic.fromCartesian(C.Ray.getPoint(ray,t));if(at(0).height<drawHeight)return null;
    let lo=0,hi=3000;for(let k=0;k<48;k++){const mid=(lo+hi)/2;if(at(mid).height>drawHeight)lo=mid;else hi=mid;}
    const g=at(hi);return Math.abs(g.height-drawHeight)<1?g:null;
  }
  // Screen-space fallback makes small floor points easy to hit; only the visible mark ids are reported.
  function pickId(pos,radius=14){
    const hit=viewer.scene.pick(pos),id=hit?.id?.properties?.managerId?.getValue?.(C.JulianDate.now());if(id)return id;
    let best=null,bd=radius*radius;
    for(const m of marks){if(!KINDS[m.kind].pick)continue;const s=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,cart(m.point));if(!s)continue;const d=(s.x-pos.x)**2+(s.y-pos.y)**2;if(d<bd){bd=d;best=m.id;}}
    return best;
  }
  handler.setInputAction(e=>{
    if(!marks.length&&!drawMode)return;const id=pickId(e.position,drawMode?8:14);if(id){post({managerPick:id});return;}
    if(!drawMode)return;
    const c=groundAt(e.position),p=c&&[C.Math.toDegrees(c.longitude),C.Math.toDegrees(c.latitude),c.height];
    if(p&&valid(p))post({managerGround:p});else post({notice:'바닥 위치를 읽지 못했습니다. 바닥을 다시 눌러 주세요.'});
  },C.ScreenSpaceEventType.LEFT_CLICK);
  handler.setInputAction(e=>{
    if(!marks.some(m=>KINDS[m.kind].pick))return;const now=performance.now();if(now-moveAt<70)return;moveAt=now;
    const id=pickId(e.endPosition,10),next=id&&KINDS[marks.find(m=>m.id===id)?.kind]?.pick?id:null;if(next===hover)return;
    const old=hover;hover=next;restyle(old);restyle(hover);canvas.style.cursor=hover?'pointer':drawMode?'crosshair':'';
  },C.ScreenSpaceEventType.MOUSE_MOVE);
  return {show,focus,clear,destroy(){removeLayout();handler.destroy();viewer.dataSources.remove(source,true);}};
}

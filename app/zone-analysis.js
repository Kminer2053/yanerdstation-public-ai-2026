// Zone retail view: one column per store and metric, drawn in screen-space width so it reads at any distance and
// shows through booths and crowds (lighter where hidden). Heights and figures follow a fractional time, so the
// view changes smoothly between hourly values. Heights share one scale for the whole day. Seen from above (90°)
// the same values lie on the floor as bars along the screen's left-right axis, so their lengths compare directly.
const COLORS={usage:'#14b8b0',sales:'#f2a93b',flow:'#5b8def'};
const fmt=v=>v===null||v===undefined?'미확보':new Intl.NumberFormat('ko-KR',{maximumFractionDigits:0}).format(v);
const textWidth=t=>[...t].reduce((w,c)=>w+(/[ㄱ-힝]/.test(c)?13.5:7.4),0)+18;
const SLOTS=[[0,-30],[0,-62],[-90,-30],[90,-30],[0,-94],[-90,-62],[90,-62],[0,30]];

// Day's total up to t (whole hours before t plus the elapsed part of this hour).
function total(series,t){
  if(!Array.isArray(series)||!series.some(Number.isFinite))return null;const h=Math.max(0,Math.min(24,Math.floor(t))),f=Math.max(0,Math.min(1,t-h));
  let s=0;for(let k=0;k<h&&k<24;k++)s+=Number.isFinite(series[k])?series[k]:0;if(h<24&&Number.isFinite(series[h]))s+=series[h]*f;return s;
}
function at(series,t){
  if(!Array.isArray(series))return null;const h=Math.max(0,Math.min(23,Math.floor(t))),f=Math.max(0,Math.min(1,t-h)),a=series[h],b=series[Math.min(23,h+1)];
  if(!Number.isFinite(a))return null;return Number.isFinite(b)&&h<23?a+(b-a)*f:a;
}

export function createZoneAnalysis(C,viewer){
  const source=new C.CustomDataSource('zone-analysis-bars');viewer.dataSources.add(source);
  const canvas=viewer.scene.canvas;let items=[],t=12,metric='both',authorized=true,maxima={usage:1,sales:1,flow:1},barMax=10,layoutKey='',layoutDirty=true,mode='front',across=90,valueMode='hourly';
  const color=c=>C.Color.fromCssColorString(c);
  const metricsFor=()=>metric==='both'?['usage','sales']:[metric];
  const height=(k,v)=>v>0?.6+(barMax-.6)*Math.min(1,v/Math.max(1,maxima[k]||1)):0;
  // Usage and sales follow the chosen aggregation; nearby passages are always per hour.
  const value=(it,k)=>k==='sales'&&!authorized?null:valueMode==='cumulative'&&k!=='flow'?total(it.series?.[k],t):at(it.series?.[k],t);
  function top(it){return mode==='top'?.4:Math.max(1.2,...metricsFor().map(k=>height(k,value(it,k)||0)))+.9;}
  // Metres to degrees at this latitude; bearing clockwise from north.
  const shift=(p,bearing,m)=>{const a=bearing*Math.PI/180;return [p[0]+Math.sin(a)*m/(111320*Math.cos(p[1]*Math.PI/180)),p[1]+Math.cos(a)*m/111320];};
  function text(it){
    const parts=metricsFor().map(k=>{const v=value(it,k);return k==='usage'?'이용 '+fmt(v)+'건':k==='sales'?(!authorized?'매출 권한 필요':'매출 '+(v===null?'미확보':fmt(v/10000)+'만원')):it.offRoute?'통과 경로 밖':'통과 '+fmt(v)+'건';});
    return it.n+' '+it.name.slice(0,16)+'\n'+parts.join(' · ')+(valueMode==='cumulative'?(metric==='flow'?' /시':' · 누적'):' /시');
  }
  function show(d){
    source.entities.suspendEvents();source.entities.removeAll();items=[];
    metric=['both','usage','sales','flow'].includes(d.metric)?d.metric:'both';authorized=d.authorized!==false;t=Number.isFinite(d.t)?d.t:t;
    valueMode=d.valueMode==='cumulative'?'cumulative':'hourly';
    maxima={usage:Math.max(1,d.maxima?.usage||1),sales:Math.max(1,d.maxima?.sales||1),flow:Math.max(1,d.maxima?.flow||1)};barMax=Math.max(5,Math.min(18,Number(d.barMax)||10));
    const ks=metricsFor();
    (d.rows||[]).forEach((r,i)=>{
      const p=r.point;if(!Array.isArray(p)||!p.every(Number.isFinite))return;
      const base=p[2]-1.45,metresLon=1/(111320*Math.cos(p[1]*Math.PI/180)),it={n:i+1,name:String(r.name||''),point:p,base,series:r.series||{},approved:Boolean(r.approved),offRoute:Boolean(r.offRoute)};
      ks.forEach((k,j)=>{
        const lon=p[0]+(j-(ks.length-1)/2)*.9*metresLon,bottom=C.Cartesian3.fromDegrees(lon,p[1],base),slot=(j-(ks.length-1)/2)*1.1;
        source.entities.add({polyline:{positions:new C.CallbackProperty(()=>{const h=height(k,value(it,k)||0);
          if(mode==='top'){const start=shift(p,across-90,slot),end=shift(start,across,Math.max(.05,h));return [C.Cartesian3.fromDegrees(start[0],start[1],base+.2),C.Cartesian3.fromDegrees(end[0],end[1],base+.2)];}
          return [bottom,C.Cartesian3.fromDegrees(lon,p[1],base+Math.max(.05,h))];},false),
          width:mode==='top'?13:18,arcType:C.ArcType.NONE,material:color(COLORS[k]),depthFailMaterial:color(COLORS[k]).withAlpha(.45)}});
      });
      source.entities.add({position:C.Cartesian3.fromDegrees(p[0],p[1],base+.08),ellipse:{semiMajorAxis:1.4,semiMinorAxis:1.4,height:base+.05,material:color('#0b2a33').withAlpha(.55),outline:true,outlineColor:color('#7dd3c8')},
        label:{text:String(it.n),font:'bold 13px sans-serif',fillColor:C.Color.WHITE,showBackground:true,backgroundColor:color('#123442').withAlpha(.95),backgroundPadding:new C.Cartesian2(6,4),pixelOffset:new C.Cartesian2(0,14),disableDepthTestDistance:Number.POSITIVE_INFINITY}});
      if(it.approved)it.label=source.entities.add({position:new C.CallbackProperty(()=>C.Cartesian3.fromDegrees(p[0],p[1],base+top(it)),false),
        label:{text:new C.CallbackProperty(()=>text(it),false),font:'bold 13px sans-serif',fillColor:C.Color.WHITE,showBackground:true,backgroundColor:color('#0f2b36').withAlpha(.94),backgroundPadding:new C.Cartesian2(9,6),
          disableDepthTestDistance:Number.POSITIVE_INFINITY,verticalOrigin:C.VerticalOrigin.CENTER}});
      items.push(it);
    });
    source.entities.resumeEvents();layoutDirty=true;viewer.scene.requestRender();
  }
  // Labels sit next to their column tops and never cover each other; the ones that do not fit hide (the badge stays).
  const removeLayout=viewer.scene.preRender.addEventListener(()=>{
    const labelled=items.filter(it=>it.label);if(!labelled.length)return;
    const cam=viewer.camera,W=canvas.clientWidth,H=canvas.clientHeight,key=[W,H,t.toFixed(3),...[cam.positionWC,cam.directionWC].flatMap(p=>[p.x.toFixed(2),p.y.toFixed(2),p.z.toFixed(2)])].join(',');
    if(!layoutDirty&&key===layoutKey)return;layoutDirty=false;layoutKey=key;
    const boxes=[{x:W-300,y:0,w:300,h:130}],order=[...labelled].sort((a,b)=>(value(b,metricsFor()[0])||0)-(value(a,metricsFor()[0])||0));
    for(const it of order){
      const s=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,C.Cartesian3.fromDegrees(it.point[0],it.point[1],it.base+top(it)));
      if(!s){it.label.label.show=false;continue;}
      const lines=text(it).split('\n'),w=Math.max(...lines.map(textWidth)),h=42;let placed=null;
      for(const [dx,dy] of SLOTS){const b={x:s.x+dx-w/2,y:s.y+dy-h/2,w,h};if(b.x<4||b.y<4||b.x+w>W-4||b.y+h>H-40)continue;if(boxes.some(o=>b.x<o.x+o.w&&b.x+w>o.x&&b.y<o.y+o.h&&b.y+h>o.y))continue;placed={dx,dy,b};break;}
      it.label.label.show=Boolean(placed);if(placed){boxes.push(placed.b);it.label.label.pixelOffset=new C.Cartesian2(placed.dx,placed.dy);}
    }
    viewer.scene.requestRender();
  });
  return {
    show,
    setTime(next){if(!Number.isFinite(next))return;t=Math.max(0,Math.min(23.999,next));layoutDirty=true;viewer.scene.requestRender();},
    // front: columns; top: floor bars pointing to the screen's right (camera heading + 90°).
    setMode(next,heading){mode=next==='top'?'top':'front';if(Number.isFinite(heading))across=(heading+90)%360;for(const e of source.entities.values)if(e.polyline)e.polyline.width=mode==='top'?13:18;layoutDirty=true;viewer.scene.requestRender();},
    clear(){source.entities.removeAll();items=[];viewer.scene.requestRender();},
    destroy(){removeLayout();viewer.dataSources.remove(source,true);},
  };
}

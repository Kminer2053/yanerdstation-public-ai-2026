import {facilitySpot} from '../src/crowd-core.js';

const COLORS={'매장':'#0f8f86','화장실':'#3677d6','안내·편의':'#d0901f'};

// Registered facilities as pickable circles for open-world exploring; names appear only up close or on hover.
export function createFacilityMarkers(C,viewer){
  const points=viewer.scene.primitives.add(new C.PointPrimitiveCollection());
  const labels=viewer.scene.primitives.add(new C.LabelCollection());
  const labelBg=C.Color.fromCssColorString('#102a38').withAlpha(.9),scratch=new C.Cartesian2();
  let items=[],enabled=true,hovered=null,shown=0;
  function set(list,ix){
    points.removeAll();labels.removeAll();items=[];hovered=null;
    for(const f of list){
      const spot=facilitySpot(ix,f);if(!spot||!spot.every(Number.isFinite))continue;
      const pos=C.Cartesian3.fromDegrees(spot[0],spot[1],spot[2]+1.7),id={facility:f.id};
      items.push({f,pos,
        point:points.add({position:pos,pixelSize:15,color:C.Color.fromCssColorString(COLORS[f.group]||COLORS['매장']),outlineColor:C.Color.WHITE,outlineWidth:2.5,show:false,id}),
        label:labels.add({position:pos,text:f.name,font:'600 13px sans-serif',fillColor:C.Color.WHITE,showBackground:true,backgroundColor:labelBg,backgroundPadding:new C.Cartesian2(7,4),pixelOffset:new C.Cartesian2(0,-16),verticalOrigin:C.VerticalOrigin.BOTTOM,horizontalOrigin:C.HorizontalOrigin.CENTER,show:false,id})});
    }
  }
  // Bird view: every circle on the shown floor stays visible. First person: only what is in line of sight nearby.
  function update(mode,floors){
    const on=enabled&&(mode==='bird'||mode==='explore'),cam=viewer.camera.positionWC,depth=mode==='bird'?Number.POSITIVE_INFINITY:0;shown=0;
    for(const m of items){
      const d=C.Cartesian3.distance(cam,m.pos),show=on&&(!floors||floors.includes(m.f.floor))&&(mode==='bird'?d<900:d<70);
      if(m.point.show!==show)m.point.show=show;if(show)shown++;
      if(m.point.disableDepthTestDistance!==depth){m.point.disableDepthTestDistance=depth;m.label.disableDepthTestDistance=depth;}
      const label=show&&(m.f.id===hovered||(mode==='explore'&&d<20));
      if(m.label.show!==label)m.label.show=label;
      const size=m.f.id===hovered?20:15;if(m.point.pixelSize!==size)m.point.pixelSize=size;
    }
  }
  const pickId=position=>{const hit=viewer.scene.pick(position);return hit?.id?.facility||null;};
  // Screen-space hit test on shown circles only: cheap enough for hover, no GPU pick pass.
  function nearest(position,maxPx){
    if(!position)return null;let best=null,bd=maxPx*maxPx;
    for(const m of items){
      if(!m.point.show)continue;const w=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,m.pos,scratch);if(!w)continue;
      const d=(w.x-position.x)**2+(w.y-position.y)**2;if(d<bd){bd=d;best=m.f.id;}
    }
    return best;
  }
  return {
    set,update,nearest,
    pick:pickId,
    hover(id){hovered=id;},
    setEnabled(v){enabled=Boolean(v);},
    get count(){return items.length;},
    get shown(){return shown;},
    destroy(){viewer.scene.primitives.remove(points);viewer.scene.primitives.remove(labels);},
  };
}

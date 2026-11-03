import { POINT_LAYERS, CONNECTOR_ROLES, mapFeature, validCoordinate, layoutConnectionLabels } from '../src/point-review-core.js';
import { REVIEW_FLOORS } from '../src/route-review-core.js';

// Review-only datasource: no tileset edits, routing, or facility visibility changes.
export async function createPointReviewLayer(Cesium,viewer,{site,setFloor,getFloor}) {
  if(site!=='S202103'||new URLSearchParams(location.search).get('pointReview')!=='1')return null;
  const source=new Cesium.CustomDataSource('STATION_ONE_POINT_REVIEW');
  await viewer.dataSources.add(source);
  const sketch=new Cesium.CustomDataSource('STATION_ONE_POINT_REVIEW_SKETCH');
  await viewer.dataSources.add(sketch);
  const routeDrafts=new Cesium.CustomDataSource('STATION_ONE_ROUTE_DRAFTS');
  await viewer.dataSources.add(routeDrafts);
  let active=false,draw=false,floor=null,routeFloor=null,records=[],selectedId=null,layoutDirty=true,lastLayoutKey='';
  const removeLayout=viewer.scene.preRender.addEventListener(()=>{
    if(!source.show||!records.some(p=>p.always_label))return;
    const camera=viewer.camera,canvas=viewer.scene.canvas;
    const key=[canvas.clientWidth,canvas.clientHeight,...[camera.positionWC,camera.directionWC,camera.upWC].flatMap(p=>[p.x,p.y,p.z])].join(',');
    if(!layoutDirty&&lastLayoutKey===key)return;layoutDirty=false;lastLayoutKey=key;
    const time=Cesium.JulianDate.now(),markers=records.filter(p=>p.always_label).map(p=>{
      const entity=source.entities.getById(p.id),position=entity.position.getValue(time),screen=Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene,position);
      return {id:p.id,label:p.label,selected:p.id===selectedId,compact:Cesium.Cartesian3.distance(camera.positionWC,position)>150,x:screen?.x,y:screen?.y};
    });
    for(const [id,label] of layoutConnectionLabels(markers,canvas.clientWidth,canvas.clientHeight)){
      const entity=source.entities.getById(id);entity.label.show=label.show;
      if(label.show){entity.label.text=label.text;entity.label.pixelOffset=new Cesium.Cartesian2(label.dx,label.dy);}
    }
    viewer.scene.requestRender();
  });
  const reply=data=>window.parent.postMessage(data,location.origin);
  const handler=new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction(movement=>{
    if(draw){
      if(!viewer.scene.pickPositionSupported)return reply({type:'station-one:point-review-draw-error',message:'이 환경은 3D 바닥 위치 선택을 지원하지 않습니다.'});
      const hit=viewer.scene.pick(movement.position);
      const model=hit?.getProperty?.('MODEL_NAME'),pickedFloor=hit?.getProperty?.('FLOOR');
      if(typeof model!=='string'||!/^([FB]\d{2})FL/.test(model)||pickedFloor!==getFloor())
        return reply({type:'station-one:point-review-draw-error',message:'현재 층의 바닥 모델 위를 선택하세요. 벽·천장·시설 위에는 영역을 만들지 않습니다.'});
      const pos=viewer.scene.pickPosition(movement.position);
      if(!pos)return reply({type:'station-one:point-review-draw-error',message:'바닥 모델 위를 선택해주세요.'});
      const geo=Cesium.Cartographic.fromCartesian(pos),coordinate=[Cesium.Math.toDegrees(geo.longitude),Cesium.Math.toDegrees(geo.latitude),geo.height];
      if(validCoordinate(coordinate))reply({type:'station-one:point-review-vertex',floor:getFloor(),coordinate});
      return;
    }
    const picked=viewer.scene.pick(movement.position),id=picked?.id?.properties?.reviewPointId?.getValue(Cesium.JulianDate.now());
    if(id)reply({type:'station-one:point-review-select',id});
  },Cesium.ScreenSpaceEventType.LEFT_CLICK);
  function paint(selected,labels){
    selectedId=selected;layoutDirty=true;
    source.entities.suspendEvents();source.entities.removeAll();
    for(const p of records){
      const role=CONNECTOR_ROLES[p.connector_role],color=Cesium.Color.fromCssColorString(role?.color||POINT_LAYERS[p.layer].color),chosen=p.id===selected;
      const props={reviewPointId:p.id};
      if(p.geometry.type==='Polygon'){
        const ring=p.geometry.coordinates[0],positions=ring.map(c=>Cesium.Cartesian3.fromDegrees(c[0],c[1],c[2]+.12));
        source.entities.add({id:p.id,properties:props,polygon:{hierarchy:new Cesium.PolygonHierarchy(positions.slice(0,-1)),perPositionHeight:true,material:color.withAlpha(.25)},polyline:{positions,width:chosen?4:2,material:color}});
      }else{
        const c=p.geometry.coordinates,grid=p.layer==='waypoint';
        source.entities.add({id:p.id,properties:props,position:Cesium.Cartesian3.fromDegrees(c[0],c[1],c[2]+.25),
          point:{pixelSize:chosen?14:grid?4:9,color,outlineColor:Cesium.Color.fromCssColorString('#07151c'),outlineWidth:chosen?3:1,disableDepthTestDistance:p.always_label?Number.POSITIVE_INFINITY:0},
          label:{text:role?(chosen||labels?`${role.label} · ${p.label}`:role.label):p.label,show:p.always_label||Boolean(role)||chosen||(labels&&!grid),font:role||p.always_label?'bold 14px sans-serif':'12px sans-serif',fillColor:color,showBackground:true,backgroundColor:Cesium.Color.fromCssColorString('#051721').withAlpha(.9),pixelOffset:new Cesium.Cartesian2(0,-23),distanceDisplayCondition:new Cesium.DistanceDisplayCondition(0,chosen||p.always_label?2000:100),disableDepthTestDistance:p.always_label?Number.POSITIVE_INFINITY:0}});
      }
    }
    source.entities.resumeEvents();source.show=active&&!draw&&getFloor()===floor;viewer.scene.requestRender();
  }
  const listener=event=>{
    if(event.origin!==location.origin||event.source!==window.parent)return;
    const d=event.data;
    if(d?.type==='station-one:route-draft-lines'){
      if(!REVIEW_FLOORS.includes(d.floor)||!Array.isArray(d.lines)||d.lines.length>20000||d.lines.some(l=>!Array.isArray(l.coordinates)||l.coordinates.length!==2||!l.coordinates.every(validCoordinate)))return;
      routeFloor=d.floor;routeDrafts.entities.suspendEvents();routeDrafts.entities.removeAll();routeDrafts.show=d.floor===getFloor();
      for(const line of d.lines){
        const kind=line.kind||d.kind,material=kind==='interfloor'?Cesium.Color.fromCssColorString(line.highlight?'#22d3ee':'#4299ff').withAlpha(line.highlight?1:.65):new Cesium.PolylineDashMaterialProperty({color:Cesium.Color.fromCssColorString('#dc91ff')});
        routeDrafts.entities.add({polyline:{positions:line.coordinates.map(c=>Cesium.Cartesian3.fromDegrees(c[0],c[1],c[2]+.35)),width:line.highlight?6:kind==='interfloor'?3:4,material}});
      }
      routeDrafts.entities.resumeEvents();
      viewer.scene.requestRender();return;
    }
    if(d?.type==='station-one:point-review-layer'){
      if(!REVIEW_FLOORS.includes(d.floor)||!Array.isArray(d.features)||d.features.length>30000)return;
      const valid=d.features.map(p=>mapFeature({...p,review_id:p.id}));
      if(valid.some(p=>!p)||new Set(valid.map(p=>p.id)).size!==valid.length){reply({type:'station-one:point-review-layer-applied',ok:false,requestId:d.requestId});return;}
      floor=d.floor;active=true;records=valid.filter(p=>p.floor===floor);
      setFloor(floor,Boolean(d.overview));paint(d.selected,Boolean(d.labels));
      if(d.overview&&records.length){
        const positions=records.flatMap(p=>p.geometry.type==='Point'?[p.geometry.coordinates]:p.geometry.coordinates[0]).map(c=>Cesium.Cartesian3.fromDegrees(...c));
        const sphere=Cesium.BoundingSphere.fromPoints(positions);
        viewer.camera.cancelFlight();viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        viewer.camera.flyToBoundingSphere(sphere,{duration:.7,offset:new Cesium.HeadingPitchRange(viewer.camera.heading,Cesium.Math.toRadians(-55),Math.max(25,sphere.radius*3))});
      }
      reply({type:'station-one:point-review-layer-applied',ok:true,count:records.length,floor,requestId:d.requestId});
    }
    if(d?.type==='station-one:point-review-draw'){
      draw=Boolean(d.enabled);source.show=active&&!draw&&getFloor()===floor;
      sketch.entities.removeAll();
      viewer.scene.canvas.style.cursor=draw?'crosshair':'';viewer.scene.requestRender();
    }
    if(d?.type==='station-one:point-review-sketch'&&draw&&Array.isArray(d.vertices)&&d.vertices.length<=100&&d.vertices.every(validCoordinate)){
      sketch.entities.removeAll();
      const positions=d.vertices.map(c=>Cesium.Cartesian3.fromDegrees(c[0],c[1],d.vertices[0][2]+.1));
      for(const position of positions)sketch.entities.add({position,point:{pixelSize:9,color:Cesium.Color.fromCssColorString('#43dc83')}});
      if(positions.length>1)sketch.entities.add({polyline:{positions,width:3,material:Cesium.Color.fromCssColorString('#43dc83')}});
      viewer.scene.requestRender();
    }
  };
  window.addEventListener('message',listener);
  return {setFloor(value){source.show=active&&!draw&&value===floor;sketch.show=value===floor;routeDrafts.show=value===routeFloor;},get active(){return active;},destroy(){removeLayout();window.removeEventListener('message',listener);handler.destroy();viewer.dataSources.remove(source,true);viewer.dataSources.remove(sketch,true);viewer.dataSources.remove(routeDrafts,true);}};
}

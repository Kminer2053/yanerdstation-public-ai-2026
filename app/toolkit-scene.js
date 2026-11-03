// Preview-only bridge: there is deliberately no save, fetch, or database operation.
import { addAssetEntities } from './toolkit-approved-layer.js';
export function createToolkitScene(C,viewer,hooks){
  const origins=new Set(['http://127.0.0.1:4197','http://localhost:4197','https://toolkit.yanerdstation.kr','https://ya-nerd-station.soalsebi.chatgpt.site']);
  const target=new URLSearchParams(location.search).get('toolkitOrigin');
  if(!origins.has(target)||window.parent===window)return;
  const send=data=>parent.postMessage({channel:'station-toolkit',...data},target);
  const layer=new C.CustomDataSource('toolkit-preview');viewer.dataSources.add(layer);
  const markers=new C.PointPrimitiveCollection();viewer.scene.primitives.add(markers);
  let project=null,floor='2F',grid=true,selected=null;
  const colors={origin:'#35c978',via:'#eef4f2',connection:'#398bef',facility:'#f3be35'};
  const pos=p=>C.Cartesian3.fromDegrees(...p),col=s=>C.Color.fromCssColorString(s);
  function draw(){
    layer.entities.removeAll();markers.removeAll();if(!project)return;
    const byId=new Map(project.points.map(p=>[p.id,p]));
    for(const p of project.points){if(p.floor!==floor||p.role==='via'&&!grid)continue;
      markers.add({id:{toolkit:{kind:'points',id:p.id}},position:pos([p.position[0],p.position[1],p.position[2]+.14]),pixelSize:p.role==='via'?5:12,color:col(colors[p.role]||'#fff'),outlineWidth:1,outlineColor:C.Color.BLACK});
      if(p.role!=='via')layer.entities.add({position:pos(p.position),label:{text:p.name,font:'12px sans-serif',fillColor:C.Color.WHITE,showBackground:true,pixelOffset:new C.Cartesian2(0,-18),distanceDisplayCondition:new C.DistanceDisplayCondition(0,150)}});
      if(p.area)layer.entities.add({polygon:{hierarchy:p.area.map(pos),perPositionHeight:true,material:col(colors.origin).withAlpha(.22)}});
    }
    for(const c of project.connections||[]){const pts=c.point_ids.map(id=>byId.get(id)).filter(Boolean);if(!pts.some(p=>p.floor===floor))continue;
      const route=c.path?.length?c.path.map(id=>byId.get(id)).filter(Boolean):pts;
      if(route.length>1)layer.entities.add({polyline:{positions:route.map(p=>pos(p.position)),width:3,material:col('#398bef')}});
    }
    const routes=selected?.kind==='routes'?project.routes.filter(r=>r.id===selected.id):[];
    for(const r of routes){const ids=r.preview_changed?r.point_ids:(r.raw_point_ids||r.point_ids);const pts=ids.map(id=>byId.get(id)).filter(Boolean);
      for(let i=1;i<pts.length;i++)if(pts[i-1].floor===floor||pts[i].floor===floor)layer.entities.add({polyline:{positions:[pts[i-1],pts[i]].map(p=>pos([p.position[0],p.position[1],p.position[2]+.2])),width:6,material:new C.PolylineArrowMaterialProperty(col('#f4b437'))}});
    }
    for(const a of project.assets||[]){if(a.floor!==floor||a.hidden||a.source_record&&!a.preview_changed||a.proposal&&!a.preview_changed&&hooks.hasApprovedAsset?.(a.id))continue;
      const asset={...a,facades:Object.fromEntries(Object.entries(a.facades||{}).map(([side,image])=>[side,new URL(image,target).href]))};
      addAssetEntities(C,layer.entities,asset,{preview:!a.proposal||a.preview_changed});
    }
    viewer.scene.requestRender();
  }
  function focus(p){if(!Array.isArray(p)||!p.every(Number.isFinite))return;viewer.camera.flyTo({destination:pos([p[0],p[1]-.0003,p[2]+30]),orientation:{heading:0,pitch:C.Math.toRadians(-45),roll:0},duration:.4});}
  addEventListener('message',e=>{if(e.origin!==target||e.source!==parent||e.data?.channel!=='station-toolkit')return;const d=e.data;
    if(d.action==='render'&&d.project?.site_id==='S202103'){project=d.project;selected=d.selected;draw();}
    if(d.action==='floor'&&/^(B[1-9]|[1-9]F|RF)$/.test(d.floor)){floor=d.floor;hooks.setFloor(floor);draw();}
    if(d.action==='grid'){grid=!!d.value;draw();}
    if(d.action==='focus')focus(d.position);
    if(d.action==='fit')hooks.overview();
    if(d.action==='hello')send({event:'ready'});
    // Report review (야!너두 console): show a proposed facade on its slot and fly to the slot's front. Preview only.
    if(d.action==='facade-preview'){const clear=d.imageUrl===null;if(clear||typeof d.slotAlias==='string'&&d.slotAlias.length<=120&&typeof d.imageUrl==='string'&&d.imageUrl.length<=1500000&&/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(d.imageUrl))hooks.previewFacade?.(clear?null:{slotAlias:d.slotAlias,imageUrl:d.imageUrl});}
    if(d.action==='facade-focus'&&d.focus&&typeof d.focus==='object'){const f=d.focus,n=v=>Number.isFinite(v)?v:undefined;if(/^(B[1-9]|[1-9]F|RF)$/.test(f.floor)&&Number.isFinite(f.longitude)&&Number.isFinite(f.latitude)){floor=f.floor;hooks.focusFacade?.({floor:f.floor,longitude:f.longitude,latitude:f.latitude,height:n(f.height),cameraHeading:n(f.cameraHeading),surfaceWidth:n(f.surfaceWidth),surfaceHeight:n(f.surfaceHeight),label:String(f.label||'').slice(0,80),imageId:String(f.imageId||'').slice(0,120),model:String(f.model||'').slice(0,40),tdId:String(f.tdId||'').slice(0,80)});draw();}}
  });
  const handler=new C.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction(e=>{let p;try{p=viewer.scene.pickPosition(e.position);}catch{}if(!p)return;const c=C.Cartographic.fromCartesian(p),picked=viewer.scene.pick(e.position);
    send({event:'pick',pick:{floor,position:[C.Math.toDegrees(c.longitude),C.Math.toDegrees(c.latitude),c.height],tag:picked?.id?.toolkit||null,sourceId:picked?.getProperty?.('TD_ID')||null,view:{heading:C.Math.toDegrees(viewer.camera.heading),pitch:C.Math.toDegrees(viewer.camera.pitch)}}});
  },C.ScreenSpaceEventType.LEFT_CLICK);
  send({event:'ready'});
  return {refresh:draw};
}

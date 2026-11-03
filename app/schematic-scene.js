// A deliberately labelled degraded view built from reviewed coordinates only.
// Does not pretend to contain VWorld buildings, facades or a full floor surface.
export async function createSchematicScene(C,viewer,initialFloor){
  const get=async path=>{const r=await fetch(path);if(!r.ok)throw Error('간략 경로도 자료 연결 실패');return r.json()};
  const [graph,catalog]=await Promise.all([get('/data/experience/walk-graph.json'),get('/api/catalog')]);
  const layers=new Map(),labels=new C.CustomDataSource('registered-facility-positions');await viewer.dataSources.add(labels);
  const cart=p=>C.Cartesian3.fromDegrees(p[0],p[1],p[2]);
  for(const floor of [...new Set(graph.points.map(p=>p[1]))]){
    const layer=viewer.scene.primitives.add(new C.PointPrimitiveCollection());layer.show=false;
    for(const p of graph.points)if(p[1]===floor)layer.add({position:cart(p.slice(2,5)),color:C.Color.fromCssColorString('#678891').withAlpha(.7),pixelSize:3,outlineWidth:0});
    layers.set(floor,layer);
  }
  for(const f of catalog.facilities){const p=f.reference;if(!p)continue;labels.entities.add({id:f.id,position:cart([p.lon,p.lat,p.height]),properties:{floor:f.floor},point:{pixelSize:7,color:C.Color.fromCssColorString('#c09a43'),outlineColor:C.Color.WHITE,outlineWidth:1},label:{text:f.name,font:'13px sans-serif',fillColor:C.Color.fromCssColorString('#173644'),showBackground:true,backgroundColor:C.Color.WHITE.withAlpha(.8),pixelOffset:new C.Cartesian2(0,-15),distanceDisplayCondition:new C.DistanceDisplayCondition(0,100)}});}
  let active=initialFloor,shown=[initialFloor];
  const setFloors=floors=>{shown=floors;for(const [floor,layer]of layers)layer.show=floors.includes(floor);for(const e of labels.entities.values)e.show=floors.includes(e.properties.floor.getValue(C.JulianDate.now()));viewer.scene.requestRender();};
  const overview=()=>{const points=graph.points.filter(p=>p[1]===active).map(p=>cart(p.slice(2,5)));if(!points.length)return;viewer.camera.flyToBoundingSphere(C.BoundingSphere.fromPoints(points),{duration:.5,offset:new C.HeadingPitchRange(C.Math.toRadians(325),C.Math.toRadians(-55),0)});};
  setFloors([active]);overview();
  return {setFloor(f){active=f;setFloors([f])},showFloors:setFloors,overview:()=>{setFloors([active]);overview();},renderedFloors:()=>shown,destroy(){for(const layer of layers.values())viewer.scene.primitives.remove(layer);viewer.dataSources.remove(labels,true);}};
}

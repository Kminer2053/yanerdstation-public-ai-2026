import guardrail from './seoul-opening-guardrail.json' with {type:'json'};

export const OPENING_GUARDRAIL = guardrail;

// Build only a narrow boundary guardrail. The opening above 2F remains empty.
export function openingGuardrailPlan() {
  const spans=[], posts=[], seen=new Set();
  const addPost=point=>{
    const key=point.map(v=>v.toFixed(5)).join(',');
    if(!seen.has(key)){seen.add(key);posts.push(point);}
  };
  const line=guardrail.centerline;
  for(let segment=0;segment<line.length-1;segment++) {
    const a=line[segment],b=line[segment+1];
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const count=Math.ceil(length/guardrail.maxPanelWidth);
    const at=t=>a.map((v,i)=>v+(b[i]-v)*t);
    for(let i=0;i<count;i++) {
      const start=at(i/count),end=at((i+1)/count);
      spans.push({start,end,length:length/count,angle:Math.atan2(b[1]-a[1],b[0]-a[0])});
      // Existing source end caps already have supports; don't duplicate them.
      if(segment>0 || i>0) addPost(start);
    }
  }
  return {spans,posts};
}

export async function createOpeningGuardrail(Cesium,viewer,site) {
  if(!guardrail.enabled || site!==guardrail.siteId) return null;
  const source=new Cesium.CustomDataSource(guardrail.id);
  source.show=false;
  await viewer.dataSources.add(source);
  const frame=Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(...guardrail.origin));
  const position=p=>Cesium.Matrix4.multiplyByPoint(frame,new Cesium.Cartesian3(...p),new Cesium.Cartesian3());
  const orientation=angle=>{
    const rotation=Cesium.Matrix3.fromRotationZ(angle);
    const transform=Cesium.Matrix4.multiply(frame,Cesium.Matrix4.fromRotationTranslation(rotation),new Cesium.Matrix4());
    return Cesium.Quaternion.fromRotationMatrix(Cesium.Matrix4.getMatrix3(transform,new Cesium.Matrix3()));
  };
  const glass=Cesium.Color.fromCssColorString('#c9e6eb').withAlpha(.22);
  const silver=Cesium.Color.fromCssColorString('#aebfc4');
  let index=0;
  const box=(kind,p,width,depth,height,angle,material)=>source.entities.add({
    id:`${guardrail.id}:${kind}:${index++}`,name:'3층 개구부 유리난간',
    properties:{facilityAssetId:guardrail.id,floor:guardrail.floor,component:kind,source:'user-annotated-opening-edge',surveyed:false},
    position:position(p),orientation:orientation(angle),
    box:{dimensions:new Cesium.Cartesian3(width,depth,height),material,shadows:Cesium.ShadowMode.DISABLED},
  });
  const plan=openingGuardrailPlan();
  for(const span of plan.spans) {
    const middle=span.start.map((v,i)=>(v+span.end[i])/2);
    const base=middle[2];
    const glassHeight=guardrail.height-guardrail.glassBottomGap-.045;
    box('glass',[middle[0],middle[1],base+guardrail.glassBottomGap+glassHeight/2],
      Math.max(.02,span.length-guardrail.postWidth),guardrail.glassThickness,glassHeight,span.angle,glass);
    box('handrail',[middle[0],middle[1],base+guardrail.height-.0225],
      span.length,guardrail.capWidth,.045,span.angle,silver);
    box('bottom-rail',[middle[0],middle[1],base+.055],span.length,.038,.035,span.angle,silver);
  }
  for(const p of plan.posts) box('post',[p[0],p[1],p[2]+guardrail.height/2],
    guardrail.postWidth,guardrail.postWidth,guardrail.height,0,silver);
  let disposed=false;
  return {source,setVisible(visible){source.show=Boolean(visible);viewer.scene.requestRender();},
    destroy(){if(disposed)return;disposed=true;viewer.dataSources.remove(source,true);}};
}

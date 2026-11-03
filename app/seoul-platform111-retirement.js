import mask from './seoul-platform111-retirement.json' with {type:'json'};
import config from './seoul-platform111.json' with {type:'json'};
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function platform111TriangleBins(){
  const count=Math.ceil(mask.broadPhaseBounds.max[0]-mask.broadPhaseBounds.min[0]);
  const bins=Array.from({length:count},()=>[]);
  mask.triangles.forEach((t,i)=>{
    const lo=Math.max(0,Math.floor(Math.min(...t.points.map(p=>p[0]))-.003-mask.broadPhaseBounds.min[0]));
    const hi=Math.min(count-1,Math.floor(Math.max(...t.points.map(p=>p[0]))+.003-mask.broadPhaseBounds.min[0]));
    for(let b=lo;b<=hi;b++)bins[b].push(i);
  });
  const width=Math.ceil((Math.max(...bins.map(b=>b.length))+4)/4),data=new Float32Array(width*count*4);
  bins.forEach((b,i)=>{data[i*width*4]=b.length;data.set(b,i*width*4+4);});
  return {bins,width,height:count,data};
}

export function platform111TriangleTable(){
  const data=new Float32Array(mask.triangles.length*24);
  mask.triangles.forEach((t,i)=>{
    const [a,b,c]=t.points,x=sub(b,a),y=sub(c,a),n=cross(x,y),xx=dot(x,x),yy=dot(y,y),xy=dot(x,y),den=xx*yy-xy*xy;
    const u=x.map((v,k)=>(yy*v-xy*y[k])/den),v=y.map((v,k)=>(xx*v-xy*x[k])/den);
    data.set([...a,t.uv[0][0],...n.map(v=>v/Math.hypot(...n)),t.uv[0][1],...u,t.uv[1][0],...v,t.uv[1][1],...t.uv[2],0,0,
      Math.min(...t.uv.map(v=>v[0]))-1e-5,Math.min(...t.uv.map(v=>v[1]))-1e-5,Math.max(...t.uv.map(v=>v[0]))+1e-5,Math.max(...t.uv.map(v=>v[1]))+1e-5],i*24);
  });return data;
}
export function platform111RetirementUniforms(C){const bins=platform111TriangleBins();return {
  u_platform111Bins:{type:C.UniformType.SAMPLER_2D,value:new C.TextureUniform({typedArray:bins.data,width:bins.width,height:bins.height,
    pixelFormat:C.PixelFormat.RGBA,pixelDatatype:C.PixelDatatype.FLOAT,repeat:false,minificationFilter:C.TextureMinificationFilter.NEAREST,magnificationFilter:C.TextureMagnificationFilter.NEAREST})},
  u_platform111Triangles:{type:C.UniformType.SAMPLER_2D,value:new C.TextureUniform({typedArray:platform111TriangleTable(),width:6,height:mask.triangles.length,
    pixelFormat:C.PixelFormat.RGBA,pixelDatatype:C.PixelDatatype.FLOAT,repeat:false,minificationFilter:C.TextureMinificationFilter.NEAREST,magnificationFilter:C.TextureMagnificationFilter.NEAREST})}
};}

export function isRetiredPlatform111Replacement(replacement) {
  return Boolean(config.enabled && mask.enabled && replacement?.slot?.site_id === mask.siteId
    && mask.retiredSlotKeys?.includes(replacement.slot_key));
}

// F02FC085 is shared by disconnected facilities. Hide only reviewed C162 and
// Entrance 1 C92, plus its separate FC093 screen, in both source LODs.
export function platform111RetirementShaderDeclarations(){
  if(!config.enabled || !mask.enabled)return 'bool isRetiredPlatform111(vec3 p,vec2 uv){return false;}';
  const v=a=>`vec3(${a.map(n=>n.toFixed(10)).join(',')})`;
  // Coefficients live in a tiny float data texture, not inlined expressions.
  // A uniform loop bound avoids costly shader expansion on WebGL/ANGLE.
  return `bool isRetiredPlatform111(vec3 p,vec2 uv){
    if(any(lessThan(p,${v(mask.broadPhaseBounds.min)})) || any(greaterThan(p,${v(mask.broadPhaseBounds.max)})))return false;
    int bin=clamp(int(floor(p.x-(${mask.broadPhaseBounds.min[0].toFixed(10)}))),0,${platform111TriangleBins().height-1});
    int count=int(texelFetch(u_platform111Bins,ivec2(0,bin),0).x+0.5);
    for(int j=0;j<count;j++){
      int k=j+4;vec4 entries=texelFetch(u_platform111Bins,ivec2(k/4,bin),0);int i=int(entries[k%4]+0.5);
      vec4 bounds=texelFetch(u_platform111Triangles,ivec2(5,i),0);
      if(any(lessThan(uv,bounds.xy)) || any(greaterThan(uv,bounds.zw)))continue;
      vec4 a=texelFetch(u_platform111Triangles,ivec2(0,i),0),n=texelFetch(u_platform111Triangles,ivec2(1,i),0);
      vec3 q=p-a.xyz;if(abs(dot(q,n.xyz))>0.002)continue;
      vec4 x=texelFetch(u_platform111Triangles,ivec2(2,i),0),y=texelFetch(u_platform111Triangles,ivec2(3,i),0);
      float u=dot(q,x.xyz),v=dot(q,y.xyz);
      if(!(u>=-0.0000001 && v>=-0.0000001 && u+v<=1.0000001))continue;
      vec2 uv0=vec2(a.w,n.w),uv1=vec2(x.w,y.w),uv2=texelFetch(u_platform111Triangles,ivec2(4,i),0).xy;
      if(all(lessThanEqual(abs(uv-(uv0+u*(uv1-uv0)+v*(uv2-uv0))),vec2(0.00001))))return true;
    }
    return false;
  }`;
}

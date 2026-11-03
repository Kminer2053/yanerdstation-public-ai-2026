// Data-driven equivalent of the reviewed position AND atlas-UV tests. Hundreds
// of inlined calls exhausted the WebGL/ANGLE compiler on multi-floor models.
// Keep coefficients in one nearest-sampled float texture, as Platform111 does.
const dot = (a,b) => a.reduce((s,x,i)=>s+x*b[i],0);
const sub = (a,b) => a.map((x,i)=>x-b[i]);
export function createRetirementTriangleTable() {
  const rows = [];
  return {
    checks(triangles, tolerance = [0.002, 0.0000001, 0.00001]) {
      const header = rows.length;
      rows.push([triangles.length, ...tolerance, ...Array(16).fill(0)]);
      for (const t of triangles) {
        const [a,b,c]=t.points, x=sub(b,a), y=sub(c,a);
        const n=[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]];
        const xx=dot(x,x), yy=dot(y,y), xy=dot(x,y), den=xx*yy-xy*xy;
        if(den<1e-15) throw new Error('Degenerate retirement triangle');
        const u=x.map((v,i)=>(yy*v-xy*y[i])/den), v=y.map((v,i)=>(xx*v-xy*x[i])/den);
        rows.push([...a,t.uv[0][0],...n.map(v=>v/Math.hypot(...n)),t.uv[0][1],
          ...u,t.uv[1][0],...v,t.uv[1][1],...t.uv[2],0,0]);
      }
      return `insideRetirementTable(p, rawUv, ${header})`;
    },
    get data() { return new Float32Array(rows.flat()); },
    uniforms(C) {
      return {u_retirementTriangles:{type:C.UniformType.SAMPLER_2D,
        value:new C.TextureUniform({typedArray:this.data,width:5,height:rows.length,
          pixelFormat:C.PixelFormat.RGBA,pixelDatatype:C.PixelDatatype.FLOAT,repeat:false,
          minificationFilter:C.TextureMinificationFilter.NEAREST,
          magnificationFilter:C.TextureMagnificationFilter.NEAREST})}};
    },
    declarations: `
      bool insideRetirementTable(vec3 p, vec2 rawUv, int header) {
        vec4 settings=texelFetch(u_retirementTriangles,ivec2(0,header),0);
        int count=int(settings.x+0.5);
        for(int j=0;j<count;j++) {
          int row=header+1+j;
          vec4 a=texelFetch(u_retirementTriangles,ivec2(0,row),0);
          vec4 n=texelFetch(u_retirementTriangles,ivec2(1,row),0);
          vec3 q=p-a.xyz;
          if(abs(dot(q,n.xyz))>settings.y) continue;
          vec4 x=texelFetch(u_retirementTriangles,ivec2(2,row),0);
          vec4 y=texelFetch(u_retirementTriangles,ivec2(3,row),0);
          float u=dot(q,x.xyz),v=dot(q,y.xyz);
          if(!(u>=-settings.z && v>=-settings.z && u+v<=1.0+settings.z)) continue;
          vec2 uv0=vec2(a.w,n.w),uv1=vec2(x.w,y.w);
          vec2 uv2=texelFetch(u_retirementTriangles,ivec2(4,row),0).xy;
          if(all(lessThanEqual(abs(rawUv-(uv0+u*(uv1-uv0)+v*(uv2-uv0))),vec2(settings.w)))) return true;
        }
        return false;
      }`,
  };
}

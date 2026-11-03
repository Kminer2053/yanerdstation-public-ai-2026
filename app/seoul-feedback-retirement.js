import reviewed from './seoul-feedback-retirement.json' with { type: 'json' };

// User-reviewed 2026-09-14 retirement. Source GLBs and other slots stay intact.
// Removing this isolated layer restores the old render; no source is deleted.
export const FEEDBACK_RETIREMENT = reviewed;
export function feedbackRetirementStyleConditions(site) {
  if (site !== reviewed.siteId) return [];
  return reviewed.wholeObjects.map(o => [`\${FLOOR} === '${o.floor}' && \${TD_ID} === '${o.tdId}'`, false]);
}
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const vec=v=>`vec3(${v.map(x=>x.toFixed(10)).join(', ')})`;
const vec2=v=>`vec2(${v.map(x=>x.toFixed(10)).join(', ')})`;
function coefficients([a,b,c]) {
  const x=sub(b,a),y=sub(c,a),n=cross(x,y),xx=dot(x,x),yy=dot(y,y),xy=dot(x,y),den=xx*yy-xy*xy;
  if(den<1e-15)throw new Error('Degenerate retirement triangle');
  return [a,n.map(v=>v/Math.hypot(...n)),x.map((v,i)=>(yy*v-xy*y[i])/den),y.map((v,i)=>(xx*v-xy*x[i])/den)];
}
export function retirementTriangleShaderChecks(triangles) {
  return triangles.map(t=>`insideReviewedFacadeTriangle(p, rawUv, ${coefficients(t.points).map(vec).join(', ')}, ${t.uv.map(vec2).join(', ')})`).join(' ||\n        ') || 'false';
}
export function feedbackRetirementShaderDeclarations(triangleChecks = retirementTriangleShaderChecks) {
  // Position alone also catches adjacent, nearly coplanar preserved faces.
  // Match their original interpolated atlas UVs too, including both source LODs.
  const checks=triangleChecks(reviewed.triangles);
  return `
  bool insideReviewedFacadeTriangle(vec3 p, vec2 rawUv, vec3 origin, vec3 normal, vec3 dualU, vec3 dualV, vec2 uv0, vec2 uv1, vec2 uv2) {
    vec3 q = p - origin;
    if (abs(dot(q, normal)) > 0.002) return false;
    float u = dot(q, dualU); float v = dot(q, dualV);
    if (!(u >= -0.0000001 && v >= -0.0000001 && u + v <= 1.0000001)) return false;
    vec2 expectedUv = uv0 + u * (uv1 - uv0) + v * (uv2 - uv0);
    return all(lessThanEqual(abs(rawUv - expectedUv), vec2(0.00001)));
  }
  bool isReviewedFacadeRetirementPoint(vec3 p, vec2 rawUv) {
    return ${checks};
  }`;
}

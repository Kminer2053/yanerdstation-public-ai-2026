import retirement from './seoul-lounge-sign-retirement.json' with {type:'json'};
import {retirementTriangleShaderChecks} from './seoul-feedback-retirement.js';
export const LOUNGE_SIGN_RETIREMENT=retirement;

// This feature contains exactly the two selected bodies in both LODs.
// Hide bodies at feature level to avoid subpixel silhouette remnants.
export function loungeSignRetirementStyleConditions(site){
  if(!retirement.enabled || site!==retirement.siteId) return [];
  return [["${FLOOR} === '3F' && ${MODEL_NAME} === 'F03FC005' && ${TD_ID} === 'b00540045882300332205328000'",false]];
}

// F03FC036 is a shared screen atlas: retire the two marked physical screens,
// never the full feature, atlas or shared approval slot.
export function loungeSignRetirementShaderDeclarations(triangleChecks = retirementTriangleShaderChecks){
  if(!retirement.enabled) return 'bool isRetiredLoungeSign(vec3 p, vec2 rawUv) { return false; }';
  const vector=values=>`vec3(${values.map(value=>value.toFixed(10)).join(', ')})`;
  return `
  bool insideLoungeSignTriangle(vec3 p, vec2 rawUv, vec3 origin, vec3 normal, vec3 dualU, vec3 dualV, vec2 uv0, vec2 uv1, vec2 uv2) {
    vec3 q=p-origin;
    if(abs(dot(q,normal))>0.003) return false;
    float u=dot(q,dualU); float v=dot(q,dualV);
    if(u < -0.0002 || v < -0.0002 || u+v > 1.0002) return false;
    vec2 expectedUv=uv0+u*(uv1-uv0)+v*(uv2-uv0);
    return all(lessThanEqual(abs(rawUv-expectedUv),vec2(0.00002)));
  }
  bool isRetiredLoungeSign(vec3 p, vec2 rawUv) {
    if(any(lessThan(p,${vector(retirement.broadPhaseBounds.min)})) || any(greaterThan(p,${vector(retirement.broadPhaseBounds.max)}))) return false;
    return ${triangleChecks(retirement.triangles.filter(t=>t.model==='F03FC036'), [0.003, 0.0002, 0.00002]).replaceAll('insideReviewedFacadeTriangle','insideLoungeSignTriangle')};
  }`;
}
export function isRetiredLoungeSignBodySlot(slot){
  return retirement.enabled && slot?.site_id===retirement.siteId
    && slot.slot_alias===retirement.bodySlotAlias && slot.slot_key===retirement.bodySlotKey;
}

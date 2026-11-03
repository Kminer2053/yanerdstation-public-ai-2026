import retirement from './seoul-photobooth-retirement.json' with {type:'json'};
import {retirementTriangleShaderChecks} from './seoul-feedback-retirement.js';
export const PHOTOBOOTH_CHARGER_RETIREMENT=retirement;

// F03FC036-S01 is shared. Retire only this physical charger's 12 faces in
// each LOD; do not hide the model/feature, its other devices or catalog slot.
export function photoboothChargerRetirementShaderDeclarations(triangleChecks = retirementTriangleShaderChecks){
  if(!retirement.enabled) return 'bool isRetiredPhotoboothCharger(vec3 p, vec2 rawUv) { return false; }';
  const vector=values=>`vec3(${values.map(value=>value.toFixed(10)).join(', ')})`;
  return `
  bool insidePhotoboothChargerTriangle(vec3 p, vec2 rawUv, vec3 origin, vec3 normal, vec3 dualU, vec3 dualV, vec2 uv0, vec2 uv1, vec2 uv2) {
    vec3 q=p-origin;
    if(abs(dot(q,normal))>0.003) return false;
    float u=dot(q,dualU); float v=dot(q,dualV);
    if(u < -0.0002 || v < -0.0002 || u+v > 1.0002) return false;
    vec2 expectedUv=uv0+u*(uv1-uv0)+v*(uv2-uv0);
    return all(lessThanEqual(abs(rawUv-expectedUv),vec2(0.00002)));
  }
  bool isRetiredPhotoboothCharger(vec3 p, vec2 rawUv) {
    if(any(lessThan(p,${vector(retirement.broadPhaseBounds.min)})) || any(greaterThan(p,${vector(retirement.broadPhaseBounds.max)}))) return false;
    return ${triangleChecks(retirement.triangles, [0.003, 0.0002, 0.00002]).replaceAll('insideReviewedFacadeTriangle','insidePhotoboothChargerTriangle')};
  }`;
}

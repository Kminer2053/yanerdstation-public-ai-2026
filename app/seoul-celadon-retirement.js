import retirement from "./seoul-celadon-retirement.json" with { type: "json" };
import { retirementTriangleShaderChecks } from "./seoul-feedback-retirement.js";

// Reversible render-only retirement. The atlas/slot is shared by other kiosks:
// never deactivate F02FC086-S01 or hide its entire MODEL_NAME / TD_ID.
export const CELADON_RETIREMENT = retirement;
export function celadonRetirementShaderDeclarations(triangleChecks = retirementTriangleShaderChecks) {
  if (!retirement.enabled) return "bool isRetiredCeladonCase(vec3 p, vec2 rawUv) { return false; }";
  const vector = values => `vec3(${values.map(value => value.toFixed(10)).join(", ")})`;
  const bounds = retirement.cases.map(item => {
    const { min, max } = item.broadPhaseBounds;
    return `(all(greaterThanEqual(p, ${vector(min)})) && all(lessThanEqual(p, ${vector(max)})))`;
  }).join(" || ");
  return `
    bool isRetiredCeladonCase(vec3 p, vec2 rawUv) {
      if (!(${bounds})) return false;
      // The broad phase also intersects the Travel Center facade. Only the
      // original case triangles AND their interpolated atlas UVs may disappear.
      return ${triangleChecks(retirement.triangles)};
    }`;
}

import retirement from "./seoul-wood-display-retirement.json" with { type: "json" };
import { retirementTriangleShaderChecks } from "./seoul-feedback-retirement.js";

// One physical case only: F02FC086-S01 is shared by disconnected fixtures.
// Preserve source tiles and catalogue records; disable this mask to restore it.
export const WOOD_DISPLAY_RETIREMENT = retirement;
export function woodDisplayRetirementShaderDeclarations(triangleChecks = retirementTriangleShaderChecks) {
  if (!retirement.enabled) return "bool isRetiredWoodDisplay(vec3 p, vec2 rawUv) { return false; }";
  const vector = values => `vec3(${values.map(value => value.toFixed(10)).join(", ")})`;
  const { min, max } = retirement.broadPhaseBounds;
  return `
    bool isRetiredWoodDisplay(vec3 p, vec2 rawUv) {
      if (any(lessThan(p, ${vector(min)})) || any(greaterThan(p, ${vector(max)}))) return false;
      return ${triangleChecks(retirement.triangles)};
    }`;
}

import retirement from "./seoul-s38-retirement.json" with { type: "json" };
import { retirementTriangleShaderChecks } from "./seoul-feedback-retirement.js";

// The FLOWER booth is only one part of the station-wide F02WL072 model.
// Preserve the original tiles and catalogue; disable this record to restore it.
export const S38_RETIREMENT = retirement;
export function isRetiredS38Slot(slot) {
  return retirement.enabled && slot?.site_id === retirement.siteId
    && retirement.slotAliases.includes(slot.slot_alias);
}

export function s38RetirementShaderDeclarations(triangleChecks = retirementTriangleShaderChecks) {
  if (!retirement.enabled) return "bool isRetiredS38Booth(vec3 p, vec2 rawUv) { return false; }";
  const vector = values => `vec3(${values.map(value => value.toFixed(10)).join(", ")})`;
  const { min, max } = retirement.broadPhaseBounds;
  return `
    bool isRetiredS38Booth(vec3 p, vec2 rawUv) {
      if (any(lessThan(p, ${vector(min)})) || any(greaterThan(p, ${vector(max)}))) return false;
      return ${triangleChecks(retirement.triangles)};
    }`;
}

import retirement from "./seoul-pergola-retirement.json" with { type: "json" };

// Full source audit: both LOD features contain only this one physical fixture.
// Match feature metadata rather than a box, which would overlap F02PL004.
export const PERGOLA_RETIREMENT = retirement;
export function pergolaRetirementStyleConditions(site) {
  if (!retirement.enabled || site !== retirement.siteId) return [];
  return [[`\${FLOOR} === '${retirement.floor}' && \${MODEL_NAME} === '${retirement.model}' && \${TD_ID} === '${retirement.tdId}'`, false]];
}
export function isRetiredPergolaSlot(slot) {
  return retirement.enabled && slot?.site_id === retirement.siteId
    && slot.slot_alias === retirement.slotAlias && slot.slot_key === retirement.slotKey;
}

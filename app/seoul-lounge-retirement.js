import retirement from "./seoul-lounge-retirement.json" with { type: "json" };

// Both source LODs contain one connected lounge only. Its own roof/base are
// included; the station floor, columns and independent equipment are not.
export const LOUNGE_RETIREMENT = retirement;
export function loungeRetirementStyleConditions(site) {
  if (!retirement.enabled || site !== retirement.siteId) return [];
  return [[`\${FLOOR} === '${retirement.floor}' && \${MODEL_NAME} === '${retirement.model}' && \${TD_ID} === '${retirement.tdId}'`, false]];
}

export function isRetiredLoungeSlot(slot) {
  return retirement.enabled && slot?.site_id === retirement.siteId
    && retirement.slots.some(({slotAlias, slotKey}) =>
      slot.slot_alias === slotAlias && slot.slot_key === slotKey);
}

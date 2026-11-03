import retirement from './seoul-dessert-banner-retirement.json' with { type: 'json' };

// B03FC015 is shared by signs throughout B3. Only the four physical banners
// in front of B03WL011-S01 are retired; the source and catalog stay restorable.
export const DESSERT_BANNER_RETIREMENT = retirement;
export function dessertBannerRetirementShaderDeclarations() {
  if (!retirement.enabled) return 'bool isRetiredDessertBanner(vec3 p, vec2 rawUv) { return false; }';
  const vector = values => `vec3(${values.map(value => value.toFixed(10)).join(', ')})`;
  // Four tightly bounded boxes include the panels, backs and supports. The
  // audit checks exact triangle/box intersections across both LODs/all floors;
  // no preserved geometry intersects them. Avoid hundreds of shader clauses.
  const checks = retirement.banners.map(({broadPhaseBounds:{min,max}}) =>
    `(all(greaterThanEqual(p, ${vector(min)})) && all(lessThanEqual(p, ${vector(max)})))`);
  return `
    bool isRetiredDessertBanner(vec3 p, vec2 rawUv) {
      return ${checks.join(' || ')};
    }`;
}

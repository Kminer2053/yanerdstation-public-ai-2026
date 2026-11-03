export const REVIEW_FLOORS = ['B7','B6','B3','B2','B1','1F','2F','3F','4F','RF'];
export function initialReviewTab(view,isDestination) {
  return ['routes','locations','nodes','destinations'].includes(view)?view:isDestination?'destinations':'routes';
}
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const numberOrNull = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);

export function locationPoint(row) {
  return { ...row, review_id: row.locator_id, label: row.detail_location,
    floor: row.source_floor, source_ids: row.native_source_ids,
    source_floor_reference_z: row.source_floor_z,
    required_check: row.notes.join(' / '), source_basis: row.coord_source };
}

export function makeFocus(point) {
  const longitude = numberOrNull(point?.lon), latitude = numberOrNull(point?.lat);
  if (longitude === null || latitude === null || longitude < 126.95 || longitude > 126.99 || latitude < 37.53 || latitude > 37.58) return null;
  const actualFloor = REVIEW_FLOORS.includes(point.floor);
  const heights = [point.model_walk_ground_z, point.source_gate_z, point.source_poi_z, point.source_floor_reference_z];
  const suppliedHeight = heights.map(numberOrNull).find(v => v !== null);
  const referenceOnly = !actualFloor || suppliedHeight === undefined;
  if(point.catalog_focus && !referenceOnly) return {...point.catalog_focus,
    floor:point.floor,longitude,latitude,height:suppliedHeight,imageId:point.review_id,
    label:point.label,referenceOnly:false,catalog:true};
  return { floor: actualFloor ? point.floor : '2F', longitude, latitude,
    height: suppliedHeight ?? 38.1, imageId: point.review_id,
    label: `${point.label}${referenceOnly ? ' · 주변 참고(층·높이 미확인)' : ' · 검토 후보'}`,
    sourceKind: referenceOnly ? 'route_review_reference' : 'route_review', referenceOnly };
}

export function pointUrl(point, origin) {
  const focus = makeFocus(point);
  if (!focus) return null;
  const url = new URL('/app/', origin);
  const params = { site:'S202103', embed:'catalog', catalogFocus:'1', floor:focus.floor,
    lon:focus.longitude, lat:focus.latitude, height:focus.height,
    imageId:focus.imageId, label:focus.label, sourceKind:focus.sourceKind };
  for (const [key,value] of Object.entries(params)) url.searchParams.set(key, value);
  if(focus.catalog)for(const key of ['model','tdId','targetAssetId','targetSurfaceId','cameraHeading','surfaceWidth','surfaceHeight','surfaceArea','cropWidth','cropHeight']){
    if(focus[key]!==null&&focus[key]!==undefined&&focus[key]!=='')url.searchParams.set(key,focus[key]);
  }
  return url.href;
}

export function filterDestinations(items,{query='',category='',floor='',kind=''}={}) {
  const q=query.trim().toLocaleLowerCase();
  return items.filter(item=>(!category||item.category===category)&&(!floor||item.floor===floor)
    &&(!kind||item.kind===kind)&&(!q||[item.label,item.category,item.floor,item.id,
      ...item.points.flatMap(p=>[p.review_id,p.label,...p.source_ids])].join(' ').toLocaleLowerCase().includes(q)));
}

// A text mention is a reference to inspect, not a generated segment or selected gate.
export function mentionedNodes(text, nodes) {
  return nodes.filter(n => {
    const escaped = n.review_id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![A-Z0-9-])${escaped}(?![A-Z0-9-])`).test(text);
  });
}

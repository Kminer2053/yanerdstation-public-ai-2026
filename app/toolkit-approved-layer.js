// Administrator-approved changes only. Unapproved report drafts never enter this public layer.
export function toolkitMapData(data, siteId, origin) {
  const image = url => new URL(url, origin).href;
  return {
    assets: (data.assets || []).filter(a => a.proposal && !a.hidden).map(a => ({...a, facades: Object.fromEntries(Object.entries(a.facades || {}).map(([side, url]) => [side, image(url)]))})),
    replacements: (data.overlays || []).filter(o => Array.isArray(o.position) && Array.isArray(o.surface)).map(o => ({
      id: 'toolkit:' + o.alias + ':' + (o.at || ''), slot_key: o.alias, image_url: image(o.image),
      replacement_width_px: o.px?.[0] ?? null, replacement_height_px: o.px?.[1] ?? null,
      current_store_name: o.name, review_status: 'approved', is_active: true, toolkit_approved: true,
      slot: {site_id: siteId, slot_alias: o.alias, object_label: o.name, floor: o.floor,
        longitude: o.position[0], latitude: o.position[1], height_m: o.position[2],
        camera_heading_deg: o.heading, surface_width_m: o.surface[0], surface_height_m: o.surface[1],
        crop_width_px: o.px?.[0] ?? null, crop_height_px: o.px?.[1] ?? null},
    })),
  };
}

export function mergeApprovedReplacements(base, updates) {
  const merged = new Map(base.map(r => [r.slot?.slot_alias || r.slot_key, {...r}]));
  for (const update of updates) {
    const alias = update.slot.slot_alias, previous = merged.get(alias);
    // Preserve reviewed mesh surfaces, special-asset routing and hashed slot IDs.
    merged.set(alias, previous ? {...previous, ...update, slot_key: previous.slot_key, slot: {...previous.slot}} : update);
  }
  return [...merged.values()];
}

export function assetFacePositions(asset, side) {
  const [w,d] = asset.size, p = asset.position;
  const sides = {front:[[-w/2,-d/2-.03],[w/2,-d/2-.03]],right:[[w/2+.03,-d/2],[w/2+.03,d/2]],back:[[w/2,d/2+.03],[-w/2,d/2+.03]],left:[[-w/2-.03,d/2],[-w/2-.03,-d/2]]};
  const angle = -asset.heading * Math.PI/180;
  return (sides[side] || []).map(([x,y]) => [p[0]+(x*Math.cos(angle)-y*Math.sin(angle))/(111320*Math.cos(p[1]*Math.PI/180)),p[1]+(x*Math.sin(angle)+y*Math.cos(angle))/111320,p[2]]);
}

export function addAssetEntities(C, entities, asset, {preview=false}={}) {
  const p = asset.position, h = asset.size[2], pos = q => C.Cartesian3.fromDegrees(...q);
  const props = {floor:asset.floor,approvedProposal:asset.proposal || '',toolkit:{kind:'assets',id:asset.id}};
  entities.add({id:(preview?'draft:':'approved:')+asset.id,position:pos([p[0],p[1],p[2]+h/2]),
    orientation:C.Transforms.headingPitchRollQuaternion(pos(p),new C.HeadingPitchRoll(C.Math.toRadians(asset.heading),0,0)),
    box:{dimensions:new C.Cartesian3(...asset.size),material:C.Color.fromCssColorString(asset.color).withAlpha(asset.source_record ? .3 : 1)},
    properties:props,label:{text:asset.name+(preview?' · 임시':''),font:'12px sans-serif',showBackground:true,distanceDisplayCondition:new C.DistanceDisplayCondition(0,100)}});
  for (const [side,image] of Object.entries(asset.facades || {})) {
    const points=assetFacePositions(asset,side);if(points.length!==2)continue;
    entities.add({id:(preview?'draft:':'approved:')+asset.id+':'+side,properties:props,wall:{positions:points.map(pos),minimumHeights:[p[2],p[2]],maximumHeights:[p[2]+h,p[2]+h],material:new C.ImageMaterialProperty({image,transparent:false})}});
  }
}

import {
  INFORMATION_FACILITIES, INFORMATION_ZONE, informationZoneAxes,
  informationFacilitySurfaceCenter,
} from "../app/seoul-information-zone.js";

// WGS84 conversion for the same ENU origin used by Cesium in the viewer.
export function catalogPointGeodetic([east, north, up]) {
  const [lonD, latD, height] = INFORMATION_ZONE.origin;
  const lon = lonD * Math.PI / 180, lat = latD * Math.PI / 180;
  const a = 6378137, e2 = 6.6943799901413165e-3;
  const n = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  const x = (n + height) * Math.cos(lat) * Math.cos(lon)
    - Math.sin(lon) * east - Math.sin(lat) * Math.cos(lon) * north + Math.cos(lat) * Math.cos(lon) * up;
  const y = (n + height) * Math.cos(lat) * Math.sin(lon)
    + Math.cos(lon) * east - Math.sin(lat) * Math.sin(lon) * north + Math.cos(lat) * Math.sin(lon) * up;
  const z = (n * (1 - e2) + height) * Math.sin(lat) + Math.cos(lat) * north + Math.sin(lat) * up;
  const p = Math.hypot(x, y);
  let phi = Math.atan2(z, p * (1 - e2));
  for (let i = 0; i < 8; i++) {
    const radius = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
    phi = Math.atan2(z + e2 * radius * Math.sin(phi), p);
  }
  const radius = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  return [Math.atan2(y, x) * 180 / Math.PI, phi * 180 / Math.PI, p / Math.cos(phi) - radius];
}

export const INFORMATION_SLOT_CONTRACTS = INFORMATION_FACILITIES.map(asset => {
  const [east_m, north_m, up_m] = informationFacilitySurfaceCenter(asset);
  const [longitude, latitude, height_m] = catalogPointGeodetic([east_m, north_m, up_m]);
  const camera_heading_deg = (360 - informationZoneAxes().angle * 180 / Math.PI) % 360;
  const placement = {
    placement_id: asset.surface.id, target_surface_id: asset.surface.id, is_primary: true,
    render_kind: "app_asset_wall", longitude, latitude, height_m, east_m, north_m, up_m,
    camera_heading_deg, surface_width_m: asset.surface.width, surface_height_m: asset.surface.height,
    texture_coordinates: [[0, 0], [1, 0], [1, 1], [0, 1]],
  };
  return {
    slot_key: asset.slotKey, slot_alias: asset.slotAlias, target_asset_id: asset.id,
    target_surface_id: asset.surface.id, pixel_width: asset.surface.pixelWidth, pixel_height: asset.surface.pixelHeight,
    ...placement, surface_placements: [placement],
    source_region_signature: `S04-IMG_6176-${asset.surface.id}-20260914`,
  };
});

export const INFORMATION_RETIRED_SLOT_KEYS = [
  "656d96e60c67c90ce0e8f94036508054ba6a0ee0cd4438901c549e6aa2e01ae0",
  "d2ad0be71b735d6eda431336d165fec4e21427236c6ccd7422e0d5105998214c",
  "4c60ff5396e74667c17c7dbb7fe75856013dcbcaf3f63dbf32765b9e02223001",
];
export const TRUEDAN_SLOT_KEY = "7afba516acfae10344297172e7c5c80368d4d3d43b140a71a14ccedc208852bc";

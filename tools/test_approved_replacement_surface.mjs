import assert from "node:assert/strict";
import { createCoplanarReplacementPrimitives } from "../app/approved-replacement-surface.js";
import {
  coplanarSurfaceWindingAlignment,
  isCoplanarSurfacePlacement,
  legacyReplacementCropStyle,
  matchingLegacyReplacementCrop,
} from "../src/replacement-surface-contract.js";

const placement = {
  placement_id: "inclined-sign",
  is_primary: true,
  render_kind: "coplanar_polygon",
  longitude: 126.9715,
  latitude: 37.5541,
  height_m: 39.0813,
  camera_heading_deg: 330.29329547,
  surface_width_m: 10.60067322,
  surface_height_m: 1.3472132,
  normal_enu: [-0.45983556740656595, 0.8059584185423447, -0.3728032705444044],
  corners_wgs84: [
    [126.97155418, 37.55407906, 39.70628804],
    [126.97155714, 37.55407512, 38.45628149],
    [126.97145277, 37.55402779, 38.45632269],
    [126.97145015, 37.55403173, 39.70635074],
  ],
  texture_coordinates: [[1, 1], [1, 0], [0, 0], [0, 1]],
};
assert(isCoplanarSurfacePlacement(placement));
assert(coplanarSurfaceWindingAlignment(placement) > .999, "the inclined quad must face along its outward normal");
assert(!isCoplanarSurfacePlacement({ ...placement, normal_enu: [1, 1, 1] }));
assert(!isCoplanarSurfacePlacement({ ...placement, texture_coordinates: [[0, 1]] }));
assert(!isCoplanarSurfacePlacement({
  ...placement,
  corners_wgs84: [...placement.corners_wgs84].reverse(),
  texture_coordinates: [...placement.texture_coordinates].reverse(),
}), "an inward-wound quad must be rejected");

const cropPlacement = {
  legacy_replacement_crop: {
    source_width_px: 340, source_height_px: 86,
    left_px: 0, top_px: 0, width_px: 340, height_px: 67,
  },
};
const legacyVersion = { replacement_width_px: 340, replacement_height_px: 86 };
assert.deepEqual(
  matchingLegacyReplacementCrop({ surface_placements: [cropPlacement] }, legacyVersion),
  { sourceWidth: 340, sourceHeight: 86, left: 0, top: 0, width: 340, height: 67 },
);
assert.equal(matchingLegacyReplacementCrop(
  { surface_placements: [cropPlacement] },
  { replacement_width_px: 1934, replacement_height_px: 512 },
), null, "the correction must stop after a current-contract replacement is uploaded");
assert(legacyReplacementCropStyle({ surface_placements: [cropPlacement] }, legacyVersion).includes("height:128.3582089552239%"));

class Cartesian2 { constructor(x, y) { this.x = x; this.y = y; } }
class Cartesian3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  static fromDegrees(longitude, latitude, height) { return new Cartesian3(longitude, latitude, height); }
  static add(left, right, result) { result.x = left.x + right.x; result.y = left.y + right.y; result.z = left.z + right.z; return result; }
  static normalize(value, result) {
    const length = Math.hypot(value.x, value.y, value.z);
    result.x = value.x / length; result.y = value.y / length; result.z = value.z / length;
    return result;
  }
  static multiplyByScalar(value, scalar, result) {
    result.x = value.x * scalar; result.y = value.y * scalar; result.z = value.z * scalar;
    return result;
  }
}
class PolygonHierarchy { constructor(positions) { this.positions = positions; } }
class CoplanarPolygonGeometry { constructor(options) { Object.assign(this, options); } }
class GeometryInstance { constructor(options) { Object.assign(this, options); } }
class Primitive { constructor(options) { Object.assign(this, options); this.show = true; } }
class Entity { constructor(options) { Object.assign(this, options); } }
class PerInstanceColorAppearance {
  static FLAT_VERTEX_FORMAT = "flat";
  constructor(options) { Object.assign(this, options); }
}
class MaterialAppearance {
  static MaterialSupport = { TEXTURED: { vertexFormat: "textured" } };
  constructor(options) { Object.assign(this, options); }
}
const Cesium = {
  Cartesian2,
  Cartesian3,
  PolygonHierarchy,
  CoplanarPolygonGeometry,
  GeometryInstance,
  Primitive,
  Entity,
  PerInstanceColorAppearance,
  MaterialAppearance,
  Transforms: { eastNorthUpToFixedFrame() { return {}; } },
  Matrix4: {
    multiplyByPointAsVector(_frame, point, result) {
      result.x = point.x; result.y = point.y; result.z = point.z;
      return result;
    },
  },
  Color: { WHITE: "white", fromCssColorString(value) { return value; } },
  ColorGeometryInstanceAttribute: { fromColor(value) { return value; } },
  Material: { fromType(type, uniforms) { return { type, uniforms }; } },
};

const result = createCoplanarReplacementPrimitives(Cesium, {
  replacement: { id: "version", slot_key: "slot", image_url: "signed-url", render_image: "rectified-canvas" },
  slot: { slot_alias: "F02WL076-S01", floor: "2F", td_id: "td", source_kind: "vworld_uv" },
  placement,
  placementIndex: 0,
  placementCount: 1,
  maskOffset: .055,
  imageOffset: .065,
});
assert(result);
assert.equal(result.primitives.length, 2);
assert.equal(result.floor, "2F");
assert.equal(result.primitives[0].geometryInstances.geometry.vertexFormat, "flat");
assert.equal(result.primitives[1].geometryInstances.geometry.vertexFormat, "textured");
assert.deepEqual(
  result.primitives[1].geometryInstances.geometry.textureCoordinates.positions.map(({ x, y }) => [x, y]),
  placement.texture_coordinates,
);
assert.equal(result.primitives[1].appearance.material.uniforms.image, "rectified-canvas");
assert.equal(result.primitives[1].geometryInstances.id.properties.replacementSlot, "F02WL076-S01");
assert.equal(result.primitives[1].allowPicking, true);
assert.equal(createCoplanarReplacementPrimitives(Cesium, {
  replacement: { image_url: "signed-url" }, slot: {}, placement: { ...placement, corners_wgs84: [] },
  placementIndex: 0, placementCount: 1, maskOffset: .055, imageOffset: .065,
}), null);

console.log("Approved replacement surfaces: inclined quad geometry, explicit UVs, and legacy blank-band crop passed.");

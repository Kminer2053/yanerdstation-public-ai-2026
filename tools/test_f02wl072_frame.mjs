import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createF02wl072UpperFrame,
  F02WL072_FRAME,
  isF02wl072FrameReplacement,
} from "../app/f02wl072-frame.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedFaces = [234, 235, 240, 241, 244, 245, 246, 247, 250, 251, 252, 253];
const excludedLowerFaces = [254, 255, 258, 259];

assert.equal(F02WL072_FRAME.slotKey, "45021744d021f0f515143bb63e962060f8a91ed1287c05f13aeb128f9a3ea1cb");
assert.equal(F02WL072_FRAME.slotAlias, "F02WL072-FRAME-S01");
assert.equal(F02WL072_FRAME.targetAssetId, "SEOUL-2F-F02WL072");
assert.equal(F02WL072_FRAME.targetSurfaceId, "upper-sign-frame");
assert.deepEqual([F02WL072_FRAME.pixelWidth, F02WL072_FRAME.pixelHeight], [256, 256]);
assert.equal(F02WL072_FRAME.surfaces.length, 6);
assert.deepEqual(
  F02WL072_FRAME.surfaces.flatMap((surface) => surface.faces).sort((a, b) => a - b),
  expectedFaces,
);
assert.equal(F02WL072_FRAME.surfaces.filter((surface) => surface.part === "top").length, 2);
assert.equal(F02WL072_FRAME.surfaces.filter((surface) => surface.part === "left").length, 2);
assert.equal(F02WL072_FRAME.surfaces.filter((surface) => surface.part === "right").length, 2);
assert.equal(F02WL072_FRAME.surfaces.filter((surface) => surface.primary).length, 1);
assert(!F02WL072_FRAME.surfaces.some((surface) => surface.faces.some((face) => excludedLowerFaces.includes(face))));
assert(Math.abs(F02WL072_FRAME.surfaces.reduce((sum, surface) => sum + surface.area, 0) - 64.907132) < 1e-8);
for (const surface of F02WL072_FRAME.surfaces) {
  assert.equal(surface.corners.length, 4, `${surface.id} must remain an exact quad`);
  assert(Math.abs(Math.hypot(...surface.normalEnu) - 1) < 1e-5, `${surface.id} normal must be unit length`);
}

const validReplacement = {
  id: "approved-version",
  slot_key: F02WL072_FRAME.slotKey,
  image_url: "https://example.invalid/white.png",
  slot: {
    site_id: F02WL072_FRAME.site,
    source_kind: "app_asset",
    td_id: F02WL072_FRAME.tdId,
    target_asset_id: F02WL072_FRAME.targetAssetId,
    target_surface_id: F02WL072_FRAME.targetSurfaceId,
  },
};
assert(isF02wl072FrameReplacement(validReplacement));
assert(!isF02wl072FrameReplacement({ ...validReplacement, slot_key: "0".repeat(64) }));

class PrimitiveCollection {
  constructor() { this.values = []; this.show = true; }
  add(value) { this.values.push(value); return value; }
  removeAll() { this.values.length = 0; }
  remove(value) { const index = this.values.indexOf(value); if (index >= 0) this.values.splice(index, 1); }
}
class Cartesian3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  static fromDegrees(longitude, latitude, height) { return new Cartesian3(longitude, latitude, height); }
  static add(left, right, result) { result.x = left.x + right.x; result.y = left.y + right.y; result.z = left.z + right.z; return result; }
}
class GeometryInstance { constructor(options) { Object.assign(this, options); } }
class Primitive { constructor(options) { Object.assign(this, options); } }
class CoplanarPolygonGeometry { constructor(options) { Object.assign(this, options); } }
class PolygonHierarchy { constructor(positions) { this.positions = positions; } }
class PerInstanceColorAppearance {
  static FLAT_VERTEX_FORMAT = "flat";
  constructor(options) { Object.assign(this, options); }
}
class MaterialAppearance {
  static MaterialSupport = { TEXTURED: { vertexFormat: "textured" } };
  constructor(options) { Object.assign(this, options); }
}
const Cesium = {
  PrimitiveCollection,
  Cartesian3,
  Cartesian2: class Cartesian2 { constructor(x, y) { this.x = x; this.y = y; } },
  GeometryInstance,
  Primitive,
  CoplanarPolygonGeometry,
  PolygonHierarchy,
  PerInstanceColorAppearance,
  MaterialAppearance,
  Matrix4: {
    multiplyByPointAsVector(_matrix, point, result) { Object.assign(result, point); return result; },
  },
  Transforms: { eastNorthUpToFixedFrame() { return {}; } },
  Color: { WHITE: "white", fromCssColorString(value) { return value; } },
  ColorGeometryInstanceAttribute: { fromColor(value) { return value; } },
  Material: { fromType(type, uniforms) { return { type, uniforms }; } },
};
const rootPrimitives = new PrimitiveCollection();
let renderRequests = 0;
const viewer = { scene: { primitives: rootPrimitives, requestRender() { renderRequests += 1; } } };
const renderer = createF02wl072UpperFrame(Cesium, viewer, "S202103");
assert(renderer);
assert.equal(rootPrimitives.values.length, 1);
assert.equal(renderer.primitives.values.length, 0);
renderer.setReplacement(validReplacement);
assert.equal(renderer.primitives.values.length, 2, "mask and colour primitives must be created");
assert.equal(renderer.primitives.values[0].geometryInstances.length, 6);
assert.equal(renderer.primitives.values[1].geometryInstances.length, 6);
assert.equal(renderer.primitives.values[1].appearance.material.uniforms.image, validReplacement.image_url);
renderer.setVisible(false);
assert.equal(renderer.primitives.show, false);
renderer.setReplacement(null);
assert.equal(renderer.primitives.values.length, 0, "restore must remove all six applied panels");
assert(renderRequests >= 3);
renderer.destroy();
assert.equal(rootPrimitives.values.length, 0);
assert.equal(createF02wl072UpperFrame(Cesium, viewer, "S201801"), null);

const migration = await fs.readFile(path.join(root, "supabase/migrations/202609110001_f02wl072_upper_sign_frame.sql"), "utf8");
const app = await fs.readFile(path.join(root, "app/app.js"), "utf8");
const catalog = await fs.readFile(path.join(root, "src/catalog-workbench.js"), "utf8");
assert(migration.includes(F02WL072_FRAME.slotKey));
assert(migration.includes("'F02WL072-FRAME-S01'"));
assert(migration.includes("'upper-sign-frame'"));
assert(migration.includes("256,\n  256"));
assert(migration.includes("64.907132"));
assert(migration.includes('"render_kind":"coplanar_polygon"'));
assert(migration.includes("6,\n  6,\n  $placements$"));
assert(app.includes("createF02wl072UpperFrame(Cesium, viewer, VWORLD_CONFIG.siteId)"));
assert(app.includes("if (isF02wl072FrameReplacement(replacement)) continue"));
assert(app.includes("isF02wl072FrameCatalogFocus()"));
assert(catalog.includes("단색 컬러 샘플을 등록하세요"));
assert(catalog.includes("개 프레임 면 공동 적용"));

console.log("F02WL072 upper sign-frame: one colour slot, six exact panels, safe restore and dedicated routing passed.");

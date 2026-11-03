import assert from "node:assert/strict";
import fs from "node:fs";
import {
  INFORMATION_FACILITIES,
  INFORMATION_FACILITY_IDS,
  INFORMATION_ZONE,
  RETIRED_INFORMATION_SHOP_SLOTS,
  OBSOLETE_VWORLD_PRISMS,
  OBSOLETE_VWORLD_VOLUMES,
  STAIR_FRONT_SHOP_PRISM,
  createSeoulInformationZone,
  informationZoneAxes,
  informationZoneCatalogPoint,
  informationZoneShaderText,
  isInformationFacilityReplacement,
  isObsoleteVworldPoint,
  isStairFrontShopPoint,
} from "../app/seoul-information-zone.js";
import { TRUEDAN } from "../app/seoul-truedan.js";
import { seoulVworldRetirementShaderText } from "../app/seoul-vworld-retirement.js";

const close = (actual, expected, tolerance = 1e-8) => {
  assert(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
};

const { tangent, normal } = informationZoneAxes();
close(Math.hypot(...tangent), 1);
close(Math.hypot(...normal), 1);
close(tangent[0] * normal[0] + tangent[1] * normal[1], 0);
assert.deepEqual(informationZoneCatalogPoint(0, 0, 0), INFORMATION_ZONE.joint);
assert.equal(await createSeoulInformationZone(null, null, null, "S201801"), null, "Daejeon must remain unchanged");

assert.equal(INFORMATION_FACILITIES.length, 5);
assert.equal(new Set(INFORMATION_FACILITY_IDS).size, 5);
assert.equal(new Set(INFORMATION_FACILITIES.map((asset) => asset.slotKey)).size, 5);
assert.equal(INFORMATION_ZONE.targetModel, "F02WL054");
assert.equal(INFORMATION_ZONE.referenceFacadeSlot, "F02WL072-S04");
assert.deepEqual(INFORMATION_ZONE.referenceLogoSlots, ["F02WL072-S03", "F02WL072-S05"]);
assert.deepEqual(RETIRED_INFORMATION_SHOP_SLOTS, ["F02WL072-S03", "F02WL072-S04", "F02WL072-S05"]);
close(INFORMATION_ZONE.width, 7.986622404493558, 1e-9);
close(INFORMATION_ZONE.joint[0], -5.1958088534);
close(INFORMATION_ZONE.joint[1], -1.4853219892);
assert.notEqual(INFORMATION_ZONE.referenceFacadeSlot, TRUEDAN.referenceSlot, "the stair-front facade must not reuse the TRUEDAN reference slot");
const truedanSeparation = Math.hypot(
  TRUEDAN.joint[0] - INFORMATION_ZONE.joint[0],
  TRUEDAN.joint[1] - INFORMATION_ZONE.joint[1],
);
assert(truedanSeparation > 18 && truedanSeparation < 20, "S04 is about 19m west of the TRUEDAN reference corner, not the former 53m target");
assert.equal(INFORMATION_FACILITIES.filter((asset) => asset.type === "guide_board").length, 2);
assert.deepEqual(INFORMATION_FACILITIES.map((asset) => asset.type), [
  "information_booth",
  "train_departure_display",
  "guide_board",
  "guide_board",
  "information_tv",
]);

for (const asset of INFORMATION_FACILITIES) {
  assert.match(asset.id, /^SEOUL-2F-/);
  assert.match(asset.slotKey, /^[a-f0-9]{64}$/);
  assert(asset.surface.width > 0 && asset.surface.height > 0);
  assert(asset.x < 0 && asset.x > -INFORMATION_ZONE.width, `${asset.id} must be inside the stair-front shop frontage`);
  close(asset.surface.pixelWidth / asset.surface.pixelHeight, asset.surface.width / asset.surface.height, 0.005);
  const replacement = {
    slot_key: asset.slotKey,
    slot: { source_kind: "app_asset", target_asset_id: asset.id, target_surface_id: asset.surface.id },
  };
  assert(isInformationFacilityReplacement(replacement), `${asset.id} replacement must route to its renderer-owned surface`);
  assert(!isInformationFacilityReplacement({ ...replacement, slot_key: "0".repeat(64) }));
}
const [booth, tids, guide1, guide2, tv] = INFORMATION_FACILITIES;
assert(guide1.x > guide2.x && guide2.x > booth.x && booth.x > tv.x, "concourse order must be boards, booth, TV");
assert.equal(tids.x, booth.x, "train display must be centred over the information booth");
assert.deepEqual(STAIR_FRONT_SHOP_PRISM, {
  id: "stair-front-shop-f02wl072-s04",
  xMin: -8.04,
  xMax: 0.02,
  yMin: -3.89,
  yMax: 0.02,
  zMin: 9.025,
  zMax: 12.20,
});
const catalogPointAtLocalU = (x, y, up) => informationZoneCatalogPoint(
  x,
  y,
  up - INFORMATION_ZONE.joint[2],
);
assert(
  isStairFrontShopPoint(catalogPointAtLocalU(-3, -1.75, 10.6)),
  "the user-selected S04 facade must be retired with its connected shell",
);
assert(!isObsoleteVworldPoint(TRUEDAN.joint), "the information-zone retirement mask must preserve TRUEDAN");

assert.equal(OBSOLETE_VWORLD_PRISMS.length, 0, "S04 has no old TIDS: unrelated western display masks must not be translated here");
for (const prism of OBSOLETE_VWORLD_PRISMS) {
  const center = prism.min.map((value, index) => (value + prism.max[index]) / 2);
  assert(
    isObsoleteVworldPoint(catalogPointAtLocalU(center[0], center[1], center[2])),
    `${prism.id} must be retired inside its local prism`,
  );
}
for (const volume of OBSOLETE_VWORLD_VOLUMES) {
  const center = volume.min.map((value, index) => (value + volume.max[index]) / 2);
  assert(isObsoleteVworldPoint(center), `${volume.id} must be retired inside its bounded volume`);
}
for (const protectedPoint of [
  catalogPointAtLocalU(-3, -1.75, 9.017),
  catalogPointAtLocalU(-3, -3.898307208, 10.6),
  catalogPointAtLocalU(-8.08, -1.75, 10.6),
  catalogPointAtLocalU(0.08, -1.75, 10.6),
  catalogPointAtLocalU(-3, 0.08, 10.6),
  catalogPointAtLocalU(-3, -1.75, 12.24),
  TRUEDAN.joint,
  [-43.16, 0.27, 10.6], // wrongly targeted western S10/S11 booth
  [-38.6, 0.9, 10.0], // separate original western blue information booth
  [16.4, -0.3, 10.0], // separate eastern blue information booth
]) {
  assert(!isObsoleteVworldPoint(protectedPoint), `floor/neighbouring geometry must remain visible: ${protectedPoint}`);
}

const shader = informationZoneShaderText();
assert.doesNotMatch(shader, /\|\|\s*\)/, "standalone mask must remain valid when obsolete arrays are empty");
assert.match(shader, /positionEC/);
assert.match(shader, /u_informationZoneEnabled/);
assert.doesNotMatch(shader, /positionWC/);
const combinedShader = seoulVworldRetirementShaderText();
assert.match(combinedShader, /u_truedanCurrentEnabled/);
assert.match(combinedShader, /u_informationZoneCurrentEnabled/);
assert.match(combinedShader, /insideStairFrontShop/);
assert.match(combinedShader, /insideInformationZonePrism/);
assert.match(INFORMATION_ZONE.sourcePhoto, /IMG_6176/);
for (const prism of OBSOLETE_VWORLD_PRISMS) {
  assert(
    combinedShader.includes(prism.min[0].toFixed(5)) && combinedShader.includes(prism.max[2].toFixed(5)),
    `${prism.id} bounds must be embedded in the shared shader`,
  );
}
const source = fs.readFileSync("app/seoul-information-zone.js", "utf8");
assert.match(source, /canopy-column/);
assert.match(source, /canopy-cross-beam/);
assert.match(source, /positions: \[left, right\]/, "facility images must keep ordinary left-to-right orientation");
assert.match(source, /request !== record\.request/, "stale async loads must not overwrite a newer replacement");
assert.match(source, /record\.material\.image = record\.asset\.defaultImage/, "restore must reveal each baseline image");
assert.doesNotMatch(source, /tileset\.style|feature\.show|fetch\(/, "shared VWorld feature IDs must not be hidden or moved globally");

const app = fs.readFileSync("app/app.js", "utf8");
assert.match(app, /createSeoulTruedan/);
assert.match(app, /createSeoulVworldRetirementMask/);
assert.match(app, /createSeoulInformationZone\([\s\S]{0,180}maskManagedExternally: true/);
assert.match(app, /vworld\.informationZone\?\.setReplacements\(informationFacilityReplacements\)/);
assert.match(app, /vworld\.renovation\?\.setFacadeImage\(truedanFacade\?\.image_url \|\| ""\)/);
assert.match(app, /if \(isInformationFacilityReplacement\(replacement\)\) continue/);
assert.match(app, /vworld\.informationZone\.focusAsset\(informationFacility\.id, duration\)/);
assert.match(app, /RETIRED_INFORMATION_SHOP_SLOTS\.includes\(slot\.slot_alias\)/, "retired shop approval overlays must not survive the tileset mask");

console.log("Seoul information zone: exact S04 booth removal, five managed facilities, field-photo canopy, and adjacent structure preservation passed.");

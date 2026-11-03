import assert from "node:assert/strict";
import fs from "node:fs";
import {
  TRUEDAN,
  TRUEDAN_FACADE,
  truedanAxes,
  truedanCatalogPoint,
  isRetiredInformationPoint,
  retirementShaderText,
  createSeoulTruedan,
} from "../app/seoul-truedan.js";
import { seoulVworldRetirementShaderText } from "../app/seoul-vworld-retirement.js";

const { tangent, normal } = truedanAxes();
const close = (actual, expected, tolerance = 1e-8) => assert(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
close(Math.hypot(...tangent), 1);
close(Math.hypot(...normal), 1);
close(tangent[0] * normal[0] + tangent[1] * normal[1], 0);
assert.deepEqual(truedanCatalogPoint(0, 0, 0), TRUEDAN.joint);
const extension = truedanCatalogPoint(TRUEDAN.width, 0, 0);
close(Math.hypot(extension[0] - TRUEDAN.joint[0], extension[1] - TRUEDAN.joint[1]), 6);
assert(extension[0] > TRUEDAN.joint[0], "TRUEDAN must extend left of the stair-front shop");

assert.equal(TRUEDAN_FACADE.slotKey, "7afba516acfae10344297172e7c5c80368d4d3d43b140a71a14ccedc208852bc");
assert.equal(TRUEDAN_FACADE.slotAlias, "TRUEDAN-FRONT-S01");
assert.deepEqual([TRUEDAN_FACADE.pixelWidth, TRUEDAN_FACADE.pixelHeight], [1920, 1004]);
close(TRUEDAN_FACADE.width / TRUEDAN_FACADE.height, 1920 / 1004, 0.001);
assert(isRetiredInformationPoint([16.5, 0, 10]));
for (const point of [[9.73, -0.21, 10.3], [12.3, -3, 13.3], [16, 0, 9.017]]) {
  assert(!isRetiredInformationPoint(point), `TRUEDAN mask must preserve the target shop/timetable/floor: ${point}`);
}
assert.equal(await createSeoulTruedan(null, null, null, "S201801"), null);
assert.match(retirementShaderText(), /positionEC/);
assert.match(seoulVworldRetirementShaderText(), /u_truedanCurrentEnabled/);

const source = fs.readFileSync("app/seoul-truedan.js", "utf8");
assert.match(source, /positions: \[left, right\]/, "TRUEDAN upload must remain non-mirrored");
assert.match(source, /maskManagedExternally/);
assert.match(source, /setFacadeImage\(imageUrl\)/);
assert.match(source, /request !== facadeImageRequest/);
assert.doesNotMatch(source, /tileset\.style|feature\.show|fetch\(/);

const app = fs.readFileSync("app/app.js", "utf8");
assert.match(app, /createSeoulTruedan\([\s\S]{0,180}maskManagedExternally: true/);
assert.match(app, /visibleFloor\(TRUEDAN\.floor\) && state\.layers\.renovation/);
assert.match(app, /experienceFloors\.includes\(floor\) : floor === state\.floor/);
assert.match(app, /if \(isTruedanFacadeReplacement\(replacement\)\) continue/);
assert.match(app, /vworld\.renovation\?\.setFacadeImage\(truedanFacade\?\.image_url \|\| ""\)/);
assert.match(app, /if \(isTruedanCatalogFocus\(\) && vworld\.renovation\)/);

console.log("TRUEDAN: preserved structure, facade management, dedicated focus and shared-mask coexistence passed.");

# Seoul 2F TRUEDAN current-state structure

TRUEDAN is an independent current-state structure and remains in place. It is not the shop booth removed for the 2026-09-11 information-zone update.

## Placement and management

- Catalog ENU origin: longitude 126.97082°, latitude 37.55363°, ellipsoid height 27.2 m.
- TRUEDAN begins at E 13.6916638921 / N 0.2879689592 / U 9.0584676265 m and extends 6.0 m in positive local X (screen-left from the concourse).
- The complete public-facing elevation remains the independently managed app-asset slot `TRUEDAN-FRONT-S01` (`SEOUL-2F-TRUEDAN/front-facade`).
- Required image canvas: 1920 × 1004 px for the full 6.0 × 3.1378 m front surface.
- Approved replacements are rendered by the TRUEDAN-owned facade surface. Restore reveals its procedural default facade without deleting version history.

## Separation from the stair-front information zone

The user-confirmed removed shop has frontage `F02WL072-S04` and upper panels `S03/S05`, with a decoded width of 7.9866224045 m. Its connected shell shares the `F02WL054` model/TD_ID with other booths, so the ID cannot be hidden globally. The S04 east/front anchor is about 19 m west of the TRUEDAN reference corner. The previously selected S10/S11 booth farther west was rejected and must remain visible. See `seoul-information-zone.md` for the exact S04 frame and `IMG_6176.jpg` placement reference.

Cesium allows one `customShader` per tileset. `app/seoul-vworld-retirement.js` therefore owns one combined, bounded mask:

- the three legacy information-equipment fragments behind TRUEDAN;
- the exact S04-connected kiosk prism, local X −8.04…0.02 m, Y −3.89…0.02 m, and catalog U 9.025…12.20 m.

No source TIDS exists above S04, so unrelated western display/support masks are not carried over.

The shared shader keeps separate TRUEDAN and information-zone enable uniforms. The information-zone prism therefore cannot retire the TRUEDAN structure or deactivate `TRUEDAN-FRONT-S01`; the TRUEDAN-owned renderer and approved facade remain independently managed. The mask never hides a complete shared TD_ID, and its lower bound remains above the floor/tactile-paving elevation. Turning off **현황 시설 · TRUEDAN + 안내존** reveals the original VWorld capture for both current-state updates.

Direct TRUEDAN view: `/app/?site=S202103&asset=truedan`.

Verification: `npm run test:truedan`, `npm run test:information-zone`, the full build regression, and browser visual QA.

# F03WL018 membership lounge retirement

2026-09-14: User selected F03WL018-S14 in the built-in catalog map and provided IMG_6161 2.jpg showing the now-open concourse. Hide the entire old lounge, not one photograph.

## Scope and preservation

- Site S202103, floor 3F, model F03WL018, TD_ID b00540045882300332205598200.
- The complete catalogue contains only B_0_24_18:F001 and B_1_24_18:F001 for this object. Each LOD has one connected 112-triangle component: 224 triangles total.
- All 23 slots F03WL018-S01–S23 belong to that structure; exact alias/key pairs suppress any approved overlays without deleting records.
- Exterior walls, eaves, roof and the lounge's own bottom are included. Public floor F03FL001, wood-clad columns F03PL002, upper structural columns F03PL001, independent equipment F03FC005/F03FC036 and safety signs F03FC025/F03FC009 remain.
- 1,181 neighboring triangles were audited; the committed fixture includes 353 representative samples from the neighboring features. Exact site/floor/model/TD matching has zero collateral matches.

## Implementation and recovery

`app/seoul-lounge-retirement.json` is the reversible switch and exact slot registry. Set `enabled` to `false` and redeploy to restore the original geometry and eligible approved overlays. Source tiles, textures, catalog records and approval histories are untouched. No database mutation or replacement photo is needed.

The style condition runs before the normal floor visibility rule; previous pergola, feedback and information-center retirement rules are preserved. This change is based on the live v36 source, including concurrent Train Mates west-facade work.

## Verification

`node tools/test_seoul_lounge_retirement.mjs`: both LODs, all 23 overlays, metadata negative controls, representative neighbors and restore switch. Prior retirement, Train Mates, information-center and collaboration-build regressions passed. Built-in browser local scene confirms lounge absent while floor, columns and independent equipment remain; no console errors.

Full raw audit retained in the root workspace under `outputs/20260914_lounge_retirement/` (source research originated in `/tmp/f03-s14-audit/`).

## Opening-edge follow-up (2026-09-15)

The user's red-line annotation requests a glass railing along the newly exposed edge, with the two circled standing notice boards removed. The user explicitly confirmed that the black area behind the former lounge is the open volume above 2F. It is not missing floor: do not fill, patch or cover that opening.

- `seoul-opening-guardrail.json` stores the seven-point ENU edge path, offset 0.125 m onto the existing slab. The 37.372 m path joins existing F03MV001 railing caps at both ends and includes the left return. The 1.16 m height follows the existing rails; these are model-derived dimensions, not a field survey or safety certification. 159 quarter-metre path samples lie on the existing slab.
- `seoul-opening-guardrail.js` adds only 28 transparent glass spans, posts and rails. It adds no floor, roof, polygon fill or opening occluder. The facility is visible only on 3F at S202103.
- The two standing sign bodies share the exact F03FC005 feature, TD_ID `b00540045882300332205328000`. Both LODs are reversibly hidden; its exact approved-overlay key is suppressed without deleting catalog records.
- Their eight face-image triangles across both LODs belong to the shared F03FC036 atlas. Only those triangles are discarded using position plus raw UV; other F03FC036 panels, adjacent F03FC034 TV, F03PL002 wood columns and public floor are preserved. A narrowly inclusive edge tolerance avoids residual frame pixels.
- The shared tileset mask and standalone TrueDan shader both retain all earlier retirement rules.

`node tools/test_seoul_opening_guardrail.mjs` verifies path length, endpoints, panel sizes, reversible switches, 2,160 selected triangle samples and 4,320 preserved samples (zero collateral matches). Built-in local-browser QA confirms the continuous railing, empty former sign locations, preserved TV/columns and open atrium; console error list is empty.

Restore independently by setting `enabled` to `false` in `seoul-opening-guardrail.json` (remove the added railing) or `seoul-lounge-sign-retirement.json` (restore both signs), then redeploy. Original geometry, textures and catalog histories remain untouched.

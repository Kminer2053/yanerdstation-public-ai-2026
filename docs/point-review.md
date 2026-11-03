# Seoul station point review

Entry: `/routes/?view=points`. This is a location review workbench, not a routing engine.

## Review order

1. Select a floor. White candidates cover available floor slabs and audited stair/escalator tread models.
2. Select a point and mark its role: origin/destination (green), waypoint (white), floor connection (blue), facility access (yellow). Names and related source references are editable draft metadata; coordinates are retained.
3. Draw origin/destination areas on the current floor if needed.
4. Download the review file before reloading. Import supports role drafts and areas, with strict grid revision validation. These drafts are not server-persisted. Checking a role never enables navigation or approves a connection.

Existing POIs remain optional reference markers, not automatically verified walking nodes. No routing edges, direction inference, demand assignment, or simulation was added.

## Generation and limits

`node tools/build_all_point_grid.mjs <source workspace>` reads detailed cached VWorld B_1 tiles through the existing Draco decoder. It builds `public/data/route-review/grid-all.json`; `grid-2f.json` is a compatibility subset.

- 9 modeled levels: B7, B6, B3, B2, B1, 1F, 2F, 3F, 4F. RF has no verified walking floor geometry and is explicitly empty. No invented B4/B5 surfaces.
- Floor grid: 2 m spacing, upward-facing FL triangles, per-point interpolated height, 0.35 m edge/obstacle clearance. Multiple local elevations retained where separated by at least 0.3 m.
- F01FL008 tracks/ballast and B07FL002 lower track/base layer are excluded. CL roof/canopy models and slab undersides are not floor supports.
- Treads: audited MV body allowlist, upward normal >=0.98, projected triangle minimum altitude >=0.12 m, 0.5 m XY sampling. Highest eligible tread selected, own-body/other-model obstacles and upper landing caps checked. This is not a route polyline or accessibility clearance certification.
- Original retirement conditions, position+UV masks and volume/prism cutouts are applied without altering models. New information booths, TRUEDAN, S11 pair, TRAIN MATES, ZIMCARRY, 3F photo booth and opening guardrail remain obstacles.
- A final all-floor body/headroom test rejects internal surfaces and cross-floor slab intersections. Source FLOOR tags do not define collision boundaries.
- Candidate status remains unapproved, unsurveyed, and routing-disabled. Narrow corridors, staff-only spaces, entrance thresholds, paired landings and escalator direction require user inspection.

Provenance records tile, retirement configuration, custom asset configuration and generator hashes. Current default deployed positions are used; browser-local experimental placement overrides are excluded.

## Verification

`node tools/test_point_review.mjs`: four roles/colors, all-floor coverage, audited exclusions, retirement masks, headroom regression examples, custom footprints, role marking, origin-area validation, no approvals or edges.

`node tools/test_route_review.mjs`: prior node/route/destination tabs and source data preserved.

Browser checks: 2F stairs/ES points visible; B3 floor view; role mark/undo; responsive 390×844 view and mobile role button. Existing station asset data is not modified.

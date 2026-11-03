# Seoul Station 2F information zone

The user selected `F02WL072-S04` in the in-app 3D view on 2026-09-14 and provided `IMG_6176.jpg` as the field reference. The target is the grey-roofed shop directly facing the stairs between the 7/8 and 9/10 platform entrances. Its two upper panels are `F02WL072-S03` and `F02WL072-S05`; the decoded front width is 7.9866224045 m. The connected shell is `F02WL054` (TD_ID `b00540045882300332204276900`), a model/ID shared with other booths. The former S10/S11 location, roughly 34 m farther west, was explicitly rejected and must remain intact. TRUEDAN remains independently managed. The cleared S04 footprint contains five existing managed facilities:

- `SEOUL-2F-INFORMATION-BOOTH-01` — information booth front
- `SEOUL-2F-TRAIN-DEPARTURE-DISPLAY-01` — overhead train departure display
- `SEOUL-2F-GUIDE-BOARD-01` — first vertical guide board on the left
- `SEOUL-2F-GUIDE-BOARD-02` — second vertical guide board on the left
- `SEOUL-2F-INFORMATION-TV-01` — TV on the right

The booth and train-display baseline images are derived from existing VWorld assets in the same station scene. The two boards use the existing station guide-board image as a visual reference. The TV has a neutral generated baseline because the field photograph crops most of its screen; no unseen programme or advertising content is invented.

## Placement and source protection

Facility dimensions and spacing are photo estimates (`surveyed: false`), while the removed frontage is anchored to decoded S04 vertices. The east/front lower corner is ENU `[-5.1958088534,-1.4853219892,9.0584818485]`; the west/front lower corner is `[-13.1801625407,-1.6756733179,9.0584658986]`. Positive local X is screen-left when viewed from the stairs. The local retirement prism is X −8.04…0.02 m, Y −3.89…0.02 m, and catalog U 9.025…12.20 m. Its original-mesh intersection contains only the target shell (30 triangles) and S03/S04/S05 surfaces (26 triangles).

From the stairs the order is two vertical boards, booth, then TV. The TIDS sits above/behind the booth on a grounded canopy frame. No old TIDS exists above S04 in the source geometry, so the unrelated western display/support masks are not reused. Floor and tactile paving remain below U 9.01705; the separate rear F02FC089 surface is behind local Y −3.8983. The 7/8 and 9/10 platform signs, stairs, western booth, and TRUEDAN are outside the mask. Turning off **현황 시설 · TRUEDAN + 안내존** restores the older VWorld capture. No shared `TD_ID` is globally hidden.

The three single-placement S03/S04/S05 catalog slots are retired by setting them inactive and their work items to hold; their originals and all replacement versions are preserved. Generic approved-image overlays also exclude those exact aliases so old shop photos cannot float over the new facilities. The same five information asset IDs, canvas sizes and image paths are retained. The previously unapplied migration 009 is corrected to this verified location, and both top-level and primary-placement coordinates are updated together. Selection markers derive their coordinates from the renderer when an older catalog tab still has stale metadata.

## Replacement contracts

Each physical facility has its own `app_asset` slot and work item. Uploaded images are rendered only on the corresponding front surface and use a canvas with the same aspect ratio as that surface:

| Slot | Surface | Canvas |
| --- | --- | --- |
| `INFO-BOOTH-01-S01` | booth front | 830 × 1000 px |
| `TIDS-01-S01` | train display | 960 × 323 px |
| `INFO-GUIDE-01-S01` | guide board 1 | 400 × 900 px |
| `INFO-GUIDE-02-S01` | guide board 2 | 400 × 900 px |
| `INFO-TV-01-S01` | TV screen | 1280 × 720 px |

`TRUEDAN-FRONT-S01` remains active and independently managed. It is neither a replacement source nor a retirement target for these five information-zone slots.

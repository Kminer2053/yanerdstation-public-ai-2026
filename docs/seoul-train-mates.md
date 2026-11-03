# TRAIN MATES photo revision — 2026-09-14

User requested unhide and photo-aligned facades. Stable asset ID: `TRAIN-MATES-SEOUL-2F`. Later correction: parallel/no gap at escalator side, plus west entrance.

- South-facing front: `TRAIN-MATES-FRONT-S01`, front full lattice with raised GIFT SHOP 철도기념품 sign.
- East/right side: `TRAIN-MATES-RIGHT-S01`, doorway on the photo's right (local +Y/north).
- West/left side: `TRAIN-MATES-LEFT-S01`, identical east photo as explicitly requested, not a separate west survey. Viewed from west, doorway remains on the image right (local -Y/south). Separate slot allows future independent replacement.
- Corrected app ENU center `(-95.029287651896,-40.782623097138,36.23)`, heading19.9704431. App origin `(126.97120460405696,37.55452066661308,0)` is NOT the catalog origin.
- Nearest audited escalator F02MV011 app centroid `(-91.88840,-35.60967,40.20182)` is northeast/behind. TMO F02WL023 facade `(-102.92409,-28.33892,38.16627)` is northwest.
- Footprint9.792×4.608m retained; lattice2.72m + raised sign0.49m estimated from photos. No survey accuracy is claimed. No VWorld triangles, nearby booths, floor, signs or escalators are removed.
- Catalog selection no longer hides this physical shop. Existing shops/floor layers remain respected. The shop camera re-enables its layer and exits placement mode cleanly.
- Old v6 and photo-v7 browser placements remain preserved. `escalator-flush-v8` starts at the corrected default so earlier positions cannot override this correction.
- Built-in ImageGen rectified the user's `23. 2층 맞이방 굿즈점2.jpg` (front) and `...굿즈점1.jpg` (right), excluding people/foreground posts, floor and background. Occluded lattice/interior and small lettering were reconstructed, not observed exactly.
- The front PNG has opaque unused upper corners. Separate body/sign quads crop them out; no checkerboard is rendered. Image top-left crops convert to Cesium bottom-up texture UVs; the east plane's reversed vertical basis is corrected separately. Visually checked upright/unmirrored lettering and doorway floor/ceiling.
- Front replacement canvas2042×669 uses the same normalized template regions as the source2042×770 atlas: body y120/770..1; sign x506/2042..1536/2042, y6/770..117/770. East canvas1681×992 spans the whole side. Future replacements must retain this front template layout.
- Approved replacements route to the renderer-owned surfaces; restoration resets to bundled defaults. Image load failures reset to baseline; rebuild destroys only this asset's own primitive collection.

Generated originals/prompts and registration evidence are retained under `outputs/20260914_trainmates_update/` outside this publication checkout. Original supplied photos remain unchanged.

## Escalator contact correction

Decoded B_1_25_10.bin F003/F02MV011 south edge gives tangent `(.939868932045,-.341535343086)`. F004/F02WL060 under-escalator side protrudes8.56cm beyond the handrail. Use both meshes' outer support plane `dot((.341535343086,.939868932045), XY)=-68.482180777736`, avoiding penetration of either original.

Rear endpoints: `(-98.843988512716,-36.945008037956)` and `(-89.640791930134,-40.289322117458)`. Both exactly on the supporting line and inside the escalator edge's longitudinal extent. Source F004 faces10/11 east-upper vertex `(-90.454442915741,-39.993652626695,39.915234780467)` is the support contact. Original wall vertices are not perfectly coplanar with the handrail line (up to1.55cm deviation); no claim that every original triangle lies in one plane. Source SHA256 `9e85d54accbf11479984395bf84f258253a309d503c55f352f91f2935c8af7fc`.

West entry ID `asset:TRAIN-MATES-SEOUL-2F:west-entrance-lintel`, legacy focus `west-entrance`: shell opening follows the reused photo (x1053..1409/1681, y114..935/935), approximately0.98m wide×2.39m high, center local Y=-1.07m. Presence is user-confirmed; dimensions/location within the west face are image-derived estimates. No full shell box behind the door. The facade photo depicts the doorway/interior like the east facade; it is not an interactive door. Review URL `?site=S202103&asset=train-mates&surface=west-side`.

Only existing two catalog slots' geographic/ENU positions, camera headings and placements are updated; original images, canvases, approvals and work assignments stay unchanged.

Following the east-to-west copy request, one new west slot is added with the identical existing east baseline hash/storage paths and1681×992 replacement canvas. The previous escalator-flush coordinates and existing two slots are unchanged. Future approvals remain face-specific.

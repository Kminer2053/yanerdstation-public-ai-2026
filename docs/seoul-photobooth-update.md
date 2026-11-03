# Seoul 3F photo booth, 2026-09-15

User-authorized replacement of the single phone charger at F03FC036-S01 with an 인생네컷 booth, using IMG_6165 2.jpg. The shared FC036 model, atlas slot and its database history remain unchanged. Retirement is reversible through app/seoul-photobooth-retirement.json enabled.

Facility: SEOUL-3F-LIFEFOURCUTS-01. Managed front slot: LIFEFOURCUTS-FRONT-S01; surface front-facade. Baseline photo is 1774 × 887 PNG, SHA-256 aef6378fe678ccf4e59cb209c5e9ad02a79a167acce53935f504ca1e585f3371. Registered as an active managed baseline, pending future replacement review; no approval history fabricated.

Photobooth width 4.8m, height 2.4m, depth 1.4m are photo-based estimates, not surveyed measurements. ENU origin is [126.97082,37.55363,27.2]; front base center [-18.14,61.91,15.1056], outward east. Unphotographed side/back/top surfaces are neutral white. The front is a rectified photo plane; doorway interiors and mirror were reconstructed where people/luggage obscured them, rather than surveyed 3D interiors. Image editing prompt: photobooth-generation-prompt.txt. Original photo is kept outside the published site.

The enclosure is set forward to rear E=-19.54 to avoid existing FC019 wall panel and WL001 bevel. Source floor covers the footprint in both LODs at U≈15.1056. Only charger faces 36–47 in both LODs (24 triangles) are retired, using both ENU triangle coordinates and original UV coordinates. Exact face checks are attached to original tiles and legacy replacement-overlay shader paths. No feature/model-level FC036 hiding.

Verification: node tools/test_seoul_photobooth_retirement.mjs . checks 1,080 removal samples, 42,795 preserved samples across 951 triangles, zero collateral hits, coordinate/UV independence, boundaries, both shader paths and disabled rollback. CPU geometry test is complemented by the in-app browser render check. A renderer crash during hot reload recovered on a fresh reload; no browser/security setting changed.

Registration migration: supabase/migrations/20260915000600_photobooth_facility.sql. Guards compare source slot/work/history JSON before and after, and reject duplicate new IDs. Existing bucket permissions and approval policies were not changed; the linked account's authorized storage CLI uploaded the baseline after the public editor correctly rejected baseline-bucket writes.

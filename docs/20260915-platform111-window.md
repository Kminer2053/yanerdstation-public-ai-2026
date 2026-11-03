# PLATFORM111 3F window presentation

User requested replacing the long bent/curved window bank outlined in their screenshot with the existing PLATFORM111 asset.

- Logical facility remains `SEOUL-2F-PLATFORM111`, original 2F 111m geometry and both catalog slots unchanged.
- 3F uses `seoul-platform111-window.json`: source `F03WL011`, component `B_1_24_15:C48`, 524 triangles. Exact interior perimeter: 32 nodes, 31 spans, 120.3170603646274m display path, 5.306034240067561m height.
- Face is offset 4cm toward the concourse. Original source inward protrusion is at most 0.000022262m, leaving 0.039977738m clearance. Uniform top/bottom envelope differs from original vertices by under 1.34mm.
- The same media and departures slot URLs/approval history feed both presentations. No new catalog rows or database mutations.
- Only the presentation for the active floor is shown. Original source windows remain recoverable behind the face. Opposite disconnected component C186, independent structure columns, the open 2F void and glass guardrail are preserved.
- Backing is 2cm thick and has no downward skirt. No full-model hide or floor-filling geometry.

Validation: continuous path and UV tests, floor separation, unchanged original config, photo-booth retirement 1,080 target/42,795 preservation samples, production build and collaboration build checks. Built-in browser verified window coverage and no runtime errors.

Research provenance: `/tmp/platform111-window-audit/window-layout.json` derived from source tile geometry, not screenshot coordinates. Geometry is not field-surveyed.

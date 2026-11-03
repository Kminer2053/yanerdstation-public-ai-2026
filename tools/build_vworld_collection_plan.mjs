import fs from "node:fs";
import path from "node:path";

const [tilesetPath, outputDir, baseUrl, planName = "vworld-indoor-station-full-tileset"] = process.argv.slice(2);
if (!tilesetPath || !outputDir || !baseUrl) {
  console.error("Usage: node tools/build_vworld_collection_plan.mjs <tileset.json> <output-dir> <base-url>");
  process.exit(1);
}

const text = fs.readFileSync(tilesetPath, "utf8").replace(/^\uFEFF/, "");
const tileset = JSON.parse(text);
const rows = [];

function contentUri(tile) {
  return tile.content?.uri ?? tile.content?.url ?? null;
}

function visit(tile, depth = 0, parentUri = null, inheritedRefine = null) {
  const uri = contentUri(tile);
  const region = tile.boundingVolume?.region ?? null;
  const refine = tile.refine ?? inheritedRefine ?? null;
  if (uri) {
    rows.push({
      uri,
      depth,
      parent_uri: parentUri,
      refine,
      geometric_error: tile.geometricError ?? null,
      region,
      child_count: tile.children?.length ?? 0,
    });
  }
  for (const child of tile.children ?? []) visit(child, depth + 1, uri ?? parentUri, refine);
}

visit(tileset.root);
fs.mkdirSync(outputDir, { recursive: true });
const plan = {
  name: planName,
  user_agent: "Mozilla/5.0 CodexResearch/1.0",
  steps: rows.map((row, index) => ({
    id: path.basename(row.uri, path.extname(row.uri)) || `tile-${index + 1}`,
    type: "request",
    url: new URL(row.uri, baseUrl).href,
    method: "GET",
    save_body: true,
  })),
};

fs.writeFileSync(path.join(outputDir, "tile-index.json"), `${JSON.stringify(rows, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, "collection-plan.json"), `${JSON.stringify(plan, null, 2)}\n`);

console.log(JSON.stringify({ tile_count: rows.length, leaf_count: rows.filter((row) => row.child_count === 0).length, outputDir }, null, 2));

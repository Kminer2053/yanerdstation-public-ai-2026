import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const [inputRoot, outputPath] = process.argv.slice(2);
if (!inputRoot || !outputPath) {
  console.error("Usage: node tools/build_texture_contact_sheet.mjs <input-root> <output.png>");
  process.exit(1);
}

const supported = new Set([".jpg", ".jpeg", ".png"]);
const files = [];
for (const tile of fs.readdirSync(inputRoot).sort()) {
  const tileDir = path.join(inputRoot, tile);
  if (!fs.statSync(tileDir).isDirectory()) continue;
  for (const name of fs.readdirSync(tileDir).sort()) {
    if (supported.has(path.extname(name).toLowerCase())) files.push({ tile, name, file: path.join(tileDir, name) });
  }
}

const columns = 4;
const cellWidth = 360;
const cellHeight = 300;
const labelHeight = 34;
const rows = Math.ceil(files.length / columns);
const composites = [];

for (let index = 0; index < files.length; index += 1) {
  const item = files[index];
  const image = await sharp(item.file)
    .resize(cellWidth - 20, cellHeight - labelHeight - 20, { fit: "contain", background: "#17202a" })
    .extend({ top: 10, bottom: 10, left: 10, right: 10, background: "#17202a" })
    .png()
    .toBuffer();
  const x = (index % columns) * cellWidth;
  const y = Math.floor(index / columns) * cellHeight;
  composites.push({ input: image, left: x, top: y });
  const label = `${item.tile} / ${item.name}`;
  const svg = Buffer.from(`<svg width="${cellWidth}" height="${labelHeight}"><rect width="100%" height="100%" fill="#0c1117"/><text x="12" y="23" font-family="Arial, sans-serif" font-size="17" fill="#f5f7fa">${label}</text></svg>`);
  composites.push({ input: svg, left: x, top: y + cellHeight - labelHeight });
}

await sharp({ create: { width: columns * cellWidth, height: rows * cellHeight, channels: 3, background: "#0c1117" } })
  .composite(composites)
  .png()
  .toFile(outputPath);

console.log(JSON.stringify({ outputPath, count: files.length, columns, rows }, null, 2));

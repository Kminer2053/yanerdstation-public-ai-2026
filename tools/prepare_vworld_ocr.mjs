import fs from 'node:fs';
import path from 'node:path';

const [catalogPath, outputListPath] = process.argv.slice(2);
if (!catalogPath || !outputListPath) {
  console.error('usage: node prepare_vworld_ocr.mjs <image-catalog.json> <output-list.txt>');
  process.exit(2);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const catalogRoot = path.dirname(path.resolve(catalogPath));
const byHash = new Map();
for (const row of catalog) {
  if (row.placeholder || row.preview_error || !row.preview_path) continue;
  const previous = byHash.get(row.image_sha256);
  const priority = {HIGH: 5, MEDIUM: 4, REVIEW: 3, REFERENCE: 2, EXCLUDE: 1};
  if (!previous || (priority[row.replacement_priority] || 0) > (priority[previous.replacement_priority] || 0)) {
    byHash.set(row.image_sha256, row);
  }
}

const paths = [...byHash.values()]
  .map((row) => path.join(catalogRoot, row.mime_type === 'image/ktx2' ? row.preview_path : row.asset_path))
  .sort();
fs.mkdirSync(path.dirname(outputListPath), {recursive: true});
fs.writeFileSync(outputListPath, `${paths.join('\n')}\n`);
console.log(JSON.stringify({unique_non_placeholder_images: paths.length, output: outputListPath}));

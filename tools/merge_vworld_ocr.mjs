import fs from 'node:fs';
import path from 'node:path';

const [catalogPath, ocrPath] = process.argv.slice(2);
if (!catalogPath || !ocrPath) {
  console.error('usage: node merge_vworld_ocr.mjs <image-catalog.json> <ocr.json>');
  process.exit(2);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const ocrItems = JSON.parse(fs.readFileSync(ocrPath, 'utf8'));
const catalogRoot = path.dirname(path.resolve(catalogPath));
const byPreview = new Map(
  ocrItems.map((item) => [path.resolve(item.path), item])
);
const byHash = new Map();
for (const row of catalog) {
  const item = byPreview.get(path.resolve(catalogRoot, row.preview_path || ''))
    || byPreview.get(path.resolve(catalogRoot, row.asset_path || ''));
  if (item) byHash.set(row.image_sha256, item);
}

for (const row of catalog) {
  const item = byHash.get(row.image_sha256);
  row.ocr_text = item?.text || '';
  row.ocr_confidence = item ? Math.round(item.averageConfidence * 1000) / 1000 : '';
  row.ocr_label_candidate = item?.lines?.[0] || '';
}

const columns = [
  'image_id','tile','tile_uri','tile_url','tile_depth','detail_tile','parent_tile','geometric_error',
  'image_index','mime_type','width_px','height_px','byte_length','image_sha256','placeholder',
  'replacement_priority','floors','feature_ids','model_names','class_codes','td_ids','oids',
  'coordinate_accuracy','longitude','latitude','height_m','east_m','north_m','up_m',
  'rtc_center_x','rtc_center_y','rtc_center_z','asset_path','preview_path','preview_error',
  'source_observed_at','ocr_label_candidate','ocr_text','ocr_confidence',
  'current_store_name','replacement_image_path','field_verified','duplicate_count','unique_image'
];
const q = (value) => {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};
const csv = [columns.join(','), ...catalog.map((row) => columns.map((column) => q(row[column])).join(','))].join('\n');
fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
fs.writeFileSync(path.join(catalogRoot, 'image-catalog.csv'), `${csv}\n`);

console.log(JSON.stringify({catalog_rows: catalog.length, ocr_images: byHash.size, non_empty_ocr: [...byHash.values()].filter((item) => item.text).length}));

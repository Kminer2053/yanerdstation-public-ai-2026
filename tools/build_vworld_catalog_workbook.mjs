import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const [catalogDir, outputPath, qaDir] = process.argv.slice(2);
if (!catalogDir || !outputPath || !qaDir) {
  console.error('usage: node build_vworld_catalog_workbook.mjs <catalog-dir> <output.xlsx> <qa-dir>');
  process.exit(2);
}

const images = JSON.parse(await fs.readFile(path.join(catalogDir, 'image-catalog.json'), 'utf8'));
const features = JSON.parse(await fs.readFile(path.join(catalogDir, 'feature-catalog.json'), 'utf8'));
const manifest = JSON.parse(await fs.readFile(path.join(catalogDir, 'manifest.json'), 'utf8'));

const priorityRank = {HIGH: 0, MEDIUM: 1, REVIEW: 2, REFERENCE: 3, EXCLUDE: 4};
const uniqueCandidates = [];
const seenHashes = new Set();
for (const row of [...images].sort((a, b) =>
  (priorityRank[a.replacement_priority] ?? 9) - (priorityRank[b.replacement_priority] ?? 9)
  || a.floors.localeCompare(b.floors)
  || a.model_names.localeCompare(b.model_names)
)) {
  if (row.placeholder || !row.detail_tile || !['HIGH', 'MEDIUM'].includes(row.replacement_priority)) continue;
  if (seenHashes.has(row.image_sha256)) continue;
  seenHashes.add(row.image_sha256);
  uniqueCandidates.push(row);
}

const wb = Workbook.create();
const summary = wb.worksheets.add('요약');
const imageSheet = wb.worksheets.add('이미지목록');
const candidateSheet = wb.worksheets.add('교체후보');
const featureSheet = wb.worksheets.add('개체목록');
const previewSheet = wb.worksheets.add('미리보기');
const codeSheet = wb.worksheets.add('코드표');

const colors = {navy: '#071B26', blue: '#0B3344', cyan: '#08BFD5', green: '#29D8A0', white: '#F4FBFD', muted: '#A8C1CA', amber: '#F2A93B', red: '#F65B70', line: '#B8CCD3'};
const titleFormat = {fill: colors.navy, font: {bold: true, color: colors.white, size: 18}, verticalAlignment: 'center'};
const sectionFormat = {fill: colors.blue, font: {bold: true, color: colors.white, size: 12}, verticalAlignment: 'center'};
const headerFormat = {fill: '#0E566D', font: {bold: true, color: colors.white}, wrapText: true, verticalAlignment: 'center'};
const noteFormat = {fill: '#EAF5F7', font: {color: '#234B59'}, wrapText: true, verticalAlignment: 'top'};

function writeMatrix(sheet, startRow, startCol, matrix) {
  if (!matrix.length || !matrix[0].length) return;
  const endRow = startRow + matrix.length - 1;
  const endCol = startCol + matrix[0].length - 1;
  sheet.getRangeByIndexes(startRow, startCol, matrix.length, matrix[0].length).values = matrix;
  return {endRow, endCol};
}

function styleDataSheet(sheet, rows, headers, widths, tableName) {
  writeMatrix(sheet, 0, 0, [headers, ...rows]);
  sheet.getRangeByIndexes(0, 0, 1, headers.length).format = headerFormat;
  sheet.getRangeByIndexes(0, 0, rows.length + 1, headers.length).format.wrapText = false;
  sheet.getRangeByIndexes(1, 0, rows.length, headers.length).format.rowHeight = 18;
  widths.forEach((width, index) => { sheet.getRangeByIndexes(0, index, rows.length + 1, 1).format.columnWidth = width; });
  sheet.freezePanes.freezeRows(1);
  sheet.tables.add(sheet.getRangeByIndexes(0, 0, rows.length + 1, headers.length), true, tableName);
}

summary.getRange('A1:H2').merge();
summary.getRange('A1:H2').values = [['VWORLD 서울역 실내 이미지·개체 카탈로그']];
summary.getRange('A1:H2').format = titleFormat;
summary.getRange('A1:H2').format.rowHeight = 30;
summary.getRange('A4:B4').values = [['핵심 지표', '값']];
summary.getRange('A4:B4').format = sectionFormat;
summary.getRange('A5:A9').values = [['이미지 발생 건수'], ['고유 원본 수'], ['연결 개체 수'], ['교체 후보 수'], ['HIGH 파사드 건수']];
summary.getRange('B5:B9').formulas = [
  [`=COUNTA('이미지목록'!A2:A${images.length + 1})`],
  [null],
  [`=COUNTA('개체목록'!A2:A${features.length + 1})`],
  [`=COUNTA('교체후보'!A2:A${uniqueCandidates.length + 1})`],
  [`=COUNTIF('이미지목록'!P2:P${images.length + 1},\"HIGH\")`]
];
summary.getRange('B6').values = [[manifest.unique_image_count]];
summary.getRange('B5:B9').format.numberFormat = '#,##0';
summary.getRange('D4:F4').merge();
summary.getRange('D4:F4').values = [['교체 우선순위']];
summary.getRange('D4:F4').format = sectionFormat;
summary.getRange('D5:E9').values = [
  ['HIGH', '상세 타일의 벽체(WL) 이미지: 매장 파사드 최우선'],
  ['MEDIUM', '상세 타일의 시설물(FC) 이미지'],
  ['REVIEW', '문·이동시설·복합 재질 등 수동 검토'],
  ['REFERENCE', '상위 LOD 또는 구조 참고용'],
  ['EXCLUDE', '1×1 placeholder 등 교체 제외']
];
summary.getRange('E5:E9').format.wrapText = true;
summary.getRange('A12:B12').values = [['층별 이미지', '발생 건수']];
summary.getRange('A12:B12').format = sectionFormat;
const floors = ['B7','B6','B5','B4','B3','B2','B1','1F','2F','3F','4F','RF'];
summary.getRange('A13:A24').values = floors.map((f) => [f]);
summary.getRange('B13:B24').values = floors.map((floor) => [images.filter((row) => row.floors.split('|').includes(floor)).length]);
summary.getRange('B13:B24').format.numberFormat = '#,##0';
summary.getRange('D12:H12').merge();summary.getRange('D12:H12').values = [['활용 순서']];summary.getRange('D12:H12').format = sectionFormat;
const workflowNotes = [
  ['1. HTML 카탈로그의 공간 보기에서 층을 선택하고 개체 위치를 확인'],
  ['2. 교체후보 시트에서 TD_ID·모델명·타일·이미지 번호를 확정'],
  ['3. current_store_name, replacement_image_path, field_verified 열을 현장 조사 후 입력'],
  ['4. 원본과 같은 종횡비·해상도·UV 배치를 유지한 교체 텍스처 제작'],
  ['5. VWorld 원본 타일은 직접 덮어쓰지 말고 별도 서비스 레이어/자체 tileset로 배포']
];
workflowNotes.forEach((value, index) => { const range = summary.getRange(`D${13 + index}:H${13 + index}`); range.merge(); range.values = [value]; });
summary.getRange('D13:H17').format = noteFormat;
summary.getRange('A27:H27').merge(); summary.getRange('A27:H27').values = [['출처·제약']]; summary.getRange('A27:H27').format = sectionFormat;
const sourceNotes = [
  [`원본 tileset: ${manifest.source_tileset}`],
  ['사이트: 서울역KTX / S202103 / 관찰일 2026-08-31'],
  ['feature_geometry_centroid는 GLB 정점과 RTC_CENTER를 합성한 개체 중심 좌표입니다. tile_region_center는 개체 연결이 없는 이미지의 타일 영역 중심입니다.'],
  ['floors는 MODEL_NAME(F02…, B01…)에서 추출했습니다. 복수 층 값은 동일 텍스처가 여러 개체에 재사용된 경우입니다.'],
  ['OCR 열은 원본 UV 아틀라스 특성상 자동 인식 결과가 없거나 부정확할 수 있으므로 현장 확인값을 우선합니다.']
];
sourceNotes.forEach((value, index) => { const range = summary.getRange(`A${28 + index}:H${28 + index}`); range.merge(); range.values = [value]; });
summary.getRange('A28:H32').format = noteFormat;
['A','B','C','D','E','F','G','H'].forEach((c, i) => summary.getRange(`${c}:${c}`).format.columnWidth = [18,18,4,16,27,16,16,16][i]);
summary.getRange('1:32').format.rowHeight = 22;
summary.getRange('5:9').format.rowHeight = 34;

const imageHeaders = ['image_id','tile','image_index','detail_tile','tile_depth','mime_type','width_px','height_px','byte_length','sha256','duplicate_count','placeholder','asset_path','preview_path','tile_url','replacement_priority','floors','class_codes','model_names','feature_ids','TD_IDs','OIDs','coordinate_accuracy','longitude','latitude','height_m','east_m','north_m','up_m','OCR후보','OCR전체','현재매장명','교체이미지경로','현장확인'];
const imageRows = images.map((r) => [r.image_id,r.tile,r.image_index,r.detail_tile,r.tile_depth,r.mime_type,r.width_px,r.height_px,r.byte_length,r.image_sha256,r.duplicate_count,r.placeholder,r.asset_path,r.preview_path,r.tile_url,r.replacement_priority,r.floors,r.class_codes,r.model_names,r.feature_ids,r.td_ids,r.oids,r.coordinate_accuracy,r.longitude,r.latitude,r.height_m,r.east_m,r.north_m,r.up_m,r.ocr_label_candidate,r.ocr_text,r.current_store_name,r.replacement_image_path,r.field_verified]);
styleDataSheet(imageSheet, imageRows, imageHeaders, [23,16,9,10,9,12,9,9,12,18,10,10,34,34,38,14,9,12,18,15,28,12,24,14,14,10,10,10,10,18,30,18,28,11], 'ImageCatalog');
imageSheet.getRange(`G2:I${imageRows.length + 1}`).format.numberFormat = '#,##0';
imageSheet.getRange(`X2:AC${imageRows.length + 1}`).format.numberFormat = '0.000000';

const candidateHeaders = ['후보ID','우선순위','층','분류','모델명','TD_ID','OID','타일','이미지번호','원본크기','MIME','해시','중복수','좌표정확도','경도','위도','높이m','동m','북m','원본경로','미리보기경로','현재매장명','교체이미지경로','현장확인','비고'];
const candidateRows = uniqueCandidates.map((r) => [r.image_id,r.replacement_priority,r.floors,r.class_codes,r.model_names,r.td_ids,r.oids,r.tile,r.image_index,`${r.width_px}×${r.height_px}`,r.mime_type,r.image_sha256,r.duplicate_count,r.coordinate_accuracy,r.longitude,r.latitude,r.height_m,r.east_m,r.north_m,r.asset_path,r.preview_path,'','',false,'']);
styleDataSheet(candidateSheet, candidateRows, candidateHeaders, [24,12,9,10,18,28,10,16,10,13,12,18,9,24,14,14,10,10,10,34,34,18,28,11,24], 'ReplacementCandidates');
candidateSheet.getRange(`O2:S${candidateRows.length + 1}`).format.numberFormat = '0.000000';

const featureHeaders = ['feature_key','tile','feature_id','floor','site_name','TD_ID','MODEL_NAME','class_code','OID','image_ids','image_indices','material_indices','mapping_method','vertex_count','longitude','latitude','height_m','east_m','north_m','up_m'];
const featureRows = features.map((r) => [r.feature_key,r.tile,r.feature_id,r.floor,r.site_name,r.td_id,r.model_name,r.class_code,r.oid,r.image_ids,r.image_indices,r.material_indices,r.mapping_method,r.vertex_count,r.longitude,r.latitude,r.height_m,r.east_m,r.north_m,r.up_m]);
styleDataSheet(featureSheet, featureRows, featureHeaders, [28,16,10,9,14,28,18,10,10,30,18,18,24,11,14,14,10,10,10,10], 'FeatureCatalog');
featureSheet.getRange(`O2:T${featureRows.length + 1}`).format.numberFormat = '0.000000';

previewSheet.getRange('A1:L2').merge();previewSheet.getRange('A1:L2').values = [['HIGH 파사드 미리보기 · 상위 96개']];previewSheet.getRange('A1:L2').format = titleFormat;
previewSheet.getRange('A3:L3').merge();previewSheet.getRange('A3:L3').values = [['전체 1,962건은 catalog.html에서 필터·공간 보기로 확인하세요. 이 시트는 현장 대조가 잦은 상세 벽체(WL) 후보만 빠르게 훑기 위한 요약입니다.']];previewSheet.getRange('A3:L3').format = noteFormat;
const previews = uniqueCandidates.filter((r) => r.replacement_priority === 'HIGH').slice(0, 96);
for (let i = 0; i < previews.length; i++) {
  const r = previews[i];
  const blockCol = (i % 4) * 3;
  const blockRow = 4 + Math.floor(i / 4) * 8;
  previewSheet.getRangeByIndexes(blockRow, blockCol, 1, 3).merge();
  previewSheet.getRangeByIndexes(blockRow, blockCol, 1, 3).values = [[`${r.floors} · ${r.model_names} · ${r.tile}:${r.image_index}`]];
  previewSheet.getRangeByIndexes(blockRow, blockCol, 1, 3).format = {fill: colors.blue, font: {bold: true, color: colors.white, size: 10}, wrapText: true};
  previewSheet.getRangeByIndexes(blockRow + 6, blockCol, 1, 3).merge();
  previewSheet.getRangeByIndexes(blockRow + 6, blockCol, 1, 3).values = [[`TD_ID ${r.td_ids} · ${r.longitude}, ${r.latitude}`]];
  previewSheet.getRangeByIndexes(blockRow + 6, blockCol, 1, 3).format = {font: {color: '#294E5A', size: 9}, wrapText: true};
  try {
    const bytes = await fs.readFile(path.join(catalogDir, r.preview_path));
    previewSheet.images.add({dataUrl: `data:image/png;base64,${bytes.toString('base64')}`, anchor: {from: {row: blockRow + 1, col: blockCol}, extent: {widthPx: 210, heightPx: 135}}});
  } catch {}
}
for (let c = 0; c < 12; c++) previewSheet.getRangeByIndexes(0, c, 200, 1).format.columnWidth = 9;
for (let r = 4; r < 4 + Math.ceil(previews.length / 4) * 8; r++) previewSheet.getRangeByIndexes(r, 0, 1, 12).format.rowHeight = 22;
previewSheet.freezePanes.freezeRows(4);

const codeRows = [
  ['WL','Wall','벽체·매장 파사드','HIGH','매장 이미지 교체 1순위','MODEL_NAME 예: F02WL037'],
  ['FC','Facility','시설물·가구·부스','MEDIUM','시설 에셋/텍스처 점검','MODEL_NAME 예: F02FC087'],
  ['MV','Moving facility','에스컬레이터·이동시설','REVIEW','구조 영향 확인 후 변경',''],
  ['DR','Door','출입문','REVIEW','벽체와 함께 쓰는 이미지인지 확인',''],
  ['CL','Ceiling','천장','REFERENCE','구조 참고',''],
  ['FL','Floor','바닥','REFERENCE','구조 참고',''],
  ['PL','Pillar','기둥','REFERENCE','구조 참고',''],
  ['feature_geometry_centroid','좌표 정확도','개체 정점 중심','권장','선택 개체 위치 기준','RTC_CENTER + GLB 정점'],
  ['tile_region_center','좌표 정확도','타일 영역 중심','보조','이미지-개체 연결이 없을 때','정확한 매장 배치점 아님'],
  ['current_store_name','현장 입력','현재 상호명','','사진 조사 후 입력',''],
  ['replacement_image_path','현장 입력','교체 텍스처 파일','','원본 종횡비/UV 유지',''],
  ['field_verified','현장 입력','위치·상호·이미지 확인 여부','','TRUE/FALSE','']
];
styleDataSheet(codeSheet, codeRows, ['코드/필드','영문','의미','우선순위','작업 지침','비고'], [26,22,26,14,34,30], 'CodeBook');

await fs.mkdir(path.dirname(outputPath), {recursive: true});
await fs.mkdir(qaDir, {recursive: true});
const checks = {
  sheets: (await wb.inspect({kind: 'sheet', include: 'id,name', maxChars: 4000})).ndjson,
  summary: (await wb.inspect({kind: 'region', sheetId: '요약', range: 'A1:H32', maxChars: 9000})).ndjson,
  formulaScan: (await wb.inspect({kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A', maxChars: 4000, options: {useRegex: true, maxResults: 100}})).ndjson
};
await fs.writeFile(path.join(qaDir, 'inspection.json'), JSON.stringify(checks, null, 2));
for (const [sheetName, range, file] of [
  ['요약','A1:H32','summary.png'],
  ['이미지목록','A1:L18','images.png'],
  ['교체후보','A1:L18','candidates.png'],
  ['개체목록','A1:L18','features.png'],
  ['미리보기','A1:L28','previews.png'],
  ['코드표','A1:F15','codes.png']
]) {
  const rendered = await wb.render({sheetName, range, scale: 1, format: 'png'});
  await fs.writeFile(path.join(qaDir, file), new Uint8Array(await rendered.arrayBuffer()));
}
const xlsx = await SpreadsheetFile.exportXlsx(wb);
await xlsx.save(outputPath);
console.log(JSON.stringify({output: outputPath, images: images.length, candidates: uniqueCandidates.length, features: features.length, previews: previews.length}));

// Reproduce the original manager diagram for the intro. Never read the commercial
// source workspace: the inputs below are the reviewed release and protected demo data.
// Generate: node tools/build-intro-diagram.mjs
// Verify:   node tools/build-intro-diagram.mjs --check
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {approvedIndex, dataFlowValues} from '../src/manager-core.js';
import {dataDiagramSVG} from '../src/manager-data-diagram.js';
import {maskUsage, maskSales} from '../src/data-quality.js';
import {esc} from '../src/experience-core.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const date = '2026-07-18', hour = 12;
const output = 'public/media/intro/data-pipeline.svg';
const sourceBytes = new Map();
const read = name => {
  if (!sourceBytes.has(name)) sourceBytes.set(name, fs.readFileSync(path.join(root, name)));
  return sourceBytes.get(name).toString('utf8');
};
const json = name => JSON.parse(read(name));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

assert(process.argv.slice(2).every(arg => arg === '--check'), 'Usage: node tools/build-intro-diagram.mjs [--check]');

const seed = json('server/data/workbench-seed.json');
const catalog = json('public/data/experience/catalog.json');
const network = json('public/data/experience/network.json');
network.headwayDwell = json('public/data/experience/headway-dwell.json');
const timeline = json('public/data/experience/timeline.json');
const usage = maskUsage(json('public/data/experience/usage.json'), catalog.dates);
const protectedSales = json('server/data/sales.json');
const validation = json('server/data/validation.json');
const approved = approvedIndex(json('public/data/jury-frozen/approved-facades.json').replacements);
const edgeValues = json('public/data/experience/flows/' + date + '.json')[hour];

assert.equal(seed.revision, 337, 'The intro uses the reviewed revision 337 release.');
assert.equal(catalog.revision, seed.revision);
assert.equal(network.revision, seed.revision);
assert(usage.basis.includes('가공값'), 'Use protected demo usage, never original business input.');
assert(protectedSales.basis.includes('패턴 보존 가공 매출') && protectedSales.basis.includes('원금액 아님'),
  'Use protected demo sales, never original business input.');
assert.deepEqual(usage.dates, catalog.dates);
assert.deepEqual(protectedSales.dates, catalog.dates);
const day = catalog.dates.indexOf(date);
assert(day >= 0 && timeline[date]?.entries?.[hour] && timeline[date]?.routes?.[hour] && edgeValues,
  'The reviewed release must contain every input for the snapshot date and hour.');
const approvedStoreIds = new Set(catalog.stores.map(store => store.id));
for (const id of [...Object.keys(usage.stores), ...Object.keys(protectedSales.stores)]) {
  assert(approvedStoreIds.has(id), 'Only approved stores may contribute to the aggregate.');
}

// Match /api/demo/register, /api/demo/points and the existing UI's data-quality masks.
const register = Object.fromEntries(['facilities', 'routes', 'connections', 'endpoints', 'origins']
  .map(kind => [kind, (seed.data[kind] || []).filter(record => record.active !== false)]));
const points = validation.points.filter(point => point.record_kind === 'walk_point')
  .map(point => [point.review_id, point.floor, ...point.geometry.coordinates]);
const sales = maskSales({date, stores: Object.fromEntries(Object.entries(protectedSales.stores)
  .map(([id, store]) => [id, {hourly: store.hourly[day]}]))}, usage, catalog.dates);
const values = dataFlowValues({catalog, network, timeline, usage, sales, register,
  overrides: {}, approved, points, date, hour, edgeValues});

// Extract the two original edge styles instead of creating a second visual design.
const managerCSS = read('src/manager-workbench.css');
const edgeStyles = ['dg-edge', 'dg-edge-label'].map(className => {
  const rule = managerCSS.match(new RegExp('\\.' + className + '\\{[^}]*\\}'))?.[0];
  assert(rule, 'Missing original .' + className + ' style');
  return rule;
}).join('\n');
const fontFamily = read('src/experience.css').match(/:root\{font-family:([^;]+);/)?.[1];
assert(fontFamily, 'Missing original manager font family');

// Fingerprint renderer/calculation sources as well as the data. The snapshot contains
// no wall-clock generation time, so --check is byte-for-byte deterministic.
for (const name of ['tools/build-intro-diagram.mjs', 'src/manager-data-diagram.js',
  'src/manager-core.js', 'src/crowd-core.js', 'src/experience-core.js', 'src/data-quality.js']) read(name);
const sources = Object.fromEntries([...sourceBytes].map(([name, bytes]) => [name, sha256(bytes)]));
const {perEndpoint, ...aggregates} = values;
const provenance = {
  schema: 1,
  snapshot: {date, hour, timeZone: 'Asia/Seoul'},
  sourceRevision: seed.revision,
  renderer: 'src/manager-data-diagram.js#dataDiagramSVG',
  calculator: 'src/manager-core.js#dataFlowValues',
  scope: 'Reviewed release; no browser-specific demo overrides. Aggregate values only.',
  usageBasis: usage.basis,
  usageHourlyBasis: usage.hourly_basis,
  salesBasis: protectedSales.basis,
  interpretation: '동시체류·이동량은 모형 추정값이며 고유 방문자 수가 아닙니다. 매장 이용은 결제건수 기준 가공값입니다.',
  aggregates,
  sources,
};
const original = dataDiagramSVG(values);
assert(original.startsWith('<svg ') && original.endsWith('</svg>'));
assert(!/undefined|NaN/.test(original), 'Snapshot values must be available.');
const openingEnd = original.indexOf('>');
const opening = original.slice(0, openingEnd).replace('<svg ',
  '<svg xmlns="http://www.w3.org/2000/svg" width="1380" height="610" ');
const svg = '<?xml version="1.0" encoding="UTF-8"?>\n' + opening + '>\n' +
  '<title>데이터 관계도 · ' + date + ' ' + hour + ':00 (Asia/Seoul)</title>\n' +
  '<desc>운영관리 원본 관계도의 정적 스냅샷. ' + esc(provenance.interpretation) + '</desc>\n' +
  '<metadata id="snapshot-provenance">' + esc(JSON.stringify(provenance)) + '</metadata>\n' +
  '<style>.data-diagram{font-family:' + esc(fontFamily) + '}\n' + edgeStyles + '</style>\n' +
  '<rect width="1380" height="610" fill="#fff"/>\n' + original.slice(openingEnd + 1) + '\n';

// Guard both the original diagram markup and every source file against mutation.
assert(svg.endsWith(original.slice(openingEnd + 1) + '\n'), 'Original nodes, links, labels and positions must remain intact.');
for (const [name, before] of sourceBytes) {
  assert(before.equals(fs.readFileSync(path.join(root, name))), name + ' changed while generating the snapshot.');
}
if (process.argv.includes('--check')) {
  assert.equal(fs.readFileSync(path.join(root, output), 'utf8'), svg,
    'Intro diagram is stale. Run node tools/build-intro-diagram.mjs');
  console.log('PASS: original manager diagram snapshot, source fingerprints and aggregate values match.');
} else {
  fs.mkdirSync(path.dirname(path.join(root, output)), {recursive: true});
  fs.writeFileSync(path.join(root, output), svg);
  console.log('Generated ' + output + ' (' + date + ' ' + hour + ':00 Asia/Seoul, ' + values.expected + ' people).');
}

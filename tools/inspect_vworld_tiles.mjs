const tilesetUrl = "https://cdn.vworld.kr/TDServer/services/map4/7Iuk64K0/S202103/tileset.json";
const response = await fetch(tilesetUrl);
if (!response.ok) throw new Error(`tileset ${response.status}`);
const tileset = await response.json();
const uris = [];
const visit = (tile) => {
  const uri = tile?.content?.uri || tile?.content?.url;
  if (uri?.endsWith(".b3dm")) uris.push(uri);
  (tile?.children || []).forEach(visit);
};
visit(tileset.root);

const sampleCount = Math.min(120, uris.length);
const sampled = Array.from({ length: sampleCount }, (_, index) => uris[Math.floor(index * uris.length / sampleCount)]);
const baseUrl = new URL("./", tilesetUrl);

function batchTable(buffer) {
  const bytes = Buffer.from(buffer);
  const uint = (offset) => bytes.readUInt32LE(offset);
  const featureJsonLength = uint(12);
  const featureBinaryLength = uint(16);
  const batchJsonLength = uint(20);
  const batchOffset = 28 + featureJsonLength + featureBinaryLength;
  const json = bytes.subarray(batchOffset, batchOffset + batchJsonLength).toString("utf8").trim();
  return json ? JSON.parse(json) : {};
}

const rows = [];
for (let index = 0; index < sampled.length; index += 12) {
  const batch = sampled.slice(index, index + 12);
  const results = await Promise.all(batch.map(async (uri) => {
    const tileResponse = await fetch(new URL(uri, baseUrl));
    if (!tileResponse.ok) return { uri, status: tileResponse.status };
    const table = batchTable(await tileResponse.arrayBuffer());
    return { uri, floor: table.FLOOR?.[0], site: table.SITE?.[0], model: table.MODEL_NAME?.[0] };
  }));
  rows.push(...results);
}

const counts = rows.reduce((map, row) => {
  const key = row.floor ?? `HTTP_${row.status}`;
  map[key] = (map[key] || 0) + 1;
  return map;
}, {});
console.log(JSON.stringify({ totalUris: uris.length, sampled: rows.length, counts, examples: rows.filter((row) => row.floor).slice(0, 25) }, null, 2));

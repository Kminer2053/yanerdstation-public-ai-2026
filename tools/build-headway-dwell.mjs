import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(import.meta.dirname, '../../outputs/20260913_seoul_station_footfall');
const FLOW_CSV = path.resolve(import.meta.dirname, '../../outputs/20260915_date_hour_footfall_69fd8c29/14_date_hour_flow.csv');
const POOL_DIR = path.resolve(import.meta.dirname, '../../outputs/20260916_daily_origin_pool_d9ccb5ff');
const OE_DIR = path.resolve(import.meta.dirname, '../../outputs/20260916_origin_entry_execution');

function parseCSV(filepath) {
  const text = fs.readFileSync(filepath, 'utf8').replace(/^﻿/, '');
  const [header, ...rows] = text.trim().split('\n');
  const cols = header.split(',');
  return { cols, rows: rows.map(r => r.split(',')) };
}

// ── 1. Bus stop → entrance mapping ──

function loadEntranceMap() {
  const oe = JSON.parse(fs.readFileSync(path.join(OE_DIR, 'origin-entries.json'), 'utf8'));
  const map = {};
  for (const o of oe.origins) {
    if (!o.id?.startsWith('BUS')) continue;
    const ars = o.id.replace('BUS-ARS-', '');
    const first = o.review_first_entry_id || '';
    map[ars] = (first.includes('G3') || first.includes('W-W')) ? 'west' : 'east';
  }
  return map;
}

// ── 2. GTX-A pool assumptions ──

function loadGtxAssumptions() {
  const pool = JSON.parse(fs.readFileSync(path.join(POOL_DIR, 'pool.json'), 'utf8'));
  const assumptions = pool.assumptions?.filter(a => a.model_id === 'GTX_PROXY_V1') || [];
  const get = id => assumptions.find(a => a.assumption_id === id)?.value;
  return {
    baseline: get('GTX_PROXY_V1.weekday_baseline') || 14300,
    arrivalShare: get('GTX_PROXY_V1.arrival_share') || 0.5,
    weights: Array.from({ length: 7 }, (_, i) => get(`GTX_PROXY_V1.weekday_weight_${i}`) || 14.286),
  };
}

// ── 3. Parse 14_date_hour_flow.csv → per-endpoint date×hour alightings ──

function loadFlowData(entranceMap) {
  const { cols, rows } = parseCSV(FLOW_CSV);
  const ci = c => cols.indexOf(c);
  const iDate = ci('date'), iHour = ci('hour'), iSeries = ci('series_id');
  const iMetric = ci('metric'), iValue = ci('value'), iInclude = ci('include_in_total');

  const seriesEndpointMap = {
    'SUBWAY-L1': 'subway_1',
    'SUBWAY-L4': 'subway_4',
    'SUBWAY-AREX': 'arex',
    'SUBWAY-GYEONGUI': 'gyeongui',
    'RAIL-PAX-KTX-FAMILY': 'ktx',
    'RAIL-PAX-KTX-EUM': 'ktx',
    'RAIL-PAX-ITX-MAEUM': 'ktx',
    'RAIL-PAX-ITX-SAEMAEUL': 'ktx',
  };

  // endpoint → date → hour[24]
  const data = {};
  const init = (ep, d) => {
    if (!data[ep]) data[ep] = {};
    if (!data[ep][d]) data[ep][d] = Array(24).fill(0);
  };

  for (const r of rows) {
    if (r[iMetric] !== 'passenger_alightings' || r[iInclude] !== 'Y') continue;
    const sid = r[iSeries], val = +r[iValue] || 0, h = +r[iHour];

    let ep = seriesEndpointMap[sid];
    if (!ep && (sid.startsWith('SEOUL-BUS-') || sid.startsWith('GG-BUS-'))) {
      const ars = sid.split('-').pop();
      const side = entranceMap[ars];
      if (side === 'east') ep = 'entrance_east';
      else if (side === 'west') ep = 'entrance_west';
    }
    if (!ep) continue;

    let dateStr = r[iDate];
    if (dateStr.startsWith('2025-07')) dateStr = '2026-07' + dateStr.slice(7);
    if (!dateStr.startsWith('2026-07')) continue;

    init(ep, dateStr);
    data[ep][dateStr][h] += val;
  }

  return data;
}

// ── Dwell seconds (timetable-derived, static) ──

const DWELL_SECONDS = {
  ktx:      [0,0,0,0,0,780,540,480,480,540,600,600,540,540,600,540,480,480,540,600,600,780,1200,0],
  subway_1: [240,1920,0,0,0,300,240,180,180,180,240,240,240,240,240,240,180,180,180,180,180,240,240,240],
  subway_4: [300,1920,0,0,0,720,240,180,180,180,240,240,240,240,240,240,240,180,180,180,180,180,240,240],
  arex:     [0,0,0,0,0,660,660,540,540,540,660,660,660,660,660,660,660,540,540,540,660,660,660,0],
  gyeongui: [0,0,0,0,0,1080,1080,660,660,660,1080,1080,1080,1080,1080,1080,1080,660,660,660,1080,1080,1080,0],
  gtx_a:    [0,0,0,0,0,660,420,360,360,420,480,480,480,480,480,480,420,360,360,420,480,480,660,0],
  entrance: Array(24).fill(180),
};

// ── Main ──

function main() {
  console.log('=== build-headway-dwell: 14_date_hour_flow.csv 직접 사용 ===\n');

  const entranceMap = loadEntranceMap();
  const eastCount = Object.values(entranceMap).filter(v => v === 'east').length;
  const westCount = Object.values(entranceMap).filter(v => v === 'west').length;
  console.log(`출입구 매칭: 동쪽 ${eastCount}개 / 서쪽 ${westCount}개 정류장`);

  const gtx = loadGtxAssumptions();
  console.log(`GTX-A: 평일 ${gtx.baseline}건/일 × 하차비 ${gtx.arrivalShare} = 하차 ${Math.round(gtx.baseline * gtx.arrivalShare)}/일\n`);

  const flowData = loadFlowData(entranceMap);
  console.log(`flow CSV 엔드포인트: ${Object.keys(flowData).join(', ')}`);

  const network = JSON.parse(fs.readFileSync('public/data/experience/network.json', 'utf8'));
  const timeline = JSON.parse(fs.readFileSync('public/data/experience/timeline.json', 'utf8'));

  const julyDates = [];
  for (let d = 1; d <= 31; d++) julyDates.push(`2026-07-${String(d).padStart(2, '0')}`);

  // GTX-A hourly proxy: sum all rail flow data to get hourly shape
  const railHourlyTotal = Array(24).fill(0);
  if (flowData.ktx) {
    for (const d of julyDates) {
      const hrs = flowData.ktx[d];
      if (hrs) hrs.forEach((v, h) => { railHourlyTotal[h] += v; });
    }
  }
  const railSum = railHourlyTotal.reduce((s, v) => s + v, 0) || 1;
  const railHourlyFrac = railHourlyTotal.map(v => v / railSum);

  // GTX-A daily alight calculation
  const gtxWeightSum = gtx.weights.reduce((s, w) => s + w, 0) || 100;
  const gtxMeanWeight = gtxWeightSum / 7;
  function gtxDailyAlight(dow) {
    const poolIdx = dow === 0 ? 6 : dow - 1;
    return Math.round(gtx.baseline * gtx.arrivalShare * (gtx.weights[poolIdx] / gtxMeanWeight));
  }

  const endpointMap = {
    'KTX&일반열차': 'ktx',
    '지하철 1호선 서울역': 'subway_1',
    'GTX-A 서울역': 'gtx_a',
    '지하철 4호선 서울역': 'subway_4',
    '공항철도 서울역': 'arex',
    '경의선 서울역': 'gyeongui',
    '서쪽출입구': 'entrance_west',
    '동쪽출입구': 'entrance_east',
  };

  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const output = {
    _source: '14_date_hour_flow.csv (IPF/RAS 분배 완료) + pool.json GTX-A 추정',
    _generated: new Date().toISOString().slice(0, 10),
    _note: 'ambient = 하차(alight only) − FROM 경로 합. GTX-A는 추정치, 철도 시간분포 대리.',
    endpoints: {},
  };

  for (const ep of network.endpoints) {
    const mode = endpointMap[ep.name];
    const dwellKey = mode === 'entrance_west' || mode === 'entrance_east' ? 'entrance' : mode;
    const dwell = DWELL_SECONDS[dwellKey] || DWELL_SECONDS.entrance;

    const dates = {};

    for (const dateStr of julyDates) {
      const dow = new Date(dateStr).getDay();
      let realHourly;

      if (mode === 'gtx_a') {
        const dailyAlight = gtxDailyAlight(dow);
        realHourly = railHourlyFrac.map(f => Math.round(dailyAlight * f));
      } else {
        realHourly = flowData[mode]?.[dateStr] || Array(24).fill(0);
      }

      const tl = timeline[dateStr];
      const modelHourly = [];
      for (let h = 0; h < 24; h++) {
        const vals = tl?.routes?.[h];
        let fromFlow = 0;
        if (vals) {
          network.routes.forEach((r, i) => {
            if (r.from_endpoint === ep.id) fromFlow += vals[i] || 0;
          });
        }
        modelHourly.push(Math.round(fromFlow));
      }

      const ambientHourly = realHourly.map((r, h) => Math.max(0, r - modelHourly[h]));
      const realTotal = realHourly.reduce((s, v) => s + v, 0);
      const modelTotal = modelHourly.reduce((s, v) => s + v, 0) || 1;
      const scale = Math.round((realTotal / modelTotal) * 100) / 100;

      dates[dateStr] = { real_hourly: realHourly, model_hourly: modelHourly, ambient_hourly: ambientHourly, scale };
    }

    const modeOut = dwellKey === 'entrance' ? 'entrance' : mode;
    const epOut = { name: ep.name, mode: modeOut, dwell_seconds: dwell, dates };

    if (mode === 'ktx') {
      const eastEp = network.endpoints.find(e => e.name === '동쪽출입구');
      const westEp = network.endpoints.find(e => e.name === '서쪽출입구');
      const sub1Ep = network.endpoints.find(e => e.name === '지하철 1호선 서울역');
      if (eastEp && westEp && sub1Ep) {
        epOut.ambient_split = {
          [eastEp.id]: 0.60,
          [sub1Ep.id]: 0.25,
          [westEp.id]: 0.15,
        };
        epOut._ambient_split_note = '동쪽60%:1호선방향25%:서쪽15% — 버스하차·도로용량·주간상주인구 다중proxy 종합';
      }
    }

    output.endpoints[ep.id] = epOut;

    const ref = dates['2026-07-18'];
    if (ref) {
      const rSum = ref.real_hourly.reduce((s, v) => s + v, 0);
      const mSum = ref.model_hourly.reduce((s, v) => s + v, 0);
      const aSum = ref.ambient_hourly.reduce((s, v) => s + v, 0);
      console.log(`${ep.name} (7/18 ${weekdays[new Date('2026-07-18').getDay()]}):`);
      console.log(`  하차: ${rSum.toLocaleString()} / 모델FROM: ${mSum.toLocaleString()} / 비환승: ${aSum.toLocaleString()} / ×${ref.scale}`);
    }
  }

  const outPath = 'public/data/experience/headway-dwell.json';
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
  console.log(`\n✓ ${outPath} (${sizeMB} MB, ${julyDates.length}일 × ${network.endpoints.length} 엔드포인트)`);
}

main();

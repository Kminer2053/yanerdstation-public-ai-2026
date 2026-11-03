# 서울역 디지털트윈 유동인구 데이터 파이프라인

> 최종 갱신: 2026-09-26  
> 대상 기간: 2026-07 (31일)

이 문서는 서울역 디지털트윈의 군중 시뮬레이션에 사용되는 유동인구 데이터의 수집, 통합, 빌드, 소비 전 과정을 기술한다. 데이터 모델을 정확히 이해하고 파이프라인을 유지보수하기 위한 정식 참조 문서이다.

---

## 목차

1. [원천 데이터](#1-원천-데이터)
2. [통합 일자x시간 데이터](#2-통합-일자x시간-데이터-14_date_hour_flowcsv)
3. [출입구-버스정류장 매칭](#3-출입구-버스정류장-매칭)
4. [GTX-A 추정](#4-gtx-a-추정)
5. [앱 데이터 파이프라인](#5-앱-데이터-파이프라인)
6. [알려진 문제점](#6-알려진-문제점)

---

## 1. 원천 데이터

경로: `outputs/20260913_seoul_station_footfall/`

### 1.1 subway_daily_seoul_202607.csv

| 항목 | 내용 |
|------|------|
| 구조 | `use_ymd, line, on, off` |
| 내용 | 서울역 지하철 4개선(1호선, 4호선, 경의선, 공항철도) 일별 승하차 |
| 기간 | 2026-07-01 ~ 2026-07-31 (31일 완비) |
| 출처 | 서울시 CardSubwayStatsNew |
| 등급 | M (Medium) |

### 1.2 kric_rail_seoul_monthly.csv

| 항목 | 내용 |
|------|------|
| 구조 | `use_mm, train_type, on, off` |
| 내용 | KRIC 철도 월간 열차종별 승하차 |
| 2026-07 합계 | 승차 1,804,328 / 하차 1,774,619 |
| 출처 | 한국철도공사 KRIC 통계 |

열차종 목록: KTX, KTX-산천, KTX-호남, KTX-이음, KTX-청룡, ITX-새마을, ITX-마음, 무궁화, 새마을

### 1.3 final/02_hourly_profile_202607.csv

| 항목 | 내용 |
|------|------|
| 구조 | `series, use_mm, hour, on, off, source, grade, note` |
| 내용 | 교통수단별 월간 시간대(0~23시) 합계 |

계열 구성:

| 계열 | 출처 | 등급 |
|------|------|------|
| 지하철 4개선 | 서울시 CardSubwayTime | M |
| 철도 6개 열차종(추정) | 열차운행정보 API x KRIC 월합계 배분 | D |
| 서울 시내버스 22정류장 합 | 서울시 OA-12913 | M |
| 경기 광역버스 정류장 합 | 경기데이터드림 | M |

### 1.4 final/11_rail_trains_daily_202607.csv

| 항목 | 내용 |
|------|------|
| 구조 | `run_ymd, departures, arrivals` |
| 내용 | 서울역 출발/도착 열차편수 일별 |
| 규모 | 평일 약 166~172편, 주말 약 188~195편 도착 |

---

## 2. 통합 일자x시간 데이터 (14_date_hour_flow.csv)

경로: `outputs/20260915_date_hour_footfall_69fd8c29/14_date_hour_flow.csv`

- 용량: 44MB, 53,761행
- 형식: long-format (한 행 = 하나의 교통수단 x 일자 x 시간 x 지표)

### 2.1 컬럼 구조

`target_period, date, hour, series_id, series_name, mode, metric, value, value_class, include_in_total, ...`

### 2.2 metric 종류

| metric | 의미 |
|--------|------|
| `passenger_alightings` | 하차 인원 |
| `passenger_boardings` | 승차 인원 |
| `train_arrivals` | 열차 도착 편수 |
| `train_departures` | 열차 출발 편수 |

### 2.3 커버리지 (include_in_total=Y, passenger_alightings 기준)

| 교통수단 | 계열수 | 일x시간 셀 | 기대(31x24) | 결측 | value_class |
|----------|--------|------------|-------------|------|-------------|
| 지하철 4개선 | 4 | 744/744 (100%) | 0 | DERIVED |
| 서울 시내버스 22정류장 | 22 | 744/744 (100%) | 0 | ESTIMATED |
| 경기 광역버스 6정류장 | 6 | 257~677/744 | 있음(비운행시간) | SUBSTITUTED |
| 철도 4종 | 4 | 330~589/744 | 있음(비운행시간) | DERIVED |
| GTX-A | 0 | 없음 | - | NOT_AVAILABLE |

### 2.4 value_class 정의

| 등급 | 설명 |
|------|------|
| OBSERVED | 원천에 일자+시간이 직접 기록된 값 |
| DERIVED | 관측 총량 + 시간분포 + 열차시각을 결합하여 산출. 지하철은 일별 총량(M)과 월간 시간대 총량(M)을 결합한 뒤 정수배분하고, 양 마진을 정확히 보존한다. |
| ESTIMATED | IPF/RAS로 날짜축을 추정. 서울 시내버스에 적용. 8월 일별 leave-one-out WAPE: 승차 5.35%, 하차 5.23%. |
| SUBSTITUTED | 2025-07 관측값을 2026-07 대체로 사용. 경기 광역버스에 적용. 요일 보정 없음. |
| NOT_AVAILABLE | 데이터 미확보 (GTX-A) |

### 2.5 검증 결과

**지하철**: 14_date_hour_flow.csv의 일별 합계가 subway_daily_seoul_202607.csv와 정수 단위까지 일치 (31일 모두 확인).

**철도**: KRIC 월합계와 정확히 일치.

| 열차 구분 | 하차 합계 | include_in_total |
|-----------|-----------|------------------|
| KTX 계열 | 1,454,036 | Y |
| KTX-이음 | 148,242 | Y |
| ITX-마음 | 32,925 | Y |
| ITX-새마을 | 56,654 | Y |
| **포함 소계** | **1,691,857** | **Y** |
| 무궁화 | 81,422 | N (저신뢰) |
| 새마을 | 1,340 | N (저신뢰) |
| **제외 소계** | **82,762** | **N** |
| **KRIC 합계** | **1,774,619** | 포함 1,691,857 + 제외 82,762 |

---

## 3. 출입구-버스정류장 매칭

경로: `outputs/20260916_origin_entry_execution/origin-entries.json`

48개 통계 발생원을 물리적 진입점(entry)에 매칭한다. 버스 23개 정류장은 동/서쪽 출입구로 분류된다.

### 3.1 동쪽 출입구 (ENTRY-G1/G2) - 14개 정류장

환승센터(02003~02007), 숭례문(02117, 02123), 서울스퀘어(02282), 남대문경찰서(02218), 서울역(02505, 02694), 갈월동(03011), 서울역11번출구(03198)

### 3.2 서쪽 출입구 (ENTRY-G3) - 9개 정류장

손기정체육공원(02102, 03228), 경기여상(02103), 서울역서부(02104~02106), 서계동(03124, 03125), 공항철도15번출구(03345)

### 3.3 7월 하차 합계 비중

| 방면 | 하차 합계 | 비중 |
|------|-----------|------|
| 동쪽 | 829,291 | 84% |
| 서쪽 | 155,862 | 16% |

---

## 4. GTX-A 추정

경로: `outputs/20260916_daily_origin_pool_d9ccb5ff/pool.json`

| 항목 | 값 |
|------|-----|
| 기준량 | 평일 14,300건/일 (승+하차 합) |
| 근거 | 국토부 보도자료: 북부구간 평일 45,600명/일 x 서울역 비중 31.4% |
| 신뢰도 | 약한 프록시 (실측 아님) |
| 하차비 | 0.5 가정 (하차 7,150/일) |

### 4.1 요일 가중치 (%)

| 월 | 화 | 수 | 목 | 금 | 토 | 일 |
|----|----|----|----|----|----|----|
| 14.075 | 14.075 | 14.075 | 14.075 | 16.4 | 16.3 | 11.0 |

### 4.2 시간 분포

일자x시간 분포는 미확보 상태(NOT_AVAILABLE)이다. 빌드 시 철도 시간대 분포(`railHourlyFrac`)를 대리(proxy)로 사용한다.

---

## 5. 앱 데이터 파이프라인

### 5.1 빌드 스크립트

`service/tools/build-headway-dwell.mjs`

**입력:**
- `14_date_hour_flow.csv` — 지하철·철도·버스 일자×시간 하차 (IPF/RAS 분배 완료)
- `pool.json` — GTX-A 추정 파라미터 (baseline, arrival_share, weekday weights)
- `origin-entries.json` — 버스정류장 → 동/서쪽 출입구 매칭
- `network.json` (8 endpoints, 56 routes)
- `timeline.json` (31일 시간대별 route values)

**출력:**
- `public/data/experience/headway-dwell.json`

### 5.2 headway-dwell.json 구조

```json
{
  "endpoints": {
    "OD-xxx": {
      "name": "KTX&일반열차",
      "mode": "ktx",
      "dwell_seconds": [24개 값],
      "dates": {
        "2026-07-01": {
          "real_hourly": [24개 값],
          "model_hourly": [24개 값],
          "ambient_hourly": [24개 값],
          "scale": 1.57
        }
      }
    }
  }
}
```

| 필드 | 설명 |
|------|------|
| `dwell_seconds` | 시간대별(0~23시) 체류 초수 (24개 배열) |
| `real_hourly` | 시간대별 실제 하차 인원 |
| `model_hourly` | FROM 경로 이동량 (시뮬레이션 모델이 소화하는 양) |
| `ambient_hourly` | max(0, real - model). 모델 경로에 배정되지 않은 잔여 인원 |
| `scale` | 보정 배율 |

### 5.3 8 Endpoints

| 엔드포인트 | mode | 하차 원천 | 일평균 하차 |
|------------|------|-----------|-------------|
| KTX&일반열차 | `ktx` | KRIC 월합계 x 일별 열차도착수 팩터 | 57,246 |
| 지하철 1호선 서울역 | `subway_1` | subway_daily off | 76,171 |
| 지하철 4호선 서울역 | `subway_4` | subway_daily off | 22,233 |
| 공항철도 서울역 | `arex` | subway_daily off | 12,881 |
| 경의선 서울역 | `gyeongui` | subway_daily off | 3,654 |
| GTX-A 서울역 | `gtx_a` | pool assumptions | 7,150 (평일 하차) |
| 동쪽출입구 | `entrance` | 버스 하차 14정류장 | 26,751 |
| 서쪽출입구 | `entrance` | 버스 하차 9정류장 | 5,027 |

### 5.4 ambient 계산 로직

`src/crowd-core.js`의 `crowdComposition()`에서 합산:

```
ambient = real_hourly - model_hourly   (하차만, FROM 경로만 차감)
```

- 단위 주의: `ambient_hourly`는 **시간당 인원(흐름)**인데 현재 동시체류(재실)에 그대로 더한다. 즉 미배정 하차 인원이 1시간 내내 머문다고 가정한 값이며, 2026-07-18 12시 기준 추정 8,082명 중 6,392명이 이 항이다. 체류시간을 곱해 재실로 환산할지 결정 필요.
- 모든 엔드포인트의 ambient가 가상 보행자로 표시된다(아래 5.6 참조).

### 5.5 KTX ambient 3방향 분배 (ambient_split)

KTX 비환승 하차 인원은 동쪽출입구·1호선 방향·서쪽출입구 3개 방향으로 가중 배분된다.

| 방향 | 비중 | 목적지 endpoint |
|------|------|-----------------|
| 동쪽출입구 | 60% | `OD-db3fedcc-…` (entrance) |
| 지하철 1호선 방향 | 25% | `OD-f2e5f50e-…` (subway_1) |
| 서쪽출입구 | 15% | `OD-e447d95b-…` (entrance) |

**근거 (다중 프록시 종합):**

| 프록시 | 동쪽 | 서쪽 | 출처 |
|--------|------|------|------|
| 버스 하차 비중 | 84% | 16% | origin-entries.json (14:9 정류장) |
| 간선도로 용량 | 71% | 29% | 세종대로·한강대로(동) vs 만리재로(서) 차로수 비교 |
| 주간 상주인구 | 67% | 33% | 행정동별 주간상주인구 (서울시 2025) |
| 주민등록인구 | 22% | 78% | 회현동 vs 중림·만리동 (서울시 2025) |

주민등록인구는 방향이 반대(서쪽 과다)이므로 가중치를 낮춰 반영. 최종 분배는 동쪽 60%, 1호선 방향(동쪽 지하 연결) 25%, 서쪽 15%.

**한계:** 직접적인 KTX 하차 후 이동경로 설문·조사 데이터 없음. 주변 간접지표 조합이므로 향후 실측 확보 시 교체 필요.

**구현:** `build-headway-dwell.mjs` line 207~219에서 `ambient_split` 객체를 KTX endpoint에 기록 → `experience.js` line 95에서 `ambientSplit`으로 scene iframe에 전달 → `app/crowd-layer.js` `spawnWanderer()`에서 방향 가중치로 경로를 고른 뒤 그 경로 주변에 배치.

### 5.6 앱 데이터 흐름

```
1. experience.js:161
   └─ headway-dwell.json 로드

2. experience.js:95
   └─ endpoint별 date x hour ambient 읽기
   └─ postMessage로 scene iframe 전달

3. src/crowd-core.js crowdComposition()
   └─ 보행(엣지 통과량 × 통과시간) + 체류(경로량 × 출도착 체류초) + ambient 합산 = expected

4. app/crowd-layer.js (가상 보행자 표시)
   └─ 보행 몫: 경로량 가중으로 경로 선택, 경로 좌우 여유폭(2m 보행 격자 기준, 벽에서 1m 여유) 안에서 차선을 나눠 이동
   └─ 체류 몫: 출도착 영역 안 보행 가능 지점 주변을 배회·대기
   └─ ambient 몫: 해당 엔드포인트에서 출발하는 경로 주변(KTX는 ambient_split 방향) 보행 가능 지점에서 배회
   └─ 모든 이동 구간은 직선이 보행 격자 위에 머무는지 검사(벽·빈 공간·다른 층 제외)
   └─ 표시: 카메라 시야 안에서 가까운 인원부터 사람 모델, 성능 한도를 넘는 나머지는 같은 옷 색 점
   └─ 사람 모델 수는 실제 프레임 시간에 맞춰 자동 조절(데스크톱 40~600, 모바일 24~160), 서 있거나 90m 밖은 걷기 애니메이션 정지
```

### 5.7 dwell_seconds 산출 방식

| 교통수단 | 산출 방법 |
|----------|-----------|
| 지하철 | SearchSTNTimeTableByFRCodeService API에서 시간대별 열차편수 계산. headway = 60분 / 편수, dwell = headway/2 + platformWalk |
| KTX/GTX/AREX | 공표 시간표 기반 headway |
| 출입구(버스) | 고정 180초 |

현재 값은 정적(timetable 기반)이며, 빌드 시 재계산하지 않고 기존 값을 보존한다.

---

## 6. 알려진 문제점

### (해결) 빌드 스크립트의 시간 분배 정합성

빌드 스크립트가 `14_date_hour_flow.csv`를 직접 파싱하여 사용한다 (2026-09-23 전환 완료). IPF/RAS 분배된 일자×시간 셀을 그대로 소비하므로, 이전의 daily×monthly_fraction 조잡 분배 문제가 해소되었다.

검증 결과: 지하철 4선 일별 합계 원천 일치, KTX 월합 오차 0.19% (정수배분 반올림), 출입구 오차 0.003% 이내.

### GTX-A 데이터 한계

- 일자x시간 분포가 미확보 상태(NOT_AVAILABLE)이며, 철도 시간대 분포를 대리로 사용하고 있다.
- 기준량 자체가 약한 프록시(국토부 북부구간 보도자료 기반 추정)이므로, 실측 데이터 확보 시 교체가 필요하다.

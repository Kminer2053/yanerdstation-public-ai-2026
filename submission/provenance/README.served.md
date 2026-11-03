<div align="center">

# 야!너두 스테이션 · Ya! Nerd Station

### VWorld 실내 3D 지도 위에 현장 변화·유동·매출 데이터를 연결하는 참여형 디지털트윈

지도 현행화 → 3D 내비 → 유동인구 분석 → 매출 연계까지, *함께 만들고 계속 최신으로*

<br/>

![VWorld](https://img.shields.io/badge/공간원본-VWorld%203D%20Tiles-0A5EB0)
![CesiumJS](https://img.shields.io/badge/렌더러-CesiumJS%201.142-3F4F75)
![Vite](https://img.shields.io/badge/빌드-Vite%208-646CFF)
![Supabase](https://img.shields.io/badge/서울DB-Supabase-3FCF8E)
![Sites](https://img.shields.io/badge/호스팅-ChatGPT%20Sites-10A37F)
![역](https://img.shields.io/badge/실내지도-46개%20KTX역-D4A843)

**[프로젝트 소개](https://yanerdstation.kr)** · **[서울역 프로토타입](https://seoul.yanerdstation.kr/seoul)** · **[공개 편집기](https://toolkit.yanerdstation.kr)** · **[편집기 GitHub](https://github.com/Kminer2053/ya-nerd-station)**

</div>

---

전국 46개 KTX역에 존재하는 VWorld 실내 3D 지도를 기본 모델로 사용하고, 원본을 다시 만드는 대신 **현장에서 바뀐 시설·파사드·동선·데이터를 별도 변경 레이어**로 관리합니다. 제8회 공간정보 활용·아이디어 경진대회 출품작입니다.

- **공간 원본은 VWorld** · 서울역KTX `S202103` · 대전역KTX `S201801` 3D Tiles를 실시간 로딩
- **현장 현행화** · 사진 파사드 교체·매장 이전·부스 철거 등 현장 변경을 삼각형 단위 셰이더와 피처 레벨 숨김으로 반영
- **세 이용자, 세 화면** · 같은 공간 위에 철도이용객·사업자·철도기관 각각이 필요한 답을 보여줌
- **공개 편집기** · 46개 역에 동일한 편집 스키마를 적용하는 독립 도구 ([ya-nerd-station](https://github.com/Kminer2053/ya-nerd-station))

---

## 두 가지 이름

| 이름 | 역할 |
|---|---|
| **Station One** | 디지털트윈 구현 완료 프로토타입 시리즈명 — Station One 서울역, Station One 대전역 등 |
| **야!너두 스테이션** | 전체 프로젝트명이자 공개 편집기 서비스명. "다음 역은 너두 만들 수 있도록" |

---

## 세 가지 화면 — 같은 공간, 다른 답

### 이용자별 기능

| 이용자 | 화면 | 경로 | 핵심 기능 |
|---|---|---|---|
| **철도이용객** | 3D내비 (모바일) | `/seoul/?role=visitor` | 출발점 선택 → 시설 탐색 → 경로 따라걷기 · 보행효과 · 가상 보행자 |
| **사업자** | 역내상권분석 (데스크톱) | `/seoul/?role=business` | 구역별 유동 흐름 · 매장 실적 비교 · 객단가·마진 가정 시뮬레이션 |
| **철도기관** | 운영관리 (데스크톱) | `/seoul/?role=manager` | 다층 이동 지표 · 시설·경로·데이터 관리 · 시연 수정본 저장 |

### 공통 기반

| 기능 | 파일 | 설명 |
|---|---|---|
| 3D 경험 씬 | `app/experience-scene.js` | 군중 시뮬레이션 · 유동 화살표 · 공간 매출 라벨 · 따라걷기 카메라 |
| 방문 여정 | `src/visitor-journey.js` | 출발점 선택 · 순간이동 · 보행효과 · 가상 보행자 분산 |
| 소매 분석 | `src/experience-analytics.js` · `src/feedback-core.js` | 시간별·일별 바 차트 · 수익·손익분기 계산 · 실내외 좌표 판정 |
| 공간 구역 | `src/spatial-analysis.js` · `src/audience-workspaces.js` | 홀 동/중/서 · 브릿지 · 플랫폼 구역 정의 · 구역별 통행량 · 관리 탭 |
| 카메라 비교 | `src/camera-comparison.js` | 실시간 카메라(getUserMedia)와 디지털트윈 비교 — 데이터는 기기 밖으로 나가지 않음 |

---

## 서비스 주소

| 도메인 | 역할 | Sites 주소 |
|---|---|---|
| [yanerdstation.kr](https://yanerdstation.kr) | 프로젝트 소개 (8장 슬라이드) | station-one-collab.soalsebi.chatgpt.site |
| [seoul.yanerdstation.kr/seoul](https://seoul.yanerdstation.kr/seoul) | Station One 서울역 | 위와 동일 프로젝트 |
| [seoul.yanerdstation.kr/commons/](https://seoul.yanerdstation.kr/commons/) | COMMONS · 2·3층 경량 탐색·공유방 | 위와 동일 프로젝트 |
| [toolkit.yanerdstation.kr](https://toolkit.yanerdstation.kr) | 공개 편집기 | ya-nerd-station.soalsebi.chatgpt.site |

---

## COMMONS — 서울역 2·3층을 가볍게 함께 둘러보기

`/commons/`는 기존 정밀 서비스와 분리한 Three.js 체험이다. 실행 중 원본 3D Tiles를 받지 않고, 관측 캐시의 실제 건축 구조·마감과 등록된 현재화 사진을 경량 자산으로 재구성한다.

| 항목 | 범위 |
|---|---|
| 등록 보행점 | 2층 3,137개 + 3층 625개 = 3,762개 |
| 승인 파사드 | 2층 51면 + 3층 8면 = 59면 전수, 형상 누락·범위 제외 0건 |
| 시설 등록부 | 2층 54곳 + 3층 7곳 = 61곳 |
| 현재화 구조물 | 안내시설·이전 매장 부스·사진부스·개구부 난간 등 custom 자산 12개 |
| 층간 등록 연결 | 에스컬레이터 7개·계단 3개, 단방향 6개·양방향 4개 |

custom 자산은 기존 시설 ID와 연결하며, 61곳과 12개를 합쳐 고유 시설 수로 세지 않는다. 제보 초안에만 있는 **AI 역무원 키오스크는 최종 승인된 공개 형상이 없어 제외**한다. 미등록 영업정보·상품·운영시간을 만들어 채우지 않는다.

- **층·시설 선택:** 2층·3층 시작점이나 선택한 시설 가까운 유효 보행 지점으로 이동한다. 시설 목록은 층별로 고를 수 있다.
- **조망에서 위치 선택:** 표시된 보행 지점을 누르고 확인하면 그곳에서 걷는다. 공유방에서는 서버가 등록 `pointId`·층·좌표·충돌 경계를 검증한다.
- **층간 이동:** 연결점 1.8m 이내에서 Enter 또는 모바일 버튼으로 등록 경로를 따라 이동한다. 원본 연결의 `sourceStatus: draft`를 보존하고 화면에는 **‘등록 연결’**로 표시한다. 현장 검수 완료나 새 승인을 의미하지 않는다.
- **단절된 구역:** 원본 보행 그래프는 2층 57개·3층 13개 영역으로 나뉜다. 일반 경유점 누락 때문에 끊긴 것은 아니며, 등록 디딤판 경로는 보존한다. 임의의 벽 통과·통로 연결 대신 위치 선택 이동으로 접근한다.
- **화질과 부하:** 먼 면은 공통 atlas, 가까운 사진은 크기를 제한한 상세 이미지로 표시한다. 모바일·PC 각각의 상세 텍스처 수를 제한하고 멀어지면 GPU 자원을 해제한다.
- **공유방:** 명시적으로 입장한 사람끼리 층·가상 위치·방향·동작을 약 1.2초 간격으로 공유한다. 기존 Sites Worker·D1을 쓰는 방당 20명·20분 시험 운영이며, 혼자 보기는 presence DB를 사용하지 않는다. 출발 층의 미확인 경로를 동기화한 뒤 이동하고 재전송·이동 실패도 서버 상태와 맞춘다.

현재 등록 자료를 바탕으로 한 체험으로, 서울역 전 공간의 실측이나 실제 운행·통행 상태를 보증하지 않는다. 실제 안내는 기존 3D내비에서 확인한다. [범위·이동 계약·검증·재생성 절차](docs/release-commons-2026-11-01.md)에 상세 기준을 정리했다.

---

## 저장소 구조

```
service/
├── index.html                     프로젝트 소개 슬라이드 (8장)
├── app/
│   ├── index.html                 CesiumJS 3D 뷰어 · Station One 렌더러
│   ├── app.js                     메인 오케스트레이터: 모든 Seoul 모듈·Supabase·층 관리 연결
│   ├── experience-scene.js        군중 시뮬레이션·유동 화살표·따라걷기 3D 씬
│   ├── map-load-lifecycle.js      VWorld 로딩 타임아웃(30초)·에러·폴백
│   ├── approved-replacement-surface.js   사진 파사드 코플래너 표면 렌더
│   ├── seoul-vworld-retirement.js 전체 은퇴 셰이더 통합 (Cesium은 tileset당 1개만 허용)
│   ├── seoul-truedan.js           TRUEDAN 매장 사진 파사드 리노베이션
│   ├── seoul-information-zone.js  2F 안내구역 재구성 (5개 시설)
│   ├── seoul-*-retirement.js      celadon·dessert·lounge·pergola·photobooth·platform111·S38·wood 은퇴
│   ├── seoul-s11-booths.js        S11 부스 이전·현행화
│   ├── seoul-train-mates.js       TRAIN MATES 파사드
│   ├── seoul-platform111.js       플랫폼 111 시설·미디어 표면
│   └── toolkit-scene.js           편집기 postMessage 연동 (읽기 전용)
├── seoul/
│   └── index.html                 3대 이용자 UX · 시설 검색 · 역할 전환
├── commons/
│   └── index.html                 2·3층 경량 탐색 · 층·시설·위치 선택 · 공유방
├── catalog/
│   └── index.html                 파사드 협업 카탈로그 (익명 Supabase 세션)
├── routes/
│   └── index.html                 경로·포인트·진입점 검토
├── src/
│   ├── experience.js              서울역 메인 UI: 시설·검색·층·역할·날짜·경로·매출
│   ├── experience-core.js         유틸: HTML 이스케이프·좌표 거리·하늘색·경로 안내문
│   ├── experience-analytics.js    바 차트·근접 유동·소매 분석 패널
│   ├── feedback-core.js           수익 시나리오·실내외 판정·군중 예산
│   ├── catalog-workbench.js       파사드 사진 교체·검수 워크플로우 (Supabase 스토리지)
│   ├── point-review.js/.css       포인트 그리드·경유·접속·시설 관리
│   ├── route-review.js/.css       원점·모드별 경로 시퀀스·노드 검사
│   ├── location-workbench.js/.css 그리드·연결·원점·엔드포인트·경로·시설 통합 워크벤치
│   ├── origin-*.js                유동인구 원점 추출·배분·편집기
│   ├── spatial-analysis.js        공간 구역 정의·통행량·성과 표
│   ├── audience-workspaces.js     구역별 소매 비교·관리 탭
│   ├── visitor-journey.js         3D내비 여정: 출발점·순간이동·보행효과·군중 상태
│   ├── presentation.js/.css       소개 슬라이드 컨트롤러 (키보드·전체화면)
│   ├── commons.js/.css            경량 탐색 UI · 2·3층 이동 · 모바일 조작
│   ├── commons-world.js           Three.js 건축·파사드·아바타 렌더링
│   ├── commons-core.js            층별 보행·충돌·등록 연결·경로·이동 보간
│   ├── commons-presence.js        공유방 순번·출발 경로 ACK · 이동 동기화
│   ├── commons-custom.js          기존 현재화 모듈의 구조물·사진 표시
│   ├── supabase-client.js         Supabase 클라이언트 (카탈로그 CRUD)
│   └── replacement-surface-contract.js   코플래너 표면 배치 WGS84 기하
├── server/
│   ├── index.js                   Workers fetch 핸들러: 라우팅·CORS·보안·도메인 분기
│   ├── api.js                     API: 카탈로그·세션·시드·판매·검증·데모 서브라우트 (D1)
│   ├── demo.js                    심사 시연: 비밀번호 보호·브라우저별 D1 초안
│   ├── commons.js                 임시 공유방 API · 층·지점·연결·재전송 검증
│   ├── map-source.js              VWorld 타일 읽기 전용 프록시 (S202103·S201801만 허용)
│   ├── toolkit.js                 편집기 CORS JSON 응답 헬퍼
│   ├── toolkit-configurations.js  20+ 서울 현장변경 설정을 편집기 API로 노출
│   └── data/                      sales.json · validation.json · workbench-seed.json
├── toolkit/                       공개 편집기 (별도 리포 싱크 → ya-nerd-station)
├── supabase/
│   ├── config.toml                API 54321 · DB 54322
│   └── migrations/                28개 SQL 마이그레이션 (2026-09-01 ~ 09-15)
├── tools/                         32개 테스트·빌드 스크립트
├── docs/                          27개 운영·검증·현장 문서
├── db/schema.ts                   D1 스키마 (drizzle-orm)
├── drizzle/                       생성된 마이그레이션 SQL
├── dist/                          Vite 빌드 출력 + esbuild Worker 번들
└── public/                        정적 자산 + 데이터 JSON
```

---

## 실행

```bash
npm ci
npm start                          # http://127.0.0.1:4173/app/
```

협업 카탈로그 (Supabase 연결):

```bash
cp .env.example .env.local         # VITE_SUPABASE_URL · VITE_SUPABASE_PUBLISHABLE_KEY 입력
npm run dev:collab                  # http://127.0.0.1:4174/
```

공개 편집기:

```bash
cd toolkit && npm ci && npm run dev # http://127.0.0.1:4197/
```

VWorld 3D Tiles와 CesiumJS를 사용하므로 **인터넷 연결이 필요**합니다. `.env.local`의 `VITE_` 변수는 브라우저에 노출되므로 관리자 비밀키를 넣지 마세요.

COMMONS 격리 미리보기는 `npm run preview:commons`로 실행한 뒤 `http://127.0.0.1:4210/commons/`에서 확인합니다. 로컬 파생 자산과 메모리 SQLite를 사용하므로 원본 VWorld 접속과 기존·외부 API 없이 시험할 수 있습니다.

---

## 검증

```bash
npm test                           # Playwright 통합: 앱 구조·렌더·인터랙션
npm run test:experience            # 3대 이용자 UX 경험 씬
npm run test:collab                # 협업 카탈로그 빌드
npm run test:truedan               # TRUEDAN 파사드 리노베이션
npm run test:information-zone      # 2F 안내구역 재구성
npm run test:catalog               # 카탈로그 저장소 연산
npm run test:object-slots          # 오브젝트/텍스처 슬롯 배정
npm run test:f02wl072-frame        # F02WL072 간판 프레임 기하
npm run test:replacement-surfaces  # 교체 표면 기하
npm run test:public-collab         # 익명 Supabase 협업
npm run test:commons               # 전체 2·3층 · 파사드 · 충돌 · 등록 이동 · 공유방
cd toolkit && npm test             # 편집기: 메모리 저장소·CRUD·검증·충돌 감지
```

32개 테스트 파일이 각 서울 현장변경(celadon·dessert·lounge·pergola·photobooth·platform111·S11·S38·train-mates·wood-display·GTX·guardrail), 포인트 리뷰, 경로 리뷰, 원점 진입, 공간 워크스페이스를 개별 검증합니다.

---

## 현재 구현 — Station One 서울역

| 항목 | 수량 | 비고 |
|---|---|---|
| 승인 파사드 | 94건 (이미지 80개, ~45.5MB) | 현장 사진 기반 교체 |
| 현장 변경 구성 | 21건 | 삼각형 셰이더·피처 숨김·대체 구조물 |
| 시설 등록 | 281건 (활성 115건) | 매장·편의·안내 시설 |
| 출도착점 | 8곳 | 원점 영역(폴리곤) 포함 |
| 층간연결 | 84개 | 에스컬레이터·엘리베이터 N:N |
| 경로 | 28개 | 층 전환 시 연결점 검증 |
| 데이터 원점 | 48개 (전체 53) | 지하철·KTX·GTX·택시·주차장 |
| 일별 관측 | 1,488건 | 관측/추정 구분·근거 기재 |
| 심사 잠금 | revision 337 | 서버 저장·업로드 차단, JSON 내보내기 허용 |

### 현장 현행화 방식

원본 3D 모델의 메시를 직접 수정하지 않습니다. Cesium은 tileset당 커스텀 셰이더를 하나만 허용하므로, `seoul-vworld-retirement.js`가 모든 은퇴 마스크(TRUEDAN·celadon·S38·wood-display·lounge-sign·photobooth-charger·dessert-banner·platform111·S11·pergola 등)를 하나의 GLSL 셰이더로 합성합니다. 피처 레벨 숨김은 Cesium 스타일 조건으로, 삼각형 단위 은퇴는 B3DM 디코딩된 정점 좌표 범위의 프래그먼트 셰이더 `discard`로 처리합니다.

---

## 데이터 구분

| 구분 | 출처 | 비고 |
|---|---|---|
| 공간 형상 | VWorld 실내 3D 원본 | 정밀 뷰어는 읽기 전용 프록시 · COMMONS는 관측 자료의 경량 파생 메시·atlas |
| 유동인구 | 공공데이터 (지하철 CardSubwayTime·KTX 시간대별) + 추정 | GTX·택시·주차장은 추정, 기준 공개 |
| 매출·시설 | 가공·비식별화 수치 | 결제건수 기반 이용인원, 고유 방문자 수 아님 |
| 보행 시뮬레이션 | 경로 주변 보행점 분산 | 실시간 측위·실시간 혼잡 관제 아님 |

---

## 서버 API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|---|---|---|
| `/api/seoul/snapshot` | GET | 서울역 revision 337 읽기 전용 스냅샷 (423 on write) |
| `/api/seoul/hourly?origin=ID` | GET | 원점별 시간대 유동 데이터 |
| `/api/map-source/:stationId/:tile` | GET | VWorld 3D Tiles 읽기 전용 프록시 (5분 캐시) |
| `/api/projects` | GET/POST | 프로젝트 목록 조회 / 생성 (편집기용) |
| `/api/projects/:id` | GET/PUT | 프로젝트 조회 / 수정 (revision 충돌 감지 409) |
| `/api/projects/:id/files` | POST | 파사드 이미지 업로드 (PNG/JPEG, 4MB, 프로젝트당 100장) |
| `/api/files/:fileId` | GET | 업로드 이미지 서빙 (R2) |
| `/api/commons/join` | POST | 임시 공유방 입장 · 공간 버전·정원 검증 |
| `/api/commons/sync` | POST | 층·보행 경로·등록 지점/층간 이동 · 순번·충돌 검증 |
| `/api/commons/leave` | POST | 자기 임시 참가 상태 제거 |

보안: CSRF Origin 검사 · SHA-256 쿠키 소유자 인증 · 서울역 심사 잠금 전 경로 쓰기 차단.

---

## 브랜치

| 브랜치 | 상태 | 내용 |
|---|---|---|
| `main` | Sites v46 배포 | 기본 앱 동작 유지 |
| `codex/final-three-audience-service` | **최신** | 3대 이용자 UX · 편집기 · 46개역 카탈로그 · 현장변경 21건 |
| `codex/vworld-connectivity` | 미배포 | VWorld CDN 장애 대응 — `withDeadline` 30초 타임아웃·`firstVisibleTile`·`MapLoadError`·폴백 UI |
| `codex/offline-route-editor` | 미배포 | VWorld 무의존 로컬 타일 모드 — VWorld 요청 0건 확인 |
| `codex/map-loading-entry-review` | 미배포 | 진입점 표시·지도 로딩 시간 제한 |

---

## 기술 스택

| 구성 | 기술 |
|---|---|
| 3D 렌더링 | 정밀 서비스: CesiumJS 1.142 · VWorld 3D Tiles / COMMONS: Three.js 경량 파생 자산 |
| 빌드 | Vite 8 · esbuild (서버 Worker 번들) |
| 서울역 DB | Supabase (PostgreSQL · Storage · 익명 세션) |
| 편집기 DB | Cloudflare D1 (SQLite) · R2 (업로드) · drizzle-orm |
| 호스팅 | ChatGPT Sites (Cloudflare Workers) |
| 테스트 | Playwright · Node.js 내장 assert |
| 이미지 | sharp (파사드 전처리) |

---

## Supabase 마이그레이션

28개 SQL 마이그레이션 (`supabase/migrations/`, 2026-09-01 ~ 09-15):
`station_one_collab` → `catalog_seed` → `storage_paths` → `public_anonymous_editing` → `object_texture_workbench` → 좌표·카메라·UV·대전 보정 → `truedan_facade` → `replacement_canvas` → `surface_placements` → `frame`·`facade`·`orientation`·`information_zone` → `S11`·`train_mates`·`information_center` → `platform111_facility` → `photobooth_facility`.

---

## 문서 (`docs/`)

| 문서 | 주제 |
|---|---|
| `PROJECT_OPERATIONS.md` | 운영·브랜치·소스 보존 기준 |
| `HOSTING_REVIEW_2026-09-16.md` | 호스팅 플랫폼 검토 |
| `FINAL_SERVICE_2026-09-18.md` | 3대 이용자별 최종 서비스 정의 |
| `VWORLD_CONTEST_PLAN.md` | 제8회 공간정보 경진대회 대응 계획 |
| `feedback-local-validation-2026-09-18.md` | 로컬 검증 인계 절차 |
| `release-generic-toolkit-2026-09-18.md` | 편집기 독립 릴리즈 · 도메인 계획 |
| `release-commons-2026-11-01.md` | 전체 2·3층 경량 공간 · 등록 연결·위치 선택 · 공유방 |
| `seoul-truedan-renovation.md` | TRUEDAN 매장 현행화 구조 |
| `seoul-information-zone.md` | 2F 안내구역 재구성 명세 |
| `seoul-celadon-retirement.md` ~ `seoul-wood-display-retirement.md` | 10개 현장변경 개별 명세 |
| `vworld-seoul-station-indoor-structure-*.md` | VWorld 실내 좌표·오브젝트·텍스처 구조 분석 |

---

## 주의사항

- 인증키(`디지털트위관련 공공키.txt`)는 `.gitignore` 처리. 저장소에 포함하지 않음
- `.env.local`의 Supabase URL·key는 publishable key만 사용. 관리자 비밀키 금지
- VWorld 3D 데이터의 재이용·시연 범위는 운영기관 확인 필요
- 영업 원자료·개인 사진 원본·3D 원본 타일은 저장소에 없음
- `data-private/`(SQLite·업로드)는 gitignore 대상
- 시연용 비밀번호 `station2026`은 보안 수단이 아님

---

## 문의

야!너두 스테이션 · park2053@gmail.com

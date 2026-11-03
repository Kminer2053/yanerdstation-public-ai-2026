# Supabase 해지 체크리스트 · 2026-09-27

## 결론

운영 화면은 이제 Supabase를 쓰지 않는다. 서울역은 심사 고정본(정적 파일), 대전역과 이후 역의 승인 파사드는 공개 편집기(toolkit, Sites D1/R2)의 공개 API에서 읽는다. Supabase에만 있던 데이터는 로컬에 보관했다. 아래 순서대로 배포·확인한 뒤 일시중지 → 삭제하면 된다. 삭제는 되돌릴 수 없으므로 사람이 직접 한다.

## Supabase에 있던 것 (2026-09-27 조회)

| 구분 | 행 수 | 처리 |
|---|---|---|
| 객체 슬롯 파사드 교체본 `object_slot_replacement_versions` | 111 (전부 서울역, 승인 94) | 승인 94장은 `public/data/jury-frozen/`에 고정본으로 이미 있음. 111건 전체와 이미지 49MB를 보관 |
| 이미지 단위 교체본 `replacement_versions` | 0 | — |
| 작업 상태 `object_slot_work_items` / `catalog_work_items` | 4,675 / 2,007 | 보관 |
| 댓글 `catalog_comments` | 0 | — |
| 매니페스트 `catalog_manifests` | 2 | 보관 |
| 작업자 `profiles` | 372 (대부분 익명 방문자) | 이메일 없이 보관 |
| 시드 `object_texture_slots` / `image_occurrences` / `feature_placements` | 4,675 / 4,063 / 2,604 | 보관하지 않음 — `supabase/migrations`와 로컬 VWorld 카탈로그 출력으로 다시 만들 수 있음 |

대전역은 슬롯 1,433개가 있었지만 파사드 교체본은 **0건**이라 옮길 데이터가 없었다.

## 코드에서 끊은 곳

- `app/app.js`: 서울역 외 역의 승인 파사드를 Supabase 대신 편집기 `GET /api/public/station?key=…`의 `overlays`에서 읽는다(5분마다 다시 읽음). 익명 로그인·실시간 구독을 없앴고, 지도 페이지는 `supabase-client`를 가져오지 않는다.
- 편집기: 공개 조회와 승인 이미지에 `Access-Control-Allow-Origin: *`(쿠키 없는 공개 자료만). 다른 곳에서 승인된 파사드는 승인자 전용 `POST /api/console/import-facade`로 가져온다(규격 픽셀 일치, 출처 ID 기준 중복 방지).
- `/catalog`, `/routes`는 이미 편집기로 302 이동한다. 예전 작업대 코드(`catalog/`, `routes/`, `src/catalog-workbench.js`, `src/supabase-client.js`)는 아직 저장소에 남아 있다.

## 보관본

- 위치: `../tmp/supabase-archive-20260927/` (루트 저장소에서 추적되지 않는 `tmp/` 폴더 — 커밋하지 말 것)
- 내용: 표별 JSON, `images/`(교체본 111장), `report.json`(행 수·용량)
- 다시 만들기: `node tools/archive-supabase.mjs` (`--dry-run`은 개수만). 대전역 승인본 내보내기: `node tools/export-supabase-facades.mjs S201801`

## 해지 순서

1. **배포**: 편집기(마이그레이션 0001·0002 적용, `APPROVERS` 등록)와 서비스(이번 변경)를 배포한다.
2. **확인**: 운영 대전역 지도(`/app/?site=S201801`)를 열어 네트워크에 `supabase.co` 요청이 없고, 승인 파사드 수가 편집기 `/api/public/station?key=S201801`의 `overlays` 수와 같은지 본다. 서울역 지도는 기존처럼 심사 고정본을 쓰는지 본다.
3. **마지막 보관**: 2026-09-27 이후 예전 작업대를 쓴 적이 있으면 `node tools/archive-supabase.mjs`를 한 번 더 실행한다.
4. **닫기**: Supabase 대시보드에서 익명 로그인을 끄고(Authentication → Providers), 프로젝트를 **일시중지**한다. 1~2주 문제없으면 다음 단계로.
5. **삭제**: 프로젝트를 삭제한다(되돌릴 수 없음). 사람이 직접.
6. **정리(삭제 후)**: `.env.local`의 Supabase 값 제거, `@supabase/supabase-js` 의존성·`src/supabase-client.js`·`src/catalog-workbench.js`·`catalog/`·`routes/` 빌드 입력·Supabase 전용 테스트(`tools/test_public_collab_supabase.mjs`, `test_collab_build.mjs`의 작업대 항목) 제거. `/catalog`·`/routes` 리다이렉트는 유지. `tools/freeze-jury-facades.mjs`는 Supabase를 읽으므로 다시 고정할 일이 있으면 보관본에서 읽도록 바꾼다.

## 비용

해지 후 Supabase 비용과 한도 걱정이 사라진다. 편집기의 D1/R2는 Sites 제공분(공식 문서: D1 사이트당 10GB, R2 고정 한도 없음, 베타 기간 요금제별 사용 한도 있음)을 쓴다.

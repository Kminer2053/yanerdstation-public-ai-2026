# 배포 안내 · 공개 제보·제보함·46개 역 · 2026-09-27

두 Sites 프로젝트를 **편집기 → 서비스** 순서로 배포한다. 서비스의 대전역 지도가 편집기 공개 API를 읽기 때문이다. GitHub push는 자동 배포하지 않는다.

## 1. 편집기 (toolkit.yanerdstation.kr)

- 저장소: `Kminer2053/ya-nerd-station`, 브랜치 `codex/public-editor`, 커밋 `773aa0a`
- Sites 프로젝트: `ya-nerd-station-editor/.openai/hosting.json` (D1 `DB`, R2 `UPLOADS`)

순서:
1. D1에 마이그레이션을 차례로 적용한다: `drizzle/0001_public_reports.sql`, `drizzle/0002_approvers_photo_notes.sql` (기존 `0000`은 이미 적용됨).
2. 런타임 비밀 값 `APPROVERS`를 등록한다. 형식 `이름:비밀번호`, 여러 명은 쉼표나 줄바꿈, 비밀번호 8자 이상. 값은 사용자가 정해 전달한다(문서·커밋에 적지 않음). 없으면 제보함은 읽기 전용으로 동작한다.
3. 선택 값: `AI_API_KEY`(+ `AI_PROVIDER`, `AI_MODEL`), `REPORT_STORAGE_MB`(기본 500).
4. `npm ci && npm run build` 후 기존과 같은 방식으로 배포한다(`dist/client` + `dist/server/index.js`).

확인:
- `/` — 역 목록이 “3D 연결 46곳”, 아무 역(예: 부산역)이나 열어 3D가 뜨는지. 개발자 도구 네트워크에서 타일이 `cdn.vworld.kr`에서 오고 `/api/map-source/`는 거의 없어야 한다.
- 제보 한 건: 위치 → 사진·내용 한 화면 → 보내기 → “내 제보”에 진행 단계가 보이는지.
- `/console/` — 로그인 없이 목록·단계 막대가 보이고, 승인자 로그인 후에만 원본 사진·보정 작업대·판단 버튼이 보이는지.
- `/editor/` — 기존 편집기, 대전역 새 초안에 시설 99개.
- `GET /api/public/station?key=S201801` 응답 헤더에 `Access-Control-Allow-Origin: *`.
- 확인용으로 만든 제보는 제보함에서 반려(사유 적기)해 정리한다.

## 2. 서비스 (yanerdstation.kr · seoul.yanerdstation.kr)

- 저장소: `Kminer2053/digitaltwin-station`, 브랜치 `main` (이 문서가 포함된 커밋)
- 바뀐 점: 대전역 등 서울역 외 지도는 승인 파사드를 Supabase 대신 편집기(`https://toolkit.yanerdstation.kr/api/public/station`)에서 읽는다. 서울역은 그대로 심사 고정본을 쓴다. `toolkit/`은 편집기 `773aa0a` 미러.
- `sites` 원격에 직접 push하지 말고 기존 Sites 배포 절차로 배포한다.

확인:
- `/app/?site=S201801` — 네트워크에 `supabase.co` 요청이 없고, 편집기 공개 API 요청이 200이어야 한다. 승인된 파사드가 없으면 “승인 이미지 교체 준비”가 정상.
- `/seoul/` — 서울역 지도·파사드가 이전과 같은지.

## 3. 그다음

- Supabase 해지: `docs/supabase-retirement-2026-09-27.md` 순서. 보관본은 이미 만들어 두었다(`../tmp/supabase-archive-20260927/`). 일시중지·삭제는 사용자가 직접 한다.
- VWorld: 외부 정식 서비스 전 인증키·도메인 등록(기존 문서 요구 사항).

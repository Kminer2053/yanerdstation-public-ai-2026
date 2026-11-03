# 프로젝트 운영 기준

## 기준 소스와 보존 범위

2026-09-16, 임시 작업본 `/private/tmp/station-origins-20260916`의 배포 소스 `e2cc993738f3a5e41cdcf1c97f7a48951df1b802`를 정식 `service/`로 복제했습니다. Sites main의 전체 조상 이력을 받아 shallow 상태를 해제했습니다. 이전 루트와 임시 작업본은 삭제하지 않았습니다.

| 위치 | 역할 |
| --- | --- |
| `app/` | Cesium/VWorld 지도와 시설물·파사드 표시 |
| `src/`, `catalog/`, `routes/` | 협업 카탈로그와 경로/포인트 검토 UI |
| `public/assets/` | 앱에서 사용하는 가공 에셋 |
| `public/data/` | 서비스에 포함되는 검토 데이터와 기존 데모 데이터 |
| `supabase/migrations/` | DB 스키마·정책·기존 seed 이력. 운영 DB 백업은 아님 |
| `tools/`, `docs/` | 생성·검증 도구와 기능별 기록 |
| `.openai/hosting.json`, `server/` | 기존 Sites 연결과 정적 파일 서버 진입점 |

원본 사진, 대용량 수집자료, 운영 DB와 private Storage 객체는 별도 보관 대상입니다. 일부 생성 도구는 상위 작업공간의 `outputs/` 입력자료가 필요하므로 새 clone만으로 모든 원자료 재생성이 가능하다고 간주하지 않습니다.

## 브랜치와 원격

- `main`: 배포 v46의 실행 소스 + 프로젝트 정리 문서/제외 규칙.
- `sites-v46`: 배포 v46의 정확한 소스 태그.
- `codex/map-loading-entry-review`: 원본 임시 작업본의 미커밋 11개 파일을 보존하는 실험 브랜치. 외부 원점 대신 진입점 중심 표시, 로딩 지연 처리, 진단/테스트 도구를 포함합니다. **Sites에는 미배포**입니다.
- `origin`: GitHub 비공개 저장소. 일상적인 pull/push 대상.
- `sites`: 기존 Sites Git 주소. 별도 승인된 배포 절차에서만 사용하며 기본 push 대상이 아닙니다.

GitHub main을 갱신해도 Sites가 자동으로 배포되도록 연결하지 않았습니다. 실험 브랜치를 검증 없이 main 또는 Sites main에 합치지 마세요.

```sh
git switch -c codex/my-change main
# 작업·검증 후
git add <변경한-파일>
git commit -m "Describe the change"
git push -u origin HEAD
```

## 로컬 실행과 검증

`npm ci` 후 `.env.example`을 참고해 `.env.local`을 설정합니다. 기존 Mac에서는 로컬 환경 파일이 이미 복사되어 있습니다. 환경 파일·비밀키·조사 원자료·로컬 빌드와 캡처는 Git에서 제외합니다.

```sh
npm run dev:collab
npm run build
npm run test:collab
node tools/test_route_review.mjs
node tools/test_point_review.mjs
node tools/test_origin_entry_review.mjs
```

출력 경로는 `dist/client`이며 Sites 서버 래퍼는 `dist/server/index.js`입니다. `test:collab`은 현재 Supabase 프로젝트 설정이 주입된 빌드를 전제로 합니다.

`npm test`는 기존 Chrome 기반 브라우저 통합 테스트입니다. `/Applications/Google Chrome.app`과 실행 중인 로컬 서버 및 외부 3D 연결에 의존합니다. 일반적인 독립 단위 테스트나 모든 OS에서 동작하는 CI 명령이 아닙니다. 이번 정리의 첫 실행에서는 샌드박스의 Chrome 실행 제한으로 완료하지 못했습니다. 빌드 통과를 실시간 3D 지도 연결 성공으로 해석하지 않습니다.

## 배포와 보안

기존 Sites v46의 배포/공유 설정과 Supabase 데이터는 이번 작업에서 변경하지 않습니다. 다른 호스팅으로의 연결·배포도 하지 않습니다.

현재 카탈로그는 익명 협업 편집 구조입니다. GitHub 저장소가 private이어도 사이트/DB 권한이 private으로 바뀌지 않습니다. 실제 내부 매출 데이터와 관리자 기능 도입 전에 직원/입점희망자/일반고객 권한 분리 및 Supabase RLS를 검토해야 합니다.

`.gitleaks.toml`은 기본 비밀키 검사를 유지하되 카탈로그의 64자리 SHA-256 `slot_key` 식별자만 오탐에서 제외합니다. 실제 비밀키는 제외 규칙에 추가하지 말고 제거·폐기 및 재발급을 검토하세요.

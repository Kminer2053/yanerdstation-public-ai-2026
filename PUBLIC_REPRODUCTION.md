# 야!너두 스테이션 · 실제 서비스 전체본 재현 안내

이 제출본은 사용자가 내부 공개 승인을 받았다고 확인한 **실제 서빙 코드·사진·상권/운영 데이터**를 대상으로 한다. 이전에 만든 합성 표지·독립 합성 매출로 치환한 제한판을 사용하지 않는다.

## 실제 배포와 포함 범위

| 대상 | 실제 배포 | 소스 기준 |
|---|---|---|
| 서울역 서비스·소개·COMMONS | v77 | `5813ee98eb900fdd86c89b2e027b85de7c570307` |
| 공개 편집기 | v14 | `e9c979480c64da2f9e30e72e864c277d3d7b267c` |

v77의 추적 파일 1,033개(263,154,110바이트)를 모두 포함한다. 이미지 418개, 영상 18개, 정밀 지도·세 이용자 화면·공개 편집기·COMMONS 경량 2·3층 모델과 공유방 기능을 보존했다. 편집기 v14의 78개 파일은 `toolkit/`의 대응 78개와 원본 SHA-256이 모두 같아 중복 복사하지 않았다.

`public/`의 571개 파일, 승인 사진·영상·COMMONS 파생 공간 자산, `server/data/sales.json`은 원본 배포 소스와 같은 해시다. 실제 서비스 코드와 모든 정적 데이터의 출발 목록은 [원본 해시 manifest](submission/provenance/served-source-manifest.json), 최소 보완 내역은 [차이 보고서](submission/provenance/source-differences.json)와 [patch](submission/patches/)에서 확인한다.

**공개 승인은 자료의 성격을 바꾸지 않는다.** 상권 자료의 원본 설명은 “패턴 보존 가공 매출. 원금액 아님. 시간대는 월별 구성비 적용 추정.”이다. 유동은 관측·가공·추정을 구분하고 가상 보행자는 실제 현장 인원 측정으로 설명하지 않는다. 기존 운영과 같은 자료를 복원했으며 새로운 합성값으로 다시 만들지 않았다.

## 설치·실행

Node.js 22.13 이상이 필요하다(`node:sqlite` 지원). 검증 환경은 Node.js 26.13이다. 패키지는 각 프로젝트 폴더에만 설치한다.

```sh
npm ci
npm test
npm run build
npm start
# http://127.0.0.1:4196/
# http://127.0.0.1:4196/seoul/?role=visitor
# http://127.0.0.1:4196/seoul/?role=business
# http://127.0.0.1:4196/seoul/?role=manager
# http://127.0.0.1:4196/commons/
```

두 번째 터미널:

```sh
cd toolkit
npm ci
npm test
npm run build
npm run dev
# http://127.0.0.1:4197/          공개 제보
# http://127.0.0.1:4197/console/  공개 제보함·승인자 검토
# http://127.0.0.1:4197/editor/   편집기
```

포트가 겹치면 다른 프로세스를 종료하지 말고 환경을 확인한다. 기본 서버는 loopback 주소에만 연결하며 포트가 사용 중이면 종료한다. 서비스와 편집기는 서울 iframe·허용 출처 때문에 4196·4197을 한 쌍으로 사용한다.

원래 정적 개발 서버와 브라우저 통합 검사도 `npm run start:legacy-static`, `npm run test:legacy-browser`로 보존했다. 현재 기본 `npm test`는 서버 없이 실행하는 API·관리·운영 상황·COMMONS 검사를 묶는다. 원래 모든 생성·선택 검사 스크립트도 삭제하지 않았다.

정밀 지도는 서비스와 같은 외부 VWorld/Cesium 접속이 필요하다. COMMONS의 실제 서빙 경량 바이너리·atlas·상세 사진은 이 저장소에 포함돼 원본 3D 타일을 다시 받을 필요가 없다. 일반 `npm run build`는 포함된 보행/파사드/UV 캐시로 COMMONS 자산을 다시 구성하며 외부 원타일 캐시 없이 통과했다. 원형 건축을 **처음부터 재추출**하는 `tools/build-commons-architecture.mjs`만 별도의 원타일·이미지 카탈로그 입력이 필요하다. 일반 실행에 이 재추출은 필요하지 않다.

## 실제 운영 D1 업무 상태 재현

[served-data 안내](served-data/README.md)에 운영 D1의 읽기 전용 도메인 export와 SQL, 실제 공개 모자이크 1개와 R2 원본 이미지 2개를 포함했다. 운영 서비스 업무 테이블은 조회 시점에 0행이며 편집기에는 실제 제보 1건·사진 메타 1건·이전 초안 1건·보완 요청 작업 2건이 있었다. 인증 계정·세션·에이전트 연결 토큰·인증 로그는 옮기지 않는다. 일시 공유방은 참조 기록이며 운영 접속 토큰을 복원하지 않는다.

새 로컬 DB에만 다음 명시적 import를 실행한다. 서버를 먼저 한 번 실행했거나 DB가 없어도 마이그레이션을 준비한다. 기존 업무 행이 있으면 덮어쓰지 않고 중단하며 같은 export를 다시 적용하면 그대로 유지한다.

```sh
node tools/import-served-domain.mjs
```

로컬 승인자 계정은 편집기 실행 시 임의로 생성하고 `toolkit/data-private/local-approvers.txt`에만 저장한다. 이 계정·로컬 DB·세션은 Git에서 제외한다. 업무 내용을 열람하거나 로컬에서 바꾼 결과를 실제 운영 변경이나 새 실증 성과로 표시하지 않는다.

제보 원사진 JPEG 1개(502,723B·1152×2048)와 이미 대체된 초안 PNG 1개(740,085B·465×1024)는 사용자가 로그인한 기존 승인자 세션의 이미지 GET으로 내려받아 원래 R2 키로 포함했다. 원바이트의 크기·형식·치수·SHA256을 검증했으며 현재 D1 기록에 대응하는 원본 이미지의 누락은 없다. import는 원본 두 개와 공개 미리보기를 편집기의 로컬 업로드 경로로 복사한다. 같은 SQL의 DB는 그대로 유지하고 내용이 다른 로컬 파일은 덮어쓰지 않는다. 새 로컬 DB에서 제보는 `review`, 이전 초안은 `superseded`로 복원된다. 기존 로컬 DB의 이후 작업 상태는 보존하며 원래 승인자 API로 열람한다. 초안의 공개 이미지 API는 404가 정상이다. 정확한 키·조회 경로·해시는 [export manifest](served-data/export-manifest.json)를 확인한다.

## 설정과 실제 AI 범위

`.openai/hosting.json`의 공개 프로젝트 ID·DB/R2 binding 이름은 배포 provenance를 위해 원본 그대로 유지한다. 호스팅 토큰이나 관리자 비밀키는 포함하지 않으며 기존 프로젝트로 배포하는 명령을 실행하지 않는다.

`submission/provenance/public-client-config.json`은 브라우저 공개용 Supabase URL·publishable 설정이다. 관리자/service_role 키가 아니다. 옛 카탈로그를 같은 공개 구성으로 연결할 때만 자신의 로컬 `.env.local`에 해당 `VITE_` 값을 설정한다. 기본 실행은 운영 Supabase 설정을 자동 주입하지 않는다.

AI API 요청·이미지 응답 검증·초안·질문·최종 승인 코드는 실제 편집기와 같다. API키가 없는 기본 상태에서는 유료 모델을 호출하지 않는다. 별도 서버 환경 `AI_API_KEY`, `AI_PROVIDER`, `AI_MODEL`을 설정해야 실제 이미지 입력 모델을 사용한다. 테스트는 실제 PNG/JPEG와 **모의 모델 응답**을 사용하며, 유료 AI의 운영 왕복·정확도·시간 절감·비용은 이번 검증에서 측정하지 않았다. 사람의 최종 승인 전 공개 지도는 바뀌지 않는다.

## 보안·로컬 실행 보완

실제 기능과 자료를 보존하면서 Vite 8.2.4, sharp 0.35.5, source-map-js 1.2.2 및 구형 core-utils 하위 esbuild 0.25.0을 적용했다. 원래 three·COMMONS·Sites 통합과 전체 빌드 파이프라인을 유지했다. 루트·Toolkit npm 감사 결과는 각각 알려진 취약점 0개다. 기본 로컬 실행은 원본 비공개 타일 캐시를 자동 선택하지 않고 같은 외부 VWorld를 사용한다. 생산 서버에 이미 있던 COMMONS handler를 로컬 Vite adapter에도 연결했으며, 조명 상태 캐시의 변수명과 iframe 종료 시 null 확인을 정리했다. 이 작은 차이는 patch와 해시 보고서에 남겼다.

기존 Toolkit MIT·절차 생성 보행 모델 CC0·외부 사진 크레딧과 라이선스는 해당 원본 파일에 유지한다. 소스 공개가 VWorld·상표·외부 저작물의 별도 권리를 새로 부여하는 것은 아니다. 기존 운영 사이트·DB·개발 작업공간은 수정하거나 재배포하지 않았다.

공공 GitLab에서 공개 카탈로그 SHA 식별자의 청크 경계 조각, 브라우저 공개 설정, 과거 코드식이 비밀키로 오탐돼 정확한 값별 검토 결과를 `.gitleaks.toml`에 반영했다. 기본 탐지 규칙을 유지하고 파일·경로·규칙을 통째로 제외하지 않았다. 두 검사기 버전의 전체 검사와 양성 대조 결과는 [보안 검토 기록](submission/provenance/security/gitleaks-review.json)에 있다. SQL 값·사진·영상·상권 데이터는 바꾸지 않았다.

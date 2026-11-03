# 공개 제출본 의존성 보안 보완

확인일: 2026-11-03. 공공 GitLab의 저장소 보안 검사에서 의존성 경고를 받아 npm 공식 감사 API와 GitHub Advisory Database의 수정 범위를 대조했다. 촬영 중인 서버는 유지하고 별도 임시 복사본에서 패치와 회귀 검증을 먼저 수행했다.

## 적용한 최소 수정

| 대상 | 기존 | 적용 | 근거 |
|---|---|---|---|
| Vite (루트·Toolkit) | 8.2.2 | **8.2.4 고정** | 8.2 계열의 수정 버전으로 공지된 범위 |
| sharp (루트) | 0.35.4 | **0.35.5 고정** | librsvg 관련 수정 버전 |
| source-map-js | 1.2.1 | **1.2.2 override** | 전이 의존성의 패치 버전으로 제한 |
| core-utils 하위 esbuild | 0.18.20 | **0.25.0 override** | 해당 개발 서버 CORS 문제의 최초 수정 버전 |
| 미사용 Sites 통합 | sites-vite-plugin 0.2.0 | 공개본에서 의존성과 import 제외 | hosting 연결이 없는 공개 검토본에서 사용하지 않는 배포 통합 |

esbuild override는 `@esbuild-kit/core-utils` 하위에만 적용한다. 이 경로는 `drizzle-kit → @esbuild-kit/esm-loader → core-utils`에서 들어온다. 상위 esbuild 0.28.2와 Drizzle 별도 esbuild 0.25.12는 유지한다. drizzle-kit의 강제 구버전 변경, 잠금파일 삭제, 보안 스캐너의 예외 처리는 사용하지 않는다.

## 검증 결과

npm 감사 결과는 루트 7개(높음 3·중간 4), Toolkit 6개(높음 2·중간 4)에서 **각각 알려진 취약점 0개**로 바뀌었다. 이 수치는 해당 시점 npm 감사 데이터베이스와 설치 트리의 결과이며 모든 보안 위험의 부재를 보증하지 않는다. 수정한 잠금파일로 `npm ci`를 다시 수행했다.

패치 버전 환경에서 루트 `build`, `test:experience`, `test:manager`, `test:operations`, Toolkit `test`, `test:reports`, `test:ai-work`, `test:dots-work`, `test-chat-work`, `build`가 모두 통과했다. 양쪽 Drizzle CLI도 0.31.10으로 정상 실행하고 `drizzle-kit check`가 기존 마이그레이션을 읽어 통과했다. 기존 원본 운영 서비스의 패키지·프로세스·배포는 변경하지 않았다.

## 공식 근거

- [esbuild GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99): 0.24.2 이하가 영향 범위이며 0.25.0에서 수정.
- [sharp GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w): 0.35.5에 librsvg 수정 반영.
- [source-map-js GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q): 1.2.2가 수정 버전.
- Vite/launch-editor 관련 [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm), [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv), [GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw), [GHSA-9jrq-w75r-8gcw](https://github.com/advisories/GHSA-9jrq-w75r-8gcw), [GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22), [GHSA-vfpm-58rq-9qcg](https://github.com/advisories/GHSA-vfpm-58rq-9qcg): 각 공지의 8.2 계열 수정 버전인 8.2.4를 적용.

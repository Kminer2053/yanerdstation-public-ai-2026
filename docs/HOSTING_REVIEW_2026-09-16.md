# 호스팅 검토 · 2026-09-16

## 결론

당장은 **GitHub를 소스 기준으로 삼고 현재 Sites를 유지**하는 것이 안전합니다. 데이터와 권한 체계를 정리한 뒤 정식 대외 운영 단계에서는 **Vercel Pro + 기존 Supabase**를 우선 후보로 권합니다. 정적 파일 트래픽 비용이 중요하면 **Cloudflare Workers Static Assets + 기존 Supabase**도 비교할 가치가 있습니다. 어느 호스팅으로도 이번 작업에서 이전하지 않았습니다.

이는 현재 코드 구조와 운영 편의성을 근거로 한 판단이며, 실제 트래픽 측정이나 기관의 보안/조달 심사를 대체하지 않습니다.

## 현재 코드 구조

- Vite 멀티페이지 프런트엔드: `/app/`, `/catalog/`, `/routes/`.
- `server/index.js`는 `env.ASSETS.fetch(request)`로 정적 파일을 전달합니다.
- DB/Auth/파사드 Storage는 Supabase, 3D 원본과 일부 라이브러리는 외부 제공처에 의존합니다.
- 현재 Sites 빌드 설정과 `dist/client` 출력 구조는 유지했습니다. Vercel을 쓰기 위해 Next.js로 재작성할 필요는 없습니다.

## 선택지

| 후보 | 현재 프로젝트에 대한 판단 | 전환 전 확인 |
| --- | --- | --- |
| Sites 유지 | 기존 주소와 검토 작업 흐름을 그대로 유지. 데이터 모델링 단계에 적합 | 외부 연결 장애, 접근 권한, 서비스 조건 |
| Vercel Pro | GitHub 연동, PR별 미리보기와 프런트엔드 운영 흐름에 적합한 우선 후보 | Sites 전용 플러그인/서버 래퍼 분리, 출력 경로, 환경값, 도메인/인증 설정 |
| Cloudflare Workers Static Assets | 현재 정적 앱 구조에 잘 맞고 정적 요청 비용 측면에서 비교할 후보 | Workers/Git 빌드 설정, 개별 에셋 크기 제한, API와 저장소 비용 |

Vercel은 Vite 배포와 Git 기반 PR별 미리보기 URL을 지원합니다. [Vercel Vite 문서](https://vercel.com/docs/frameworks/frontend/vite)

Vercel Hobby는 개인·비상업 용도로 제한되어 있으므로 회사 서비스는 무료 Hobby를 전제로 계획하지 않는 편이 맞습니다. [Hobby 이용 범위](https://vercel.com/docs/plans/hobby)

Cloudflare Workers Static Assets의 정적 에셋 요청은 무료·무제한으로 안내되지만 Worker 실행은 별도 과금 체계와 제한을 따릅니다. 이를 Supabase·DB·모든 파일 저장·전체 서비스 비용까지 무료라는 뜻으로 해석하면 안 됩니다. [공식 비용·제한](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)

OpenAI는 Sites를 관리형 호스팅 및 내부 도구 구축 흐름으로 안내하고 있습니다. 장기적 선택은 기관의 데이터/접근 정책과 운영 요구사항을 확인한 뒤 결정해야 합니다. [OpenAI Sites 안내](https://learn.chatgpt.com/use-cases/build-and-deploy-internal-apps)

## 중요한 별도 과제

1. **지도 연결 문제:** 이번에 확인한 외부 VWorld 원본 로딩 지연은 프런트 호스팅만 바꾼다고 해결이 보장되지 않습니다.
2. **권한:** 현 카탈로그는 익명 편집 방식입니다. 내부 매출 데이터 도입 전에 인증/RLS/역할별 접근 제어가 우선입니다.
3. **데이터 보관:** GitHub는 소스 이력입니다. Supabase 운영 DB·파사드 객체와 조사 원자료는 별도 백업 정책이 필요합니다.
4. **도메인·재이용:** VWorld 허용 도메인·데이터 이용 조건, Supabase 인증 redirect/CORS 및 Sites 의존성은 시험 환경에서 확인해야 합니다.
5. **수집 작업:** 장시간 데이터 수집/집계 작업은 프런트 배포 서비스에 무조건 넣지 말고 실행 시간·주기·비밀키 보관을 기준으로 별도 작업 실행 환경을 검토합니다.

순서는 GitHub 기준 소스 확립 → 데이터·권한 정리 → 별도 시험 배포 → 기능·지도·파사드 검증 → 사용자 승인 후 운영 주소 전환입니다.

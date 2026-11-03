# 1301062 배포 검증 후 경로·렌더링 보완

## 수정 범위

- 서비스만 변경. 편집기·서울역 revision 337·심사 잠금·유동 배분 원천은 유지.
- KTX&일반열차 → 테라로사: 거리만 최소화한 기존 경로는 F02MV002 계단을 선택했다. 배포 확인 기준의 F02MV007-4 상행 에스컬레이터를 경유하도록 이 한 경로에 명시적인 권장 경유 정책을 적용했다. 접근·이탈 보행은 같은 층의 검증된 간선에서 최단거리로 계산한다. 거리는 약 114.7m에서 122.9m로 바뀐다. 전체 무제약 최단경로라는 의미는 아니다.
- `preferred-facility-path.mjs`를 전체 데이터 빌더와 국소 재생성 도구가 함께 사용한다. `node tools/repair-terarosa-route.mjs --write`는 검증된 walk-graph로 해당 경로만 재생성한다. 다른 495개 경로와 OD 유동 배분은 그대로다.
- 다층 표시 시 발생한 `Fragment shader failed to compile`은 지도 모델의 철거 마스크 셰이더에서 관찰되었다. 수백 개 삼각형 검사를 인라인하지 않고 nearest float 데이터 텍스처에서 반복 조회하도록 바꿨다. 위치·UV 동시 검사, 개별 허용 오차, 기존 공간 경계·표시 스위치·원본 파사드는 보존한다. 플랫폼111의 기존 텍스처 방식은 유지한다.

## 검증

- `npm run test:release-routing-rendering`: 공통 셰이더 8,782자, 원본 374개 삼각형의 float 계수·UV 검증, 단방향 에스컬레이터와 보행 접근 간선 검증.
- experience, crowd, replacement-surfaces, truedan, information-zone, manager, collab 테스트 통과.
- 내장 브라우저 로컬 4202에서 KTX → 테라로사 약 3분 / 123m, 2F·3F 동시 표시 및 3층 순환 345명 정상. 운영관리 3F 단독 사람 표시도 확인. 동일 화면의 셰이더 중단 재현되지 않음.
- 배포는 기존 Sites 공식 workflow로 수행하며 `sites` 원격 직접 push 금지. 배포 후 기존 안내문의 API·방향 22개·정오/심야 표시·경로 검증을 다시 수행한다.

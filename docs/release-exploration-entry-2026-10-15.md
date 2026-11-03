# 자유탐색 직접 진입

- 바로가기: `/seoul/?role=visitor&mode=explore&floor=2F&view=third`
- `mode=explore`만 지정해도 2층·3인칭으로 시작한다. 등록된 `hall-center` 구역 안의 `GRID-2F--2-30`(평면 연결 8개)을 별도 중앙홀 시작점으로 사용한다. 기존 `floor:2F` 탐색 지점의 의미는 바꾸지 않는다.
- 허용된 층과 시점만 읽는다. 잘못된 값은 2F·3인칭으로 대체하고, 사업자·운영관리 역할에는 적용하지 않는다.
- 카탈로그와 지도 준비를 모두 기다린 뒤 한 번만 진입한다. 반복 준비 메시지가 사용자를 다시 순간이동시키지 않는다.
- 직접 진입에서는 출발점·탐험 위치 모달을 생략하고 하단 안내를 접는다. 모바일도 지도 화면으로 이동한다. 카메라나 마이크는 켜지 않는다.
- 준비 중 사용자가 다른 기능을 선택하면 초기 자동 진입을 취소한다. 기존 일반 주소는 출발점 선택을 유지한다.
- 지도·시설·경로·영업 원본과 Toolkit에는 변경이 없다.

## 검증 및 배포

- `node tools/test-exploration-entry.mjs`
- `node tools/test-exploration-keyboard.mjs`
- `node tools/test-exploration-play.mjs`
- `npm run test:experience`
- `git diff --check`
- 공식 Sites source helper로 기존 서비스 project를 빌드·저장·배포. GitHub service/main에도 같은 소스를 반영한다.

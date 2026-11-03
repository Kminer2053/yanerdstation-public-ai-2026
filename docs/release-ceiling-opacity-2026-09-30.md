# 2층 천장 검은 면 수정

## 원인 및 변경
- 3층 바닥 아래 생성한 천장의 `MaterialAppearance`에는 `translucent:false`가 있었으나, 사용자 정의 `Material`에는 설정이 없었음.
- Cesium은 재질의 투명 여부를 사용하므로 천장이 반투명 렌더 경로로 들어감. 보행 높이에서 넓은 검은 영역이 나타남.
- 재질 자체에 `translucent:false`를 지정해 불투명 깊이 패스로 렌더링.
- 천장 범위·높이·사각 LED 간격, 자연채광 구역, 원본 시설·경로 데이터는 변경하지 않음. 추가 도형·광원·프레임별 연산 없음.

## 검증
- 로컬 4202, 2층 ENU (-30,50,10.7)에서 원본 증상 재현.
- 같은 위치의 단색 불투명 재질은 정상 표시됨을 확인해 기하 범위 누락이 아님을 판별.
- 수정한 실제 재질에서 회색 패널과 사각 LED가 연속 표시됨을 브라우저로 확인.
- `node tools/test-ceiling-opacity.mjs`
- `node tools/test-lighting-platform111.mjs`
- `node tools/test-exploration-keyboard.mjs`
- `git diff --check`

## 배포
- 서비스 GitHub와 기존 Sites 워크플로로 배포. 공개 편집기(toolkit) 변경 없음.
- 대상: station-one-collab.soalsebi.chatgpt.site 및 기존 연결 도메인 yanerdstation.kr / seoul.yanerdstation.kr.

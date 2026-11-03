# 복순도가 정면 상하 반전 수정

- 대상: 서울역 공항철도 측 1F `F01WL018-S08` / 모델 `F01WL018`.
- 원본 PNG는 정상. Cesium 1.142의 `CoplanarPolygonGeometry`가 기하 정점만 `[3,2,1,0]` 순서로 재배열하여 UV 대응이 뒤집혔다.
- 서울역 고정본 `approved-facades.json`에서 해당 면의 UV 배열 순서만 반대로 수정했다. 이미지·승인 버전·크기·위치·법선·다른 모든 면은 그대로 유지했다.
- 소개 페이지 도식의 입력 데이터 지문도 재생성했다. 도식의 수치·배치 변경은 없다.
- 서울역 공개편집 저장 잠금과 운영 DB는 변경하지 않았다.

## 검증

- 실제 Cesium 1.142 엔진: 기존 반전 재현. 오프셋 0 / 0.055 / 0.065 / 0.075m 모두 수정 후 Float32 UV 오차 0, 기하 좌표·인덱스 동일.
- JSON 전후 구조 비교: `F01WL018-S08` UV 배열 외 변경 없음.
- 이미지 SHA-256 유지: `6bbfd02965406308ab929f10d0f32974f534de537045d049c21720b5fa35f1da`.
- 내장 브라우저 로컬 3D 화면: 복순도가 간판이 상단, 계산대와 바닥이 하단에 정방향 표시됨.
- 회귀 테스트: `npm run test:replacement-surfaces`.
- 실제 엔진 재현: `node tools/test-boksoonga-orientation.mjs /path/to/Cesium-1.142.js`.

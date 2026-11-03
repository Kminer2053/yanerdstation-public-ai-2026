# 스토리웨이 5·6번홈 남측 외벽 방향 수정

- 대상: `F01FC041-S01`, 1F 스토리웨이 5,6번홈 남측 외벽.
- 승인 PNG는 정상이며 Cesium 1.142가 기하 정점만 역순으로 재배열해 상하 반전됨.
- 서울역 고정본에서 대상 UV 배열만 역순 보정. 다른 면·사진 파일·위치·승인 이력·서울역 편집 잠금은 유지.
- 전후 JSON 비교에서 대상 UV 외 차이 없음. 소개 도식은 데이터 지문만 갱신.
- 실제 Cesium 엔진: 0 / 0.055 / 0.065 / 0.075m 오프셋 모두 기존 반전 재현, 보정 후 Float32 UV 오차 0, 기하 및 인덱스 동일.
- 원본 이미지 SHA-256: `1cc059f1f160b505416777ceb52f9a061b391a1d5de597abbbc7bb28f7bfdfbb`.
- 회귀검증: `npm run test:replacement-surfaces`; 실제 엔진 검증은 `node tools/test-storyway-orientation.mjs /path/to/Cesium-1.142.js`.

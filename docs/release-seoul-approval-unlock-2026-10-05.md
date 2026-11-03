# 서울역 승인 변경 레이어 반영 — 2026-10-05

사용자가 서울역의 심사기간 지도 반영 제한을 해제했다. 공개 편집기의 관리자 최종 승인 후 파사드와 신규 구조물이 서울역 서비스 지도에도 표시된다.

- 기준 시설·경로 데이터 revision 337 및 기존 승인 파사드 94장은 유지한다.
- 공개 편집기의 `/api/public/station?key=S202103` 승인 레이어를 읽고 기준 파사드의 alias에 맞춰 덮어쓴다. 변경되지 않은 면은 그대로다.
- 기존 `slot_key`, 특수 시설 식별자, 면 배치·UV 정보는 보존한다. 새 제보 보정 이미지에 과거 이미지 전용 크롭을 다시 적용하지 않는다.
- 승인된 구조물 박스와 사진 면을 별도 지도 레이어에 표시한다. 층 선택과 다층 조망을 따른다.
- 제보함의 미승인 초안 3D 배치 미리보기에도 사진 면을 표시하며, 이미 승인 레이어에 있는 구조물은 중복으로 그리지 않는다.
- 승인 자료는 최초 연결과 5분마다 갱신한다. 승인 직후 새로고침으로 확인한다. 편집기 연결 실패 때 서울역 기준 파사드와 마지막 성공한 레이어는 유지된다.
- `/api/toolkit/seoul`은 `jury_locked:false`, `direct_save_locked:true`, `report_approval_required:true`를 반환한다. 확정 원본 직접 쓰기는 기존 보호를 유지한다.
- 기존 대기 승인 이관 대상은 배포 전 운영 조회 기준 0건이다. 검토 중 실제 제보는 임의로 승인하지 않는다.

검증: `test:experience`, `test:replacement-surfaces`, `test:truedan`, `test:information-zone`, `test:f02wl072-frame`, `test:release-routing-rendering`, `node tools/test-toolkit-approved-layer.mjs` 및 미러된 공개 편집기 `test`, `test:reports`.

공개 편집기 먼저, 서비스 다음으로 Sites 공식 절차로 배포한다. `toolkit/UPSTREAM.json`은 GitHub 공개편집기 b8ee350을 가리킨다.

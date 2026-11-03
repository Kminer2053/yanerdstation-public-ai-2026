# 야!너두 스테이션 편집기 · 공개 검토본

사진 제보를 정리하고 보정한 수정안을 사람이 최종 승인해 별도 지도 레이어에 반영하는 도구입니다. 설치·기본 설정·AI 구현 범위·공개 데이터 구분은 [상위 README](../README.md)를 확인하세요.

```sh
npm ci
npm run dev
# http://127.0.0.1:4197/
```

서울역 지도는 상위 서비스(4196)가 필요합니다. 키가 없는 기본 상태에서는 규칙 정리와 수동 검토를 사용합니다. 로컬 승인자 계정은 최초 실행 시 임의로 생성하며 `data-private/`에만 저장합니다. AI 호출 코드 테스트는 모의 모델 응답이며 실제 API 성능 실증이 아닙니다.

```sh
npm test
npm run test:reports
npm run test:ai-work
npm run test:dots-work
node tools/test-chat-work.mjs
npm run build
```

이 하위 편집기의 기존 [MIT License](LICENSE)는 유지합니다. 외부 지도·상표·사진에 대한 재배포권은 이 라이선스에 포함되지 않습니다. 공개본에는 사진 원본 대신 합성 대체 표지를 제공합니다.

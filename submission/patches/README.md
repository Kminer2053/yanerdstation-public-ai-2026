# 실제 서빙 소스와 재현본의 차이

원본 출발 SHA는 `../provenance/served-source-manifest.json`에 기록한다. 원본 파일을 삭제하지 않았고 static 사진·영상·상권·공간 데이터는 치환하지 않았다. 아래 patch는 원본 대비 작은 실행 보완을 검토하기 위한 기록이다.

- `01-security-versions.patch`: 보안 버전·전이 의존성 override, 기본 독립 검사/로컬 서버 별칭. 원래 검사·서버 명령은 다른 이름으로 보존한다. 최종 잠금파일은 npm install/ci로 생성·검증한다.
- `02-scanner-clarity.patch`: 실제 비밀키가 아닌 조명 상태 캐시를 의미가 드러나는 변수명/구분자로 정리한다. 스캐너 예외 목록을 추가하지 않는다.
- `03-local-reproduction.patch`: 비공개 원타일 캐시의 자동 선택을 해제하고 로컬 Vite에서 실제 COMMONS API를 연결한다. API 환경은 선택 설정이며 기본 유료 호출은 없다. 브라우저 종료 뒤 해제된 iframe에 메시지를 보내지 않도록 확인한다.

원본 deployment에 적용·배포한 패치가 아니다. 실행 패키지의 보안 보완과 로컬 재현 차이를 정직하게 분리하기 위한 제출본 기록이다.

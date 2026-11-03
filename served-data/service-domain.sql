-- 읽기 전용 운영 D1 도메인 export. 새로운 로컬 재현 DB에만 적용한다.
-- 실제 인증 계정·세션·접속 token은 포함하지 않는다.
BEGIN TRANSACTION;
COMMIT;

-- 신규 toss-link DB(0001_schema.sql)에는 users.nickname 이 이미 존재합니다.
-- 기존 레거시 DB에서만 필요했던 email -> nickname rename 이므로
-- 신규 환경에서 migrations apply가 중단되지 않도록 no-op 처리합니다.
SELECT 1;

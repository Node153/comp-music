-- 이메일 알림 발송(1단계: 하루 1번 다이제스트) — Vercel Hobby 플랜은 크론을 하루 1회로만
-- 돌릴 수 있어서, 실시간 발송 대신 "지난 발송 이후 새로 생긴 것"을 하루 한 번 모아 보낸다.
-- 이 컬럼이 그 기준 시각(커서) — 처음엔 now()로 둬서, 마이그레이션 이전에 쌓여있던
-- 오래된 알림들이 첫 실행에 한꺼번에 메일로 쏟아지는 걸 막는다.
alter table users
  add column last_notification_emailed_at timestamptz not null default now();

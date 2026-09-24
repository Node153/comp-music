-- 반응 → 다음 업로드(2026-09-24, 사용자 요청): 월요일 주간 리포트.
-- Kick이 충전되는 월요일(0시 KST) 아침에 "지난주 받은 반응·청취자 + 이번 주 Kick 충전 + 새 Drop
-- 올리기"를 메일·푸시로 보낸다(api/cron/weekly-report, 매주 월 09:00 KST).
-- weekly_report_week: 마지막으로 리포트를 보낸 주의 월요일(KST, kicks.week_start와 같은 키) —
-- 크론이 재시도돼도 같은 주에 두 번 안 나가게 한다.
alter table users
  add column email_notify_weekly boolean not null default true,
  add column push_notify_weekly boolean not null default true,
  add column weekly_report_week date;

-- 일일 릴리즈 노트 자동 초안(2026-09-24). 매일 09:00 KST 크론(/api/cron/daily-release-note)이 전날
-- 커밋을 AI로 요약해 "초안"으로 저장하고, 관리자가 /admin/announcements에서 다듬어 "게시"해야
-- 회원에게 보인다. 커밋이 없거나 회원에게 보이는 변화가 없으면 만들지 않는다.
--   status       — published(기본, 기존 공지 전부) / draft(회원에게 안 보임)
--   release_date — 어느 날의 커밋을 요약한 초안인지(KST 날짜). 같은 날 중복 생성 방지(unique).
alter table announcements
  add column status       text not null default 'published' check (status in ('published', 'draft')),
  add column release_date date unique;

-- 초안은 관리자만 본다.
drop policy "announcements_select_approved_users" on announcements;
create policy "announcements_select_approved_users"
  on announcements for select
  using (is_approved(auth.uid()) and (status = 'published' or is_admin(auth.uid())));

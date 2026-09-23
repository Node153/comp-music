-- 공지사항 칸을 "업데이트 소식"으로(2026-09-24). 회원 의견으로 무엇이 바뀌었는지 보여줘서
-- 피드백을 남길 이유를 눈에 보이게 한다.
--   kind     — notice(운영 안내) / update(새 기능·수정) / feedback(피드백 반영, 강조 카드)
--   pinned   — 맨 위 고정(주로 notice)
--   request_summary — 피드백 반영 카드의 "요청 내용"(운영자가 쓴 요약 — 비공개 원문은 노출 안 함)
--   link_url — "직접 써보기" 바로가기(앱 내부 경로만, '/'로 시작)
--   requester_count / like_count — 공지 작성 시점 스냅샷. 비공개 피드백은 회원이 RLS로 못 읽어서
--     화면에서 매번 셀 수 없으므로, 모든 행을 볼 수 있는 관리자가 만들 때 계산해 저장한다.
alter table announcements
  add column kind            text not null default 'notice' check (kind in ('notice', 'update', 'feedback')),
  add column pinned          boolean not null default false,
  add column request_summary text check (char_length(request_summary) <= 1000),
  add column link_url        text check (link_url is null or link_url ~ '^/[^/]'),
  add column requester_count integer not null default 0,
  add column like_count      integer not null default 0;

-- 반영 공지 ↔ 반영된 피드백(여러 건 → 공지 하나). 공감한 회원에게 "공감한 의견이 반영됐어요"
-- 알림을 보낼 때(notificationList.ts) 이 연결을 따라간다.
create table announcement_feedback (
  announcement_id uuid not null references announcements(id) on delete cascade,
  feedback_id     uuid not null references feedback_messages(id) on delete cascade,
  primary key (announcement_id, feedback_id)
);

create index idx_announcement_feedback_feedback on announcement_feedback (feedback_id);

alter table announcement_feedback enable row level security;

create policy "announcement_feedback_select_approved"
  on announcement_feedback for select
  using (is_approved(auth.uid()));

create policy "announcement_feedback_insert_admin"
  on announcement_feedback for insert
  with check (is_admin(auth.uid()));

create policy "announcement_feedback_delete_admin"
  on announcement_feedback for delete
  using (is_admin(auth.uid()));

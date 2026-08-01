-- 상단바 DM 자리를 대신하는 Away 메뉴(공지사항+피드백)용 테이블.
-- 공지사항: 관리자가 작성, 승인된 사용자 전원 열람. 피드백: 사용자가 제출, 본인+관리자만 열람.

create table announcements (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references users(id),
  title      varchar(200) not null,
  content    text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_announcements_created_at on announcements(created_at desc);

alter table announcements enable row level security;

create policy "announcements_select_approved_users"
  on announcements for select
  using (is_approved(auth.uid()));

create policy "announcements_insert_admin"
  on announcements for insert
  with check (is_admin(auth.uid()) and author_id = auth.uid());

create policy "announcements_update_admin"
  on announcements for update
  using (is_admin(auth.uid()));

create policy "announcements_delete_admin"
  on announcements for delete
  using (is_admin(auth.uid()));

create table feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id),
  content    text not null,
  created_at timestamptz not null default now()
);

create index idx_feedback_created_at on feedback(created_at desc);

alter table feedback enable row level security;

-- select: 본인이 보낸 피드백 확인 + 관리자는 전체 열람(관리자 페이지에서 목록 확인).
create policy "feedback_select_self_or_admin"
  on feedback for select
  using (user_id = auth.uid() or is_admin(auth.uid()));

create policy "feedback_insert_self"
  on feedback for insert
  with check (user_id = auth.uid() and is_approved(auth.uid()));

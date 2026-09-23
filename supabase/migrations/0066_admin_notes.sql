-- 회원 관리 3차: 관리자 내부 메모. 회원 상세 패널에서 관리자끼리만 보는 메모를 남긴다
-- (예: "9/24 DM으로 경고함", "전공생 증빙 추후 제출 예정"). 본인·다른 회원에게는 절대 안 보인다.

create table admin_notes (
  id             bigserial primary key,
  target_user_id uuid not null references users(id) on delete cascade,
  author_id      uuid references users(id) on delete set null,
  body           text not null check (length(trim(body)) > 0 and length(body) <= 2000),
  created_at     timestamptz not null default now()
);
create index admin_notes_target_idx on admin_notes (target_user_id, created_at desc);

alter table admin_notes enable row level security;

create policy "admin_notes_select_admin"
  on admin_notes for select
  using (is_admin(auth.uid()));

-- 작성자는 항상 본인으로 고정(다른 관리자 이름으로 위조 불가).
create policy "admin_notes_insert_admin"
  on admin_notes for insert
  with check (is_admin(auth.uid()) and author_id = auth.uid());

-- 수정은 없고, 삭제는 본인이 쓴 메모만.
create policy "admin_notes_delete_own"
  on admin_notes for delete
  using (is_admin(auth.uid()) and author_id = auth.uid());

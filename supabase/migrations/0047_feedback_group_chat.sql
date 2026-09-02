-- 피드백을 1:1 제출(feedback 테이블, 본인+관리자만 열람)에서
-- "전체 승인 회원이 함께 보는 실시간 단체 채팅"으로 전환한다.
--
-- 표시는 항상 닉네임(users.nickname). user_display 뷰는 뷰어가 Companion이면 실명을
-- 내려주므로 여기서는 쓰지 않는다 — 이 채팅은 무조건 닉네임만 노출.
--
-- 기존 feedback 테이블은 지금 0행이고 별도로 드롭하지 않고 남겨둔다(관리자 페이지는
-- 아래 feedback_messages를 보도록 이관). 나중에 필요 없으면 별도 마이그레이션으로 정리.

create table feedback_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index idx_feedback_messages_created_at on feedback_messages (created_at);

alter table feedback_messages enable row level security;

-- 승인된 회원 전원 열람(단체 채팅).
create policy "feedback_messages_select_approved"
  on feedback_messages for select
  using (is_approved(auth.uid()));

-- 본인 명의로만 작성.
create policy "feedback_messages_insert_self"
  on feedback_messages for insert
  with check (user_id = auth.uid() and is_approved(auth.uid()));

-- 본인 메시지 삭제 + 관리자 모더레이션.
create policy "feedback_messages_delete_self_or_admin"
  on feedback_messages for delete
  using (user_id = auth.uid() or is_admin(auth.uid()));

-- DM(messages)/memo 채팅(post_chat_messages)과 동일하게 실시간 반영.
alter publication supabase_realtime add table feedback_messages;

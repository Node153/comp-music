-- DM-02 읽음/안읽음 표시를 위해 messages.read_at을 갱신할 수 있어야 하는데,
-- 0002_rls.sql에는 messages에 대한 update 정책이 없어 기본 거부 상태였다.
-- 대화 참여자라면 그 대화의 메시지를 갱신할 수 있도록 허용한다(주로 read_at 갱신 용도).
create policy "messages_update_participant"
  on messages for update
  using (
    exists (
      select 1 from conversations c
      where c.id = conversation_id
        and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid())
    )
  );

-- 메시지 전송 시 conversations.last_message_at도 갱신해야 하는데(DM-02 목록 정렬),
-- 0002_rls.sql에는 conversations update 정책이 없었다.
create policy "conversations_update_participant"
  on conversations for update
  using (user_a_id = auth.uid() or user_b_id = auth.uid());

-- DM-01: Supabase Realtime(5.1 추천 스택)으로 새 메시지를 즉시 반영하려면
-- messages 테이블이 realtime publication에 포함돼 있어야 한다.
alter publication supabase_realtime add table messages;

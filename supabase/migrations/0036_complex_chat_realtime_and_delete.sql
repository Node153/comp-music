-- memo 채팅 실시간 반영 + 본인 메시지 삭제 허용.
-- 0012에서 "이번 범위에서 보류"라며 일부러 꺼둔 걸 뒤늦게 켠다 — DM(messages 테이블)은
-- 이미 실시간인데 정작 협업 채팅 쪽이 새로고침(🔄) 버튼에 의존하던 것을 맞춘다.
alter publication supabase_realtime add table post_chat_messages;

-- 삭제는 그동안 RLS에 아예 없어서 UI로도 못 만들었다 — 본인이 보낸 메시지만 삭제 가능.
create policy "post_chat_messages_delete_self"
  on post_chat_messages for delete
  using (sender_id = auth.uid());

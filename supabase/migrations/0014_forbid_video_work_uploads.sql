-- 정책: 재창작물(post_chat_messages)에는 영상 파일을 올릴 수 없다 — 방장이든 협업 참여자든
-- 예외 없이 금지. 원본 게시물(1차, posts.video_url) 자체는 영향 없음(별개 업로드 플로우).
drop policy "post_chat_messages_insert_participant" on post_chat_messages;

create policy "post_chat_messages_insert_participant"
  on post_chat_messages for insert
  with check (
    sender_id = auth.uid()
    and is_approved(auth.uid())
    and can_access_post_content(post_id, auth.uid())
    and type <> 'video'
    and (
      type = 'text'
      or exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid())
      or exists (select 1 from posts p where p.id = post_id and p.collab_available = true)
    )
  );

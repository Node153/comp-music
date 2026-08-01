-- 정책: 이미지는 재창작물(work)로는 여전히 못 쓰지만, 일반 채팅 메시지(is_work=false)로는
-- 업로드할 수 있다. 재창작물은 0015 그대로 음원만 허용(방장 또는 협업 구함 게시물 참여자).
-- 텍스트/이미지는 게시물 열람 가능한 참여자라면 누구나(협업 구함 여부와 무관) 보낼 수 있음.
drop policy "post_chat_messages_insert_participant" on post_chat_messages;

create policy "post_chat_messages_insert_participant"
  on post_chat_messages for insert
  with check (
    sender_id = auth.uid()
    and is_approved(auth.uid())
    and can_access_post_content(post_id, auth.uid())
    and (
      (type = 'text' and is_work = false)
      or (type = 'image' and is_work = false)
      or (
        type = 'audio'
        and (
          exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid())
          or exists (select 1 from posts p where p.id = post_id and p.collab_available = true)
        )
      )
    )
  );

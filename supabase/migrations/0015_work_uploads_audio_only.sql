-- 정책: 재창작물(work)은 음원 파일만 허용 — 이미지/영상/텍스트는 재창작물로 못 올린다.
-- 텍스트는 계속 일반 채팅(is_work=false)으로만 가능. 음원은 기존처럼 방장 또는
-- 협업 구함 켜진 게시물의 참여자만 올릴 수 있다.
drop policy "post_chat_messages_insert_participant" on post_chat_messages;

create policy "post_chat_messages_insert_participant"
  on post_chat_messages for insert
  with check (
    sender_id = auth.uid()
    and is_approved(auth.uid())
    and can_access_post_content(post_id, auth.uid())
    and (
      (type = 'text' and is_work = false)
      or (
        type = 'audio'
        and (
          exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid())
          or exists (select 1 from posts p where p.id = post_id and p.collab_available = true)
        )
      )
    )
  );

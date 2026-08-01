-- 정책: 게시물 업로드 시 "협업 구함"을 체크해야만 작성자(방장) 외의 사용자가 이미지/오디오
-- 재창작물을 올릴 수 있다. 지금까지는 협업 구함이 꺼져 있으면 방장 본인도 못 올렸는데,
-- 방장은 자기 게시물에 언제든 자기 작업물(다른 믹스/버전 등)을 추가할 수 있어야 하므로
-- "협업 구함" 여부와 무관하게 항상 허용하도록 post_chat_messages_insert_participant를 갱신한다.
-- video/text는 이전처럼 누구나 항상 허용.
drop policy "post_chat_messages_insert_participant" on post_chat_messages;

create policy "post_chat_messages_insert_participant"
  on post_chat_messages for insert
  with check (
    sender_id = auth.uid()
    and is_approved(auth.uid())
    and can_access_post_content(post_id, auth.uid())
    and (
      type in ('text', 'video')
      or exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid())
      or exists (select 1 from posts p where p.id = post_id and p.collab_available = true)
    )
  );

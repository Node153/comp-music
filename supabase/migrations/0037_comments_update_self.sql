-- 댓글 수정 허용 — 지금까지 comments는 select/insert/delete 정책만 있고 update는 없어서
-- 화면에서 만들려고 해도 DB가 막았다. 본인 댓글만 수정 가능.
create policy "comments_update_self"
  on comments for update
  using (user_id = auth.uid());

-- memo 합작 게시물 고정을 완전히 토글 가능하게(사용자 요청) — 자동 고정(본인 글·
-- invite_only로 초대받은 글)도 사용자가 원하면 해제할 수 있어야 한다. post_pins에
-- pinned 컬럼을 추가해 "명시적으로 고정"/"명시적으로 고정 해제" 두 상태를 다 표현한다.
-- 행이 없으면 feed/page.tsx의 자동 규칙(본인 글·초대받은 글)을 그대로 따르고, 행이
-- 있으면 그 값이 자동 규칙을 덮어쓴다 — 그래서 upsert 한 번으로 양방향 토글이 된다.
alter table post_pins add column pinned boolean not null default true;

-- upsert(insert ... on conflict do update)라 update 쪽 정책도 있어야 기존 행을 다시
-- 토글할 수 있다 — insert 정책과 동일한 제약(본인 행 · 접근 가능한 합작 게시물만).
create policy "post_pins_update_self"
  on post_pins for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and can_access_post_content(post_id, auth.uid())
    and exists (select 1 from posts p where p.id = post_id and p.collab_available)
  );

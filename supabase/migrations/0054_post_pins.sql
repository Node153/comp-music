-- memo 탭 합작(collab_available) 게시물 상단 고정 — 자동 고정(본인 글 · invite_only로
-- 초대받은 글, feed/page.tsx가 posts/post_access만으로 서버에서 판단)과는 별개로, 그 외
-- 합작 게시물(예: Companion 공개로 그냥 보이는 남의 합작 글)도 보는 사람이 원하면 자기
-- 화면에서만 상단에 고정할 수 있게 하는 개인화 테이블(사용자 요청) — like처럼 다른 사람
-- 에게도 보이는 공개 행동이 아니라, 본인만 보는 표시라 select도 본인 행만 허용한다.
create table post_pins (
  post_id    uuid not null references posts(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index post_pins_user_id_idx on post_pins(user_id);

alter table post_pins enable row level security;

create policy "post_pins_select_self"
  on post_pins for select
  using (user_id = auth.uid());

-- 아무 게시물이나 고정할 수 있는 건 아니고, 실제로 그 게시물 내용에 접근 가능한
-- 합작 게시물만(can_access_post_content, 0012/0017) — 스팸성으로 못 보는 글까지
-- 고정 목록에 넣을 이유가 없다.
create policy "post_pins_insert_self"
  on post_pins for insert
  with check (
    user_id = auth.uid()
    and can_access_post_content(post_id, auth.uid())
    and exists (select 1 from posts p where p.id = post_id and p.collab_available)
  );

create policy "post_pins_delete_self"
  on post_pins for delete
  using (user_id = auth.uid());

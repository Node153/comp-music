-- 게시물 조회자 목록(인스타 스토리 참고, 사용자 요청) — memo에서 공동창작 미체크 게시물에
-- "누가 봤는지" 보여주기 위한 최소 테이블. 좋아요/댓글(likes/comments)과 같은 자리에서
-- 쓰이지만 의미가 다르다 — 좋아요/댓글은 본인이 남긴 행동이 다른 사람에게도 보이는 반면,
-- 조회 기록은 "봤다"는 사실 자체가 프라이버시라 작성자 본인만 목록을 볼 수 있게 한다.
create table post_views (
  post_id    uuid not null references posts(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index post_views_post_id_idx on post_views(post_id);

alter table post_views enable row level security;

-- 기록은 본인 것만, 그리고 본인이 실제로 그 게시물 내용에 접근 가능할 때만(can_access_post_content,
-- 0012/0017) — 스팸성으로 아무 게시물에나 조회 기록을 남길 수 없게. 작성자 본인의 조회는
-- 클라이언트에서 아예 시도하지 않지만(자기 글 보는 걸 "조회"로 셀 이유가 없음), 혹시 몰라
-- DB에서도 막아둔다.
create policy "post_views_insert_self"
  on post_views for insert
  with check (
    user_id = auth.uid()
    and user_id <> (select p.user_id from posts p where p.id = post_id)
    and is_approved(auth.uid())
    and can_access_post_content(post_id, auth.uid())
  );

-- 목록 조회는 작성자 본인만(인스타 스토리와 동일 원칙) — 누가 내 글을 봤는지는 나만 안다.
create policy "post_views_select_owner"
  on post_views for select
  using (
    exists (select 1 from posts p where p.id = post_views.post_id and p.user_id = auth.uid())
  );

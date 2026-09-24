-- 맞춤형 피드(2026-09-24, 사용자 요청) — "최신순 + 아직 재생 안 한 게시물 먼저 + 게시자 다양하게"
-- + 10개씩 무한 스크롤.
--
-- 1) post_plays: "이 유저가 이 게시물을 5초 이상 재생했다" 1인당 1행. posts.view_count(0053,
--    30초 누적 재생 카운터)나 post_views(0051, memo 화면 노출 = "봤다", 작성자만 조회)와 의미가
--    달라 따로 둔다 — 피드 정렬에 쓰려면 본인이 자기 기록을 읽을 수 있어야 한다.
create table post_plays (
  post_id    uuid not null references posts(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  played_at  timestamptz not null default now(),
  primary key (user_id, post_id)
);

alter table post_plays enable row level security;

create policy "post_plays_select_self"
  on post_plays for select
  using (user_id = auth.uid());

create policy "post_plays_insert_self"
  on post_plays for insert
  with check (user_id = auth.uid() and is_approved(auth.uid()));

-- 클라이언트(NowPlayingContext)가 5초 재생 시점에 부른다. 중복은 조용히 무시.
create or replace function public.mark_post_played(pid uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into post_plays (post_id, user_id)
  values (pid, auth.uid())
  on conflict do nothing;
$$;

grant execute on function public.mark_post_played(uuid) to authenticated;

-- 2) feed_candidates: 피드 한 페이지분 후보를 (published_at, id) 키셋 커서로 가져온다.
--    security invoker라 posts RLS(승인 회원 전체 / 게스트는 public만)가 그대로 걸린다.
--    - p_scope 'demo' = visibility public, 'memo' = 그 외 + 본인 또는 Companion의 글만
--      (예전엔 20개를 가져온 뒤 JS에서 걸러서 페이지 크기가 들쭉날쭉했다).
--    - p_played: false면 아직 재생 안 한 글, true면 재생한 글. 게스트(auth.uid() null)는
--      재생 기록이 없으므로 p_played=false에 전부 나온다.
--    - p_ids가 주어지면 커서/재생여부 무시하고 그 id들만(이전 페이지에서 게시자 섞기로 미뤄둔
--      글을 다시 불러올 때) — 이때도 scope/만료/Companion 조건은 똑같이 적용된다.
create or replace function public.feed_candidates(
  p_scope text,
  p_tag text default null,
  p_played boolean default false,
  p_before_ts timestamptz default null,
  p_before_id uuid default null,
  p_limit int default 20,
  p_ids uuid[] default null
)
returns setof posts
language sql
stable
security invoker
set search_path = public
as $$
  select p.*
  from posts p
  where p.status = 'published'
    and p.published_at is not null
    and (p.expires_at is null or p.expires_at > now())
    and (
      (p_scope = 'demo' and p.visibility = 'public')
      or (
        p_scope = 'memo'
        and p.visibility <> 'public'
        and auth.uid() is not null
        and (p.user_id = auth.uid() or are_companions(p.user_id, auth.uid()))
      )
    )
    and (p_tag is null or p.instrument_tags @> array[p_tag])
    and (
      p_ids is not null
      or (
        (
          auth.uid() is null and not p_played
          or auth.uid() is not null and exists (
            select 1 from post_plays pp where pp.post_id = p.id and pp.user_id = auth.uid()
          ) = p_played
        )
        and (p_before_ts is null or (p.published_at, p.id) < (p_before_ts, p_before_id))
      )
    )
    and (p_ids is null or p.id = any(p_ids))
  order by p.published_at desc, p.id desc
  limit least(greatest(p_limit, 1), 50);
$$;

grant execute on function public.feed_candidates(text, text, boolean, timestamptz, uuid, int, uuid[]) to anon, authenticated;

create index if not exists posts_feed_order_idx on posts (published_at desc, id desc) where status = 'published';

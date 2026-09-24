-- PEAK 유력 후보 항상 채우기(2026-09-25, 사용자 요청 — "3개만 추려서 무조건 카드가 보이게").
-- 0081은 점수 0인 글·내가 Kick한 글·내 글을 빼서 파일럿처럼 글이 적을 땐 목록이 비었다. 이제는
-- 아직 PEAK 아닌 DEMO 전체를 우선순위(tier) → PEAK 점수 → 최신순으로 줄 세워 위에서
-- 자른다 — 조건 좋은 글이 모자라면 다음 순위로 자동으로 채워진다.
--   tier 0: 남의 글, 점수 > 0, 내가 아직 Kick 안 함(반응을 보탤 여지가 가장 큰 후보)
--   tier 1: 남의 글, 점수 0
--   tier 2: 남의 글, 내가 이미 Kick함(더 보탤 건 청취·공유)
--   tier 3: 내 글(공유로 PEAK 올리기)
-- 같은 순위 안에서는 바로 재생되는 음원/영상을 이미지보다 앞에 둔다(이미지 글도 PEAK 대상이라
-- 후보가 모자랄 때 채우는 용도로 포함 — 레일에서 누르면 재생 대신 그 게시물로 이동).
drop function if exists public.peak_candidates(int);
create function public.peak_candidates(p_limit int default 3)
returns table (
  post jsonb, like_count integer, kick_count integer, score integer,
  my_liked boolean, my_kicked boolean, is_mine boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select to_jsonb(p.*) as post, s.likes, s.kicks, s.score, m.liked, m.kicked, p.user_id = auth.uid()
  from posts p
  cross join lateral (
    select lc.n as likes, kc.n as kicks, (p.view_count + lc.n * 10 + kc.n * 100)::int as score
    from (select count(*)::int as n from likes l where l.post_id = p.id) lc,
         (select count(*)::int as n from kicks k where k.post_id = p.id) kc
  ) s
  cross join lateral (
    select
      exists (select 1 from likes l where l.post_id = p.id and l.user_id = auth.uid()) as liked,
      exists (select 1 from kicks k where k.post_id = p.id and k.user_id = auth.uid()) as kicked
  ) m
  where auth.uid() is not null
    and p.status = 'published'
    and p.visibility = 'public'
    and p.peaked_at is null
    and (p.expires_at is null or p.expires_at > now())
  order by
    case
      when p.user_id = auth.uid() then 3
      when m.kicked then 2
      when s.score = 0 then 1
      else 0
    end,
    (p.media_type not in ('audio', 'video')),
    s.score desc,
    p.published_at desc
  limit least(greatest(p_limit, 1), 20);
$$;
grant execute on function public.peak_candidates(int) to authenticated;

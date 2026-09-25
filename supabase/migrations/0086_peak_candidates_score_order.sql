-- PEAK 유력 후보 순서를 PEAK 점수 하나로(2026-09-25, 사용자 요청 — "Kick한 게시물이 훨씬 유력 후보인데
-- 밀려 있다"). 0082는 내가 Kick한 글·점수 0인 글·내 글을 뒤로 미는 순위(tier)를 먼저 걸어서, Kick까지
-- 받은 최고점 글이 3장 밖으로 빠졌다. 이제는 누가 봐도 같은 순서 — 조회수 + 좋아요*10 + Kick*100
-- (check_and_set_post_peak(0085)·feedConstants.peakScore와 같은 수식) 내림차순, 동점이면 최신순.
-- 집계는 security definer로 해서 RLS와 무관하게 전체 좋아요·Kick을 센다(개수만 돌려주고, 대상은
-- 전체공개 DEMO뿐이라 노출 범위는 피드와 같다). 항상 3장 채우기(0082)는 그대로 — 점수 0인 글도 포함.
drop function if exists public.peak_candidates(int);
create function public.peak_candidates(p_limit int default 3)
returns table (
  post jsonb, like_count integer, kick_count integer, score integer,
  my_liked boolean, my_kicked boolean, is_mine boolean
)
language sql
stable
security definer
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
    and is_approved(auth.uid())
    and p.status = 'published'
    and p.visibility = 'public'
    and p.peaked_at is null
    and (p.expires_at is null or p.expires_at > now())
  order by s.score desc, p.published_at desc
  limit least(greatest(p_limit, 1), 20);
$$;
revoke execute on function public.peak_candidates(int) from public, anon;
grant execute on function public.peak_candidates(int) to authenticated;

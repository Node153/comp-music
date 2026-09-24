-- PEAK 유력 후보(2026-09-25, 사용자 요청) — 피드 상단 가로 목록을 "첫 반응을 기다리는 Drop"에서
-- "PEAK 유력 후보"로 바꾼다. 아직 PEAK이 아닌 남의 DEMO 중 PEAK 점수(조회수 + 좋아요*10 + Kick*100,
-- check_and_set_post_peak(0071)·feedConstants.peakScore와 같은 수식)가 높은 순 — 기준(1000)에 가장
-- 가까운 글부터 보여주고 반응을 보태 PEAK에 올리도록 유도한다. 내가 이미 Kick한 글은 더 보탤 수
-- 있는 게 없어서 뺀다(좋아요만 한 글은 Kick 여지가 있어 남긴다). security invoker라 RLS 그대로.
create or replace function public.peak_candidates(p_limit int default 8)
returns table (post jsonb, like_count integer, kick_count integer, score integer, my_liked boolean)
language sql
stable
security invoker
set search_path = public
as $$
  select to_jsonb(p.*) as post, s.likes, s.kicks, s.score,
    exists (select 1 from likes l where l.post_id = p.id and l.user_id = auth.uid()) as my_liked
  from posts p
  cross join lateral (
    select lc.n as likes, kc.n as kicks, (p.view_count + lc.n * 10 + kc.n * 100)::int as score
    from (select count(*)::int as n from likes l where l.post_id = p.id) lc,
         (select count(*)::int as n from kicks k where k.post_id = p.id) kc
  ) s
  where auth.uid() is not null
    and p.status = 'published'
    and p.visibility = 'public'
    and p.peaked_at is null
    and (p.expires_at is null or p.expires_at > now())
    and p.user_id <> auth.uid()
    and s.score > 0
    and not exists (select 1 from kicks k where k.post_id = p.id and k.user_id = auth.uid())
  order by s.score desc, p.published_at desc
  limit least(greatest(p_limit, 1), 20);
$$;
grant execute on function public.peak_candidates(int) to authenticated;

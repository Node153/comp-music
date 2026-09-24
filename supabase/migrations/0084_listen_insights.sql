-- 업로더용 "들은 기록"(2026-09-25) — 좋아요가 적어도 실제로 몇 명이 들었는지 본인에게만 보여준다.
--   listeners: 이 글을 5초 이상 재생한 다른 회원 수(post_plays, 0072 — 2026-09-24부터 기록)
--   finished : 한 번에 90% 이상 들은 다른 회원 수(analytics_events play_end, 0079 — 2026-09-25부터)
--   avg_pct  : 회원별 최고 청취 비율의 평균(play_end 기록이 있는 회원만)
-- post_plays는 본인 행만, analytics_events는 관리자만 읽을 수 있어서 security definer로 모으되
-- 요청자 본인 글(posts.user_id = auth.uid())만 돌려준다. 작성자 본인 재생은 뺀다.
create or replace function public.my_post_listen_stats(p_post_ids uuid[])
returns table (post_id uuid, listeners int, finished int, avg_pct int)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select p.id, p.user_id
    from posts p
    where p.id = any(p_post_ids) and p.user_id = auth.uid()
  ),
  plays as (
    select pp.post_id, count(*)::int as n
    from post_plays pp
    join mine m on m.id = pp.post_id
    where pp.user_id <> m.user_id
    group by pp.post_id
  ),
  best as (
    select e.post_id, e.user_id, max((e.props->>'pct')::int) as pct
    from analytics_events e
    join mine m on m.id = e.post_id
    where e.name = 'play_end'
      and e.user_id is not null
      and e.user_id <> m.user_id
      and jsonb_typeof(e.props->'pct') = 'number'
    group by e.post_id, e.user_id
  ),
  agg as (
    select post_id,
           count(*) filter (where pct >= 90)::int as finished,
           round(avg(pct))::int as avg_pct
    from best
    group by post_id
  )
  select m.id,
         -- 5초 미만 곡 등으로 끝까지 들은 사람이 들은 사람보다 많아 보이지 않게 맞춘다.
         greatest(coalesce(plays.n, 0), coalesce(agg.finished, 0)),
         coalesce(agg.finished, 0),
         agg.avg_pct
  from mine m
  left join plays on plays.post_id = m.id
  left join agg on agg.post_id = m.id;
$$;

revoke execute on function public.my_post_listen_stats(uuid[]) from public, anon;
grant execute on function public.my_post_listen_stats(uuid[]) to authenticated;

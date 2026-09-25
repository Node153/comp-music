-- PEAK 기준 1000 → 500(2026-09-25, 사용자 요청). feedConstants.PEAK_VIEW_THRESHOLD와 같은 값이어야 한다.
-- 점수 수식은 그대로: 조회수 + 좋아요*10 + Kick*100.
create or replace function public.check_and_set_post_peak(pid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_view_count integer;
  v_like_count integer;
  v_kick_count integer;
begin
  select view_count into v_view_count from posts where id = pid and peaked_at is null;
  if v_view_count is null then
    return; -- 게시물이 없거나 이미 PEAK 상태(재계산 불필요)
  end if;

  select count(*) into v_like_count from likes where post_id = pid;
  select count(*) into v_kick_count from kicks where post_id = pid;

  if v_view_count + v_like_count * 10 + v_kick_count * 100 >= 500 then
    update posts set peaked_at = now() where id = pid and peaked_at is null;
  end if;
end;
$$;

-- 이미 500점 이상인데 아직 PEAK이 아닌 게시물은 지금 PEAK으로 기록.
update posts
set peaked_at = now()
where peaked_at is null
  and view_count
      + (select count(*) from likes where likes.post_id = posts.id) * 10
      + (select count(*) from kicks where kicks.post_id = posts.id) * 100 >= 500;

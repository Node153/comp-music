-- PEAK 게시물 상태 영구 고정(사용자 요청) — 지금까지는 RightSidebar가 매번 조회수+좋아요로
-- peakScore를 다시 계산해서 기준(PEAK_VIEW_THRESHOLD)을 넘는 게시물만 그때그때 보여줬다.
-- 좋아요를 취소(LikeButton 토글, likes delete)하면 점수가 기준 아래로 떨어져 PEAK 목록에서
-- 빠지는 문제가 있었다 — "한 번 PEAK을 찍으면 좋아요를 회수해도 PEAK 유지"가 요구사항이라,
-- 점수가 기준을 넘는 순간의 타임스탬프를 posts.peaked_at에 한 번만 기록하고 이후로는 절대
-- 지우지 않는다(view_count도 취소가 없어서 사실상 peaked_at이 한 번 찍히면 영구적).
alter table posts add column peaked_at timestamptz;

-- 조회수/좋아요 수식은 src/lib/feedConstants.ts의 PEAK_VIEW_THRESHOLD(1000)·PEAK_LIKE_WEIGHT(10)와
-- 반드시 같이 맞춰야 한다 — 여기 값만 바꾸면 서버 쪽 판정이 클라이언트 표시 기준과 어긋난다.
create or replace function public.check_and_set_post_peak(pid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_view_count integer;
  v_like_count integer;
begin
  select view_count into v_view_count from posts where id = pid and peaked_at is null;
  if v_view_count is null then
    return; -- 게시물이 없거나 이미 PEAK 상태(재계산 불필요)
  end if;

  select count(*) into v_like_count from likes where post_id = pid;

  if v_view_count + v_like_count * 10 >= 1000 then
    update posts set peaked_at = now() where id = pid and peaked_at is null;
  end if;
end;
$$;

-- 조회수 증가 시점(increment_post_view)마다 PEAK 진입 여부를 같이 확인한다.
create or replace function public.increment_post_view(pid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update posts
    set view_count = view_count + 1
    where id = pid and visibility = 'public';
  select public.check_and_set_post_peak(pid);
$$;

-- 좋아요는 클라이언트에서 likes 테이블에 직접 insert하므로(LikeButton/usePostLike) 여기서도
-- 트리거로 같은 검사를 걸어야 "좋아요로 막 기준을 넘긴" 게시물도 놓치지 않는다.
create or replace function public.likes_check_peak()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.check_and_set_post_peak(new.post_id);
  return new;
end;
$$;

drop trigger if exists likes_after_insert_check_peak on likes;
create trigger likes_after_insert_check_peak
  after insert on likes
  for each row
  execute function public.likes_check_peak();

-- 배포 시점 기준 이미 조건을 만족한 기존 게시물(예: DEMO "shine")도 소급 적용해서 이 변경으로
-- PEAK 상태를 잃지 않게 한다.
update posts set peaked_at = now()
where peaked_at is null
  and status = 'published'
  and view_count + (select count(*) from likes where likes.post_id = posts.id) * 10 >= 1000;

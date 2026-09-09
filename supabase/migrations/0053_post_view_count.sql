-- DEMO 게시물 조회수(재생 횟수) — 사용자 요청. 나중에 PEAK 기준을 좋아요 외에 조회수도
-- 볼지 판단할 근거 데이터를 우선 쌓아두는 용도(기준 자체는 아직 미정, /goal 논의 참고).
--
-- 조회수는 유튜브처럼 같은 사람이 다시 재생해도 매번 카운트한다(사용자 요청) — 그래서
-- post_views(0051, memo "누가 봤는지" 목록용, 1인당 1행)와 달리 여기는 단순 누적 카운터로
-- 충분하고 별도 테이블이 필요 없다.
--
-- 좋아요와 달리 "본인 게시물이 아닌" 남의 게시물 조회수를 늘려야 해서 클라이언트에서
-- 직접 update를 못 친다(RLS로 막힘) — 그래서 전용 함수를 둔다. 비로그인 방문자도 DEMO
-- 미리보기를 볼 수 있어서 anon도 호출 가능해야 한다.
alter table posts add column view_count integer not null default 0;

create or replace function public.increment_post_view(pid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update posts
    set view_count = view_count + 1
    where id = pid and visibility = 'public';
$$;

grant execute on function public.increment_post_view(uuid) to anon, authenticated;

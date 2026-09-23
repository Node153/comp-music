-- Kick(2026-09-24, 사용자 요청) — 좋아요의 상위 반응. 그동안 화면에서 좋아요를 "Kick"이라고
-- 불러왔는데, 좋아요는 좋아요대로 두고 Kick을 "이번 주 가장 인상 깊었던 게시물에 주는 한 표"로
-- 따로 만든다. 규칙:
--   - 한 사람당 일주일(월요일 0시 KST 시작)에 1번, 이월 없음
--   - 번복 불가 — 취소도 다른 게시물로 옮기기도 안 된다(DELETE 정책 자체가 없음)
--   - 같은 게시물에는 한 사람당 평생 1번
--   - DEMO(전체공개, published) 게시물에만, 내 게시물엔 불가
--   - Kick하면 좋아요도 자동으로 켜지고, 그 좋아요는 취소할 수 없다
--   - 누가 Kick했는지는 공개(post_kickers)
--   - 게시물이 삭제되면 kicks 행도 cascade로 지워져서 그 주의 Kick이 자연스럽게 돌아온다
-- PEAK 점수 가중치: Kick 1개 = 조회수 100(좋아요 10개 몫). src/lib/feedConstants.ts의
-- PEAK_KICK_WEIGHT와 반드시 같이 맞출 것.

create table kicks (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  week_start date not null,
  created_at timestamptz not null default now(),
  unique (user_id, week_start),
  unique (user_id, post_id)
);

create index idx_kicks_post on kicks (post_id);

alter table kicks enable row level security;

-- 읽기는 likes와 같은 범위(0002 likes_select_approved_users, 0024 likes_select_public_posts).
-- INSERT/UPDATE/DELETE 정책은 일부러 만들지 않는다 — 쓰기는 give_kick(security definer)만.
create policy "kicks_select_approved_users"
  on kicks for select
  using (is_approved(auth.uid()));

create policy "kicks_select_public_posts"
  on kicks for select
  using (
    exists (
      select 1 from posts p
      where p.id = post_id and p.visibility = 'public' and p.status in ('published', 'expired')
    )
  );

-- 이번 주 시작일(월요일, Asia/Seoul) — currentWeekStartISO()(feedConstants.ts)와 같은 경계.
create or replace function public.current_kick_week_start()
returns date
language sql
stable
as $$
  select date_trunc('week', now() at time zone 'Asia/Seoul')::date;
$$;

-- PEAK 점수에 Kick 반영: 조회수 + 좋아요*10 + Kick*100 >= 1000.
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

  if v_view_count + v_like_count * 10 + v_kick_count * 100 >= 1000 then
    update posts set peaked_at = now() where id = pid and peaked_at is null;
  end if;
end;
$$;

-- Kick 주기 — 유일한 쓰기 경로. 실패 사유는 예외 메시지(코드 문자열)로 돌려주고
-- /api/kicks가 화면 문구로 바꾼다.
create or replace function public.give_kick(pid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_week date := current_kick_week_start();
  v_author uuid;
  v_visibility text;
  v_status text;
begin
  if v_uid is null or not is_approved(v_uid) then
    raise exception 'not_allowed';
  end if;

  select user_id, visibility, status into v_author, v_visibility, v_status from posts where id = pid;
  if v_author is null or v_visibility <> 'public' or v_status <> 'published' then
    raise exception 'post_not_kickable';
  end if;
  if v_author = v_uid then
    raise exception 'own_post';
  end if;
  if exists (select 1 from kicks where user_id = v_uid and post_id = pid) then
    raise exception 'already_kicked';
  end if;
  if exists (select 1 from kicks where user_id = v_uid and week_start = v_week) then
    raise exception 'weekly_used';
  end if;

  begin
    insert into kicks (post_id, user_id, week_start) values (pid, v_uid, v_week);
  exception when unique_violation then
    -- 위 검사와 insert 사이에 다른 탭에서 동시에 누른 경우
    raise exception 'weekly_used';
  end;

  insert into likes (post_id, user_id) values (pid, v_uid) on conflict (post_id, user_id) do nothing;
  perform public.check_and_set_post_peak(pid);
end;
$$;

revoke all on function public.give_kick(uuid) from public;
revoke execute on function public.give_kick(uuid) from anon;
grant execute on function public.give_kick(uuid) to authenticated;

-- 게시물별 Kick한 사람 목록(공개) — DEMO는 누구에게나 닉네임만 보여주는 공간이라
-- user_display(Companion이면 실명) 대신 nickname을 직접 내려준다. 로그인한 승인 회원만.
create or replace function public.post_kickers(pids uuid[])
returns table (post_id uuid, user_id uuid, nickname text, created_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select k.post_id, k.user_id, u.nickname, k.created_at
  from kicks k
  join posts p on p.id = k.post_id
  join users u on u.id = k.user_id
  where k.post_id = any(pids)
    and p.visibility = 'public'
    and is_approved(auth.uid())
  order by k.created_at desc;
$$;

revoke all on function public.post_kickers(uuid[]) from public;
revoke execute on function public.post_kickers(uuid[]) from anon;
grant execute on function public.post_kickers(uuid[]) to authenticated;

-- Kick한 게시물의 좋아요는 취소 불가(번복 불가 규칙의 연장) — DB에서도 막는다.
drop policy if exists "likes_delete_self" on likes;
create policy "likes_delete_self"
  on likes for delete
  using (
    user_id = auth.uid()
    and not exists (
      select 1 from kicks k where k.post_id = likes.post_id and k.user_id = likes.user_id
    )
  );

-- Kick 이메일 알림 — 드물고 의미가 큰 알림이라 좋아요(기본 꺼짐)와 달리 기본 켜짐,
-- 하루 1회 다이제스트가 아니라 Kick을 받는 즉시 보낸다(/api/kicks).
alter table users add column email_notify_kick boolean not null default true;

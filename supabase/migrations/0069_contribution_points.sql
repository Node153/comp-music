-- 피드백 기여 점수 + 회원 랭킹(2026-09-24). 단계/뱃지 없이 점수와 랭킹만.
--
-- 점수는 운영자가 인정했거나 다른 회원이 공감한 "검증된 행동"에만 준다(글 수로는 안 줌):
--   feedback_reviewing  +3   내 의견이 "검토 중"으로 채택
--   feedback_done       +10  내 의견이 "반영됨" (버그 유형이면 +15)
--   like_received       +1   내 공개 의견이 받은 공감 — 의견 하나당 최대 10, 한 달 최대 30,
--                            가입 7일 미만 계정의 공감은 제외, 공감 취소 시 회수
--   liked_done          +1   내가 공감한 의견이 반영됨 — 한 달 최대 5
--   pulse_comment       +1   짧은 설문에 점수+코멘트 응답
-- 관리자 본인 글·자동 반영 소식 메시지는 점수 대상이 아니다. 피드백이 삭제되면(스팸 처리 등)
-- 관련 점수는 cascade로 회수된다. 점수 기록은 트리거(security definer)만 쓰고 클라이언트 쓰기
-- 경로는 없다. source_key unique로 같은 이유의 중복 적립을 막는다.
--
-- 랭킹은 이번 달(Asia/Seoul 기준, 매달 1일 새로 시작)과 누적. 동점이면 그 점수에 먼저 도달한
-- 사람(마지막 적립이 이른 사람)이 위. users.hide_from_ranking이면 목록에서만 빠지고 점수는 쌓인다.
-- 순위 알림은 좋은 소식만 — 이번 달 3위 안 진입/1위 달성 때 한 번씩(contribution_milestones).

create table contribution_events (
  id          bigserial primary key,
  user_id     uuid not null references users(id) on delete cascade,
  kind        text not null check (kind in ('feedback_reviewing', 'feedback_done', 'like_received', 'liked_done', 'pulse_comment')),
  points      integer not null,
  feedback_id uuid references feedback_messages(id) on delete cascade,
  source_key  text not null unique,
  created_at  timestamptz not null default now()
);

create index idx_contribution_events_created on contribution_events (created_at);
create index idx_contribution_events_user on contribution_events (user_id, created_at);

alter table contribution_events enable row level security;

create policy "contribution_events_select_own_or_admin"
  on contribution_events for select
  using (user_id = auth.uid() or is_admin(auth.uid()));

alter table users add column hide_from_ranking boolean not null default false;

create table contribution_milestones (
  user_id    uuid not null references users(id) on delete cascade,
  month      date not null,
  milestone  text not null check (milestone in ('top3', 'first')),
  created_at timestamptz not null default now(),
  primary key (user_id, month, milestone)
);

alter table contribution_milestones enable row level security;

create policy "contribution_milestones_select_own"
  on contribution_milestones for select
  using (user_id = auth.uid());

-- 이번 달 시작 시각(Asia/Seoul).
create or replace function public.contribution_month_start()
returns timestamptz
language sql
stable
as $$
  select date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
$$;

-- ── 기존 데이터 소급 적립(트리거 만들기 전 — 소급분으로 순위 알림이 쏟아지지 않게) ──
insert into contribution_events (user_id, kind, points, feedback_id, source_key, created_at)
select f.user_id, 'feedback_reviewing', 3, f.id, 'reviewing:' || f.id, coalesce(f.admin_updated_at, f.created_at)
from feedback_messages f join users u on u.id = f.user_id
where f.status = 'reviewing' and u.role <> 'admin' and f.announcement_id is null;

insert into contribution_events (user_id, kind, points, feedback_id, source_key, created_at)
select f.user_id, 'feedback_done', case when f.category = 'bug' then 15 else 10 end, f.id, 'done:' || f.id,
       coalesce(f.admin_updated_at, f.created_at)
from feedback_messages f join users u on u.id = f.user_id
where f.status = 'done' and u.role <> 'admin' and f.announcement_id is null;

insert into contribution_events (user_id, kind, points, feedback_id, source_key, created_at)
select author_id, 'like_received', 1, feedback_id, 'like:' || feedback_id || ':' || liker_id, created_at
from (
  select f.user_id as author_id, r.feedback_id, r.user_id as liker_id, r.created_at,
         row_number() over (partition by r.feedback_id order by r.created_at) as n
  from feedback_reactions r
  join feedback_messages f on f.id = r.feedback_id
  join users author on author.id = f.user_id
  join users liker on liker.id = r.user_id
  where not f.is_private and author.role <> 'admin' and r.user_id <> f.user_id
    and liker.created_at <= r.created_at - interval '7 days'
) x
where n <= 10;

insert into contribution_events (user_id, kind, points, source_key, created_at)
select p.user_id, 'pulse_comment', 1, 'pulse:' || p.id, p.created_at
from feedback_pulses p join users u on u.id = p.user_id
where p.score is not null and p.comment is not null and u.role <> 'admin';

-- ── 적립 트리거 ─────────────────────────────────────────────
create or replace function public.award_feedback_status_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author_role text;
begin
  if new.status is not distinct from old.status or new.announcement_id is not null then
    return new;
  end if;
  select role into author_role from users where id = new.user_id;
  if author_role = 'admin' then
    return new;
  end if;

  if new.status = 'reviewing' then
    insert into contribution_events (user_id, kind, points, feedback_id, source_key)
    values (new.user_id, 'feedback_reviewing', 3, new.id, 'reviewing:' || new.id)
    on conflict (source_key) do nothing;
  elsif new.status = 'done' then
    insert into contribution_events (user_id, kind, points, feedback_id, source_key)
    values (new.user_id, 'feedback_done', case when new.category = 'bug' then 15 else 10 end, new.id, 'done:' || new.id)
    on conflict (source_key) do nothing;

    -- 이 의견에 공감했던 회원들 +1(한 달 최대 5).
    insert into contribution_events (user_id, kind, points, feedback_id, source_key)
    select r.user_id, 'liked_done', 1, new.id, 'liked_done:' || new.id || ':' || r.user_id
    from feedback_reactions r
    join users u on u.id = r.user_id
    where r.feedback_id = new.id
      and u.role <> 'admin'
      and (
        select count(*) from contribution_events e
        where e.user_id = r.user_id and e.kind = 'liked_done' and e.created_at >= contribution_month_start()
      ) < 5
    on conflict (source_key) do nothing;
  end if;
  return new;
end;
$$;

create trigger award_feedback_status_points
  after update of status on feedback_messages
  for each row execute function public.award_feedback_status_points();

create or replace function public.award_like_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fb record;
begin
  select f.id, f.user_id, f.is_private, author.role as author_role
    into fb
  from feedback_messages f join users author on author.id = f.user_id
  where f.id = new.feedback_id;

  if fb.id is null or fb.is_private or fb.author_role = 'admin' or fb.user_id = new.user_id then
    return new;
  end if;
  if (select created_at from users where id = new.user_id) > now() - interval '7 days' then
    return new;
  end if;
  if (select count(*) from contribution_events where feedback_id = fb.id and kind = 'like_received') >= 10 then
    return new;
  end if;
  if (
    select coalesce(sum(points), 0) from contribution_events
    where user_id = fb.user_id and kind = 'like_received' and created_at >= contribution_month_start()
  ) >= 30 then
    return new;
  end if;

  insert into contribution_events (user_id, kind, points, feedback_id, source_key)
  values (fb.user_id, 'like_received', 1, fb.id, 'like:' || fb.id || ':' || new.user_id)
  on conflict (source_key) do nothing;
  return new;
end;
$$;

create trigger award_like_points
  after insert on feedback_reactions
  for each row execute function public.award_like_points();

create or replace function public.revoke_like_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from contribution_events where source_key = 'like:' || old.feedback_id || ':' || old.user_id;
  return old;
end;
$$;

create trigger revoke_like_points
  after delete on feedback_reactions
  for each row execute function public.revoke_like_points();

create or replace function public.award_pulse_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.score is not null and new.comment is not null
     and (select role from users where id = new.user_id) <> 'admin' then
    insert into contribution_events (user_id, kind, points, source_key)
    values (new.user_id, 'pulse_comment', 1, 'pulse:' || new.id)
    on conflict (source_key) do nothing;
  end if;
  return new;
end;
$$;

create trigger award_pulse_points
  after insert on feedback_pulses
  for each row execute function public.award_pulse_points();

-- ── 랭킹 ───────────────────────────────────────────────────
-- 이번 달/누적 순위표. 관리자·미승인·랭킹 숨김 회원은 제외, 점수 0 제외.
create or replace function public.contribution_leaderboard(p_period text default 'month', p_limit integer default 10)
returns table (user_id uuid, nickname text, points integer, rank integer)
language sql
stable
security definer
set search_path = public
as $$
  with ev as (
    select e.user_id, sum(e.points)::int as pts, max(e.created_at) as last_at
    from contribution_events e
    where p_period <> 'month' or e.created_at >= contribution_month_start()
    group by e.user_id
  ), ranked as (
    select ev.user_id, u.nickname, ev.pts,
           row_number() over (order by ev.pts desc, ev.last_at asc)::int as rk
    from ev join users u on u.id = ev.user_id
    where ev.pts > 0 and u.role <> 'admin' and u.status = 'approved' and not u.hide_from_ranking
  )
  select user_id, nickname, pts, rk from ranked
  where is_approved(auth.uid())
  order by rk
  limit greatest(1, least(p_limit, 50));
$$;

-- 내 기여도 — 이번 달/누적 점수·순위, 한 계단 위까지 남은 점수, 참가자 수. 랭킹을 숨겨도
-- 본인 순위는 (자신을 포함해 계산한) 값으로 보여준다.
create or replace function public.my_contribution()
returns table (
  month_points      integer,
  month_rank        integer,
  month_gap         integer,
  month_leader_gap  integer,
  month_participants integer,
  total_points      integer,
  total_rank        integer,
  hide_from_ranking boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select id, hide_from_ranking from users where id = auth.uid() and is_approved(auth.uid())
  ),
  base as (
    select e.user_id,
           sum(e.points) filter (where e.created_at >= contribution_month_start())::int as mpts,
           max(e.created_at) filter (where e.created_at >= contribution_month_start()) as mlast,
           sum(e.points)::int as tpts,
           max(e.created_at) as tlast
    from contribution_events e
    join users u on u.id = e.user_id
    where u.role <> 'admin' and u.status = 'approved'
      and (not u.hide_from_ranking or u.id = auth.uid())
    group by e.user_id
  ),
  m as (
    select user_id, mpts, row_number() over (order by mpts desc, mlast asc)::int as rk
    from base where coalesce(mpts, 0) > 0
  ),
  t as (
    select user_id, row_number() over (order by tpts desc, tlast asc)::int as rk
    from base where tpts > 0
  ),
  mine as (
    select
      coalesce((select mpts from base where user_id = me.id), 0) as mp,
      (select rk from m where user_id = me.id) as mr,
      coalesce((select tpts from base where user_id = me.id), 0) as tp,
      (select rk from t where user_id = me.id) as tr,
      me.hide_from_ranking as hidden
    from me
  )
  select
    mine.mp,
    mine.mr,
    case when mine.mr > 1 then (select m2.mpts from m m2 where m2.rk = mine.mr - 1) - mine.mp + 1 end,
    case when mine.mr > 1 then (select m2.mpts from m m2 where m2.rk = 1) - mine.mp + 1 end,
    (select count(*)::int from m),
    mine.tp,
    mine.tr,
    mine.hidden
  from mine;
$$;

revoke all on function public.contribution_leaderboard(text, integer) from public;
revoke all on function public.my_contribution() from public;
grant execute on function public.contribution_leaderboard(text, integer) to authenticated;
grant execute on function public.my_contribution() to authenticated;

-- ── 순위 알림(좋은 소식만): 이번 달 3위 안 진입 / 1위 달성 — 달마다 한 번씩 ──
create or replace function public.check_contribution_milestone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  my_rank integer;
  participants integer;
  this_month date := (now() at time zone 'Asia/Seoul')::date - (extract(day from now() at time zone 'Asia/Seoul')::int - 1);
begin
  with ev as (
    select e.user_id, sum(e.points) as pts, max(e.created_at) as last_at
    from contribution_events e join users u on u.id = e.user_id
    where e.created_at >= contribution_month_start()
      and u.role <> 'admin' and u.status = 'approved' and not u.hide_from_ranking
    group by e.user_id
    having sum(e.points) > 0
  ), ranked as (
    select user_id, row_number() over (order by pts desc, last_at asc) as rk from ev
  )
  select (select rk from ranked where user_id = new.user_id), (select count(*) from ranked)
    into my_rank, participants;

  -- 참가자가 3명 미만이면 랭킹 자체를 안 보여주므로 알림도 없음.
  if my_rank is null or participants < 3 then
    return new;
  end if;
  if my_rank <= 3 then
    insert into contribution_milestones (user_id, month, milestone) values (new.user_id, this_month, 'top3')
    on conflict do nothing;
  end if;
  if my_rank = 1 then
    insert into contribution_milestones (user_id, month, milestone) values (new.user_id, this_month, 'first')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger check_contribution_milestone
  after insert on contribution_events
  for each row execute function public.check_contribution_milestone();

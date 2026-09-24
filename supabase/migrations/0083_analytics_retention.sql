-- 이용 통계 3단계 — 보관기간 관리 + 운영자 주간 요약(2026-09-25, 사용자 요청).
--
-- 1) analytics_daily: 하루 단위 집계(개인 식별 정보 없음 — user_id/anon_id 없이 숫자만).
--    개인정보처리방침의 "이용기록은 수집일로부터 1년 후 파기, 이후엔 개인을 알아볼 수 없는 집계
--    수치로만 보관"을 실제로 지키기 위한 테이블. 매일 어제 하루분을 채운다.
-- 2) analytics_maintain(): 매일 expire-posts 크론이 호출 — 아직 집계 안 된 날(어제까지)을 채우고,
--    365일 지난 원본(analytics_sessions/events)을 지운다. service role 전용.
-- 3) admin_stats_core(): admin_stats(0080)의 본문을 관리자 확인 없이 떼어낸 것 — 로그인 사용자가 없는
--    크론(월요일 운영자 요약 메일)이 service role로 부른다. 화면용 admin_stats()는 관리자 확인 후
--    이걸 그대로 돌려준다(집계 로직은 한 곳에만).

create table analytics_daily (
  day              date primary key,          -- 한국 시간 기준 날짜
  visitors         integer not null default 0, -- 방문자(브라우저)
  member_visitors  integer not null default 0, -- 로그인 회원(운영자 포함 — 집계 시점엔 운영자 여부가 바뀔 수 있어 원값 보관)
  sessions         integer not null default 0,
  active_s         bigint  not null default 0,
  listen_s         bigint  not null default 0,
  devices          jsonb   not null default '{}'::jsonb,  -- {"mobile": n, ...} 방문자 수
  os               jsonb   not null default '{}'::jsonb,
  browsers         jsonb   not null default '{}'::jsonb,
  sources          jsonb   not null default '{}'::jsonb,  -- 방문 첫 진입 경로별 방문 수
  hours            jsonb   not null default '[]'::jsonb,  -- 0~23시 방문 시작 방문자 수 배열
  impressions      integer not null default 0,
  play_starts      integer not null default 0,
  play_ends        integer not null default 0,
  listened_30s     integer not null default 0,
  completed        integer not null default 0,
  shares           integer not null default 0,
  link_opens       jsonb   not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

alter table analytics_daily enable row level security;

create policy "analytics_daily_select_admin"
  on analytics_daily for select
  using (is_admin(auth.uid()));

create or replace function public.analytics_rollup_day(p_day date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from timestamptz := (p_day::timestamp at time zone 'Asia/Seoul');
  v_to   timestamptz := ((p_day + 1)::timestamp at time zone 'Asia/Seoul');
begin
  with
  s as (
    select * from analytics_sessions
    where started_at >= v_from and started_at < v_to and coalesce(entry_path, '') <> '/__deploy_check'
  ),
  e as (
    select * from analytics_events
    where occurred_at >= v_from and occurred_at < v_to and coalesce(path, '') <> '/__deploy_check'
  )
  insert into analytics_daily as d (
    day, visitors, member_visitors, sessions, active_s, listen_s, devices, os, browsers, sources, hours,
    impressions, play_starts, play_ends, listened_30s, completed, shares, link_opens
  )
  select
    p_day,
    (select count(distinct anon_id) from s),
    (select count(distinct user_id) from s),
    (select count(*) from s),
    (select coalesce(sum(active_seconds), 0) from s),
    (select coalesce(sum(listen_seconds), 0) from s),
    (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select coalesce(device_type, 'unknown') k, count(distinct anon_id) n from s group by 1) x),
    (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select coalesce(os, 'unknown') k, count(distinct anon_id) n from s group by 1) x),
    (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select coalesce(browser, 'unknown') k, count(distinct anon_id) n from s group by 1) x),
    (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select coalesce(entry_src, 'ref:' || referrer_host, 'direct') k, count(*) n from s group by 1) x),
    (select jsonb_agg(coalesce(x.n, 0) order by h.h)
       from generate_series(0, 23) as h(h)
       left join (select extract(hour from started_at at time zone 'Asia/Seoul')::int hh, count(distinct anon_id) n from s group by 1) x on x.hh = h.h),
    (select count(*) from e where name = 'post_impression'),
    (select count(*) from e where name = 'play_start'),
    (select count(*) from e where name = 'play_end'),
    (select count(*) from e where name = 'play_end' and (props->>'listened_s')::numeric >= 30),
    (select count(*) from e where name = 'play_end' and nullif(props->>'pct', '')::numeric >= 90),
    (select count(*) from e where name = 'share'),
    (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select props->>'src' k, count(*) n from e where name = 'link_open' group by 1) x)
  on conflict (day) do update set
    visitors = excluded.visitors, member_visitors = excluded.member_visitors, sessions = excluded.sessions,
    active_s = excluded.active_s, listen_s = excluded.listen_s, devices = excluded.devices, os = excluded.os,
    browsers = excluded.browsers, sources = excluded.sources, hours = excluded.hours,
    impressions = excluded.impressions, play_starts = excluded.play_starts, play_ends = excluded.play_ends,
    listened_30s = excluded.listened_30s, completed = excluded.completed, shares = excluded.shares,
    link_opens = excluded.link_opens, created_at = now();
end;
$$;

-- 어제(KST)까지 집계 안 된 날을 채우고(한 번에 최대 400일), 보관기간 지난 원본을 지운다.
-- 원본을 지우기 전에 그 날의 집계가 반드시 있도록 순서를 지킨다.
create or replace function public.analytics_maintain(p_keep_days integer default 365)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yesterday date := (now() at time zone 'Asia/Seoul')::date - 1;
  v_start     date;
  v_day       date;
  v_rolled    integer := 0;
  v_cutoff    timestamptz := now() - make_interval(days => greatest(30, coalesce(p_keep_days, 365)));
  v_del_s     integer;
  v_del_e     integer;
begin
  select coalesce(max(day) + 1, (select min((started_at at time zone 'Asia/Seoul')::date) from analytics_sessions))
    into v_start from analytics_daily;

  if v_start is not null then
    v_day := v_start;
    while v_day <= v_yesterday and v_rolled < 400 loop
      perform analytics_rollup_day(v_day);
      v_rolled := v_rolled + 1;
      v_day := v_day + 1;
    end loop;
  end if;

  -- 집계가 끝난 날짜 범위 안의 원본만 지운다(집계가 밀려 있으면 그만큼 삭제도 미룸).
  v_cutoff := least(v_cutoff, (((select coalesce(max(day), '1970-01-01'::date) from analytics_daily) + 1)::timestamp at time zone 'Asia/Seoul'));

  delete from analytics_events where occurred_at < v_cutoff;
  get diagnostics v_del_e = row_count;
  delete from analytics_sessions where started_at < v_cutoff;
  get diagnostics v_del_s = row_count;

  return jsonb_build_object('rolled_up_days', v_rolled, 'deleted_sessions', v_del_s, 'deleted_events', v_del_e, 'cutoff', v_cutoff);
end;
$$;

revoke all on function public.analytics_rollup_day(date) from public, anon, authenticated;
revoke all on function public.analytics_maintain(integer) from public, anon, authenticated;
grant execute on function public.analytics_rollup_day(date) to service_role;
grant execute on function public.analytics_maintain(integer) to service_role;

create or replace function public.admin_stats_core(p_days integer default 30, p_include_admins boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_days    integer := greatest(1, least(coalesce(p_days, 30), 365));
  v_today   date := (now() at time zone 'Asia/Seoul')::date;
  v_since   timestamptz;
  v_admins  uuid[];
  v_result  jsonb;
begin
  v_since := ((v_today - (v_days - 1))::timestamp at time zone 'Asia/Seoul');
  v_admins := case when p_include_admins then '{}'::uuid[]
                   else coalesce((select array_agg(id) from users where role = 'admin'), '{}'::uuid[]) end;

  with
  s as (
    select * from analytics_sessions
    where started_at >= v_since
      and coalesce(user_id <> all (v_admins), true)
      and coalesce(entry_path, '') <> '/__deploy_check'
  ),
  e as (
    select * from analytics_events
    where occurred_at >= v_since
      and coalesce(user_id <> all (v_admins), true)
      and coalesce(path, '') <> '/__deploy_check'
  ),
  -- 기간 내 업로드(운영자 글 제외 설정 반영). 예약·삭제 글은 뺀다.
  p as (
    select id, user_id, title, caption, visibility, coalesce(published_at, created_at) as at
    from posts
    where coalesce(published_at, created_at) >= v_since
      and status in ('published', 'expired')
      and user_id <> all (v_admins)
  ),
  -- 모든 반응(좋아요·댓글·Kick) — 작성자 본인 반응은 제외.
  reactions as (
    select l.post_id, l.user_id, l.created_at, 'like' as kind from likes l
    union all
    select c.post_id, c.user_id, c.created_at, 'comment' from comments c
    union all
    select k.post_id, k.user_id, k.created_at, 'kick' from kicks k
  ),
  days as (
    select d::date as d from generate_series(v_today - (v_days - 1), v_today, interval '1 day') as g(d)
  )
  select jsonb_build_object(
    'range', jsonb_build_object(
      'days', v_days,
      'since', v_since,
      'include_admins', p_include_admins,
      'collect_started_at', (select min(started_at) from analytics_sessions where coalesce(entry_path, '') <> '/__deploy_check')
    ),

    -- 기간 합계
    'overview', (
      select jsonb_build_object(
        'visitors', count(distinct anon_id),
        'member_visitors', count(distinct user_id),
        'logged_in_anons', count(distinct anon_id) filter (where user_id is not null),
        'sessions', count(*),
        'median_session_active_s', coalesce(percentile_cont(0.5) within group (order by active_seconds), 0),
        'total_active_s', coalesce(sum(active_seconds), 0),
        'total_listen_s', coalesce(sum(listen_seconds), 0),
        'member_active_s', coalesce(sum(active_seconds) filter (where user_id is not null), 0),
        'member_days', (select count(distinct (user_id, (started_at at time zone 'Asia/Seoul')::date)) from s where user_id is not null)
      )
      from s
    ),

    -- 지금 기준 DAU/WAU/MAU(기간 선택과 무관)
    'actives', (
      select jsonb_build_object(
        'dau', count(distinct user_id) filter (where started_at >= (v_today::timestamp at time zone 'Asia/Seoul')),
        'wau', count(distinct user_id) filter (where started_at >= now() - interval '7 days'),
        'mau', count(distinct user_id) filter (where started_at >= now() - interval '30 days')
      )
      from analytics_sessions
      where user_id is not null
        and started_at >= now() - interval '30 days'
        and user_id <> all (v_admins)
    ),

    'members', (
      select jsonb_build_object(
        'approved', count(*) filter (where status = 'approved'),
        'pending', count(*) filter (where status = 'pending'),
        'signups_in_range', count(*) filter (where created_at >= v_since)
      )
      from users
      where id <> all (v_admins)
    ),

    -- 일별 추이
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'd', days.d,
        'members', coalesce(sd.members, 0),
        'visitors', coalesce(sd.visitors, 0),
        'active_s', coalesce(sd.active_s, 0),
        'uploads', coalesce(pd.uploads, 0),
        'reactions', coalesce(rd.reactions, 0)
      ) order by days.d), '[]'::jsonb)
      from days
      left join (
        select (started_at at time zone 'Asia/Seoul')::date as d,
               count(distinct user_id) as members,
               count(distinct anon_id) as visitors,
               sum(active_seconds) as active_s
        from s group by 1
      ) sd on sd.d = days.d
      left join (
        select (at at time zone 'Asia/Seoul')::date as d, count(*) as uploads from p group by 1
      ) pd on pd.d = days.d
      left join (
        select (r.created_at at time zone 'Asia/Seoul')::date as d, count(*) as reactions
        from reactions r
        where r.created_at >= v_since and r.user_id <> all (v_admins)
        group by 1
      ) rd on rd.d = days.d
    ),

    -- 요일(1=월..7=일) × 시간(0~23) — 그 시간대에 방문을 시작한 사람 수와 활동 시간.
    'heatmap', (
      select coalesce(jsonb_agg(jsonb_build_object('dow', dow, 'h', h, 'visitors', visitors, 'active_s', active_s)), '[]'::jsonb)
      from (
        select extract(isodow from started_at at time zone 'Asia/Seoul')::int as dow,
               extract(hour from started_at at time zone 'Asia/Seoul')::int as h,
               count(distinct anon_id) as visitors,
               sum(active_seconds) as active_s
        from s group by 1, 2
      ) x
    ),

    -- 기기 — 방문자(브라우저) 기준
    'devices', jsonb_build_object(
      'type', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb)
               from (select coalesce(device_type, 'unknown') k, count(distinct anon_id) n from s group by 1) x),
      'os', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb)
             from (select coalesce(os, 'unknown') k, count(distinct anon_id) n from s group by 1) x),
      'browser', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb)
                  from (select coalesce(browser, 'unknown') k, count(distinct anon_id) n from s group by 1) x),
      'pwa_visitors', (select count(distinct anon_id) from s where is_pwa)
    ),

    -- 유입 — 방문(세션)의 시작 경로. ?src 태그 > 외부 사이트 > 직접.
    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object('k', k, 'sessions', n, 'visitors', v) order by n desc), '[]'::jsonb)
      from (
        select coalesce(entry_src, 'ref:' || referrer_host, 'direct') as k, count(*) as n, count(distinct anon_id) as v
        from s group by 1
      ) x
    ),
    -- 태그 링크로 들어온 횟수(이미 열린 방문 중에 알림을 눌러 들어온 것도 포함)
    'link_opens', (
      select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb)
      from (select props->>'src' as k, count(*) as n from e where name = 'link_open' group by 1) x
    ),

    -- 감상 퍼널: 노출 → 재생 → 30초 이상 → 끝까지(90%+), 재생한 사람이 그 글에 반응했는지
    'listening', (
      with imp as (select distinct anon_id, post_id from e where name = 'post_impression' and post_id is not null),
           st as (select distinct anon_id, user_id, post_id from e where name = 'play_start' and post_id is not null),
           en as (select post_id, anon_id,
                         (props->>'listened_s')::numeric as listened_s,
                         nullif(props->>'pct', '')::numeric as pct
                  from e where name = 'play_end' and post_id is not null),
           member_plays as (select distinct user_id, post_id from st where user_id is not null)
      select jsonb_build_object(
        'impressions', (select count(*) from e where name = 'post_impression'),
        'impression_pairs', (select count(*) from imp),
        'impression_to_play', (select count(*) from imp join st using (anon_id, post_id)),
        'play_starts', (select count(*) from e where name = 'play_start'),
        'play_pairs', (select count(*) from (select distinct anon_id, post_id from st) z),
        'play_ends', (select count(*) from en),
        'listened_30s', (select count(*) from en where listened_s >= 30),
        'completed', (select count(*) from en where pct >= 90),
        'median_listened_s', (select coalesce(percentile_cont(0.5) within group (order by listened_s), 0) from en),
        'median_pct', (select coalesce(percentile_cont(0.5) within group (order by pct), 0) from en where pct is not null),
        'member_play_pairs', (select count(*) from member_plays),
        'member_play_reacted', (
          select count(*) from member_plays mp
          where exists (select 1 from reactions r where r.post_id = mp.post_id and r.user_id = mp.user_id)
        ),
        'shares', (select count(*) from e where name = 'share'),
        'share_methods', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb)
                          from (select props->>'method' k, count(*) n from e where name = 'share' group by 1) z)
      )
    ),

    -- 창작자: 기간 내 올라온 글이 반응을 받았는지, 첫 반응까지 몇 시간
    'creators', (
      with pr as (
        select p.id, p.user_id, p.at,
               (select min(r.created_at) from reactions r where r.post_id = p.id and r.user_id <> p.user_id) as first_at,
               (select count(*) from reactions r where r.post_id = p.id and r.user_id <> p.user_id) as n_reactions,
               (select count(*) from post_plays pp where pp.post_id = p.id and pp.user_id <> p.user_id) as n_listeners
        from p
      ),
      per_author as (select user_id, count(*) as n from p group by 1)
      select jsonb_build_object(
        'posts', (select count(*) from pr),
        'uploaders', (select count(*) from per_author),
        'repeat_uploaders', (select count(*) from per_author where n >= 2),
        'active_members', (select count(distinct user_id) from s where user_id is not null),
        'no_reaction_posts', (select count(*) from pr where n_reactions = 0),
        'no_reaction_older_24h', (select count(*) from pr where n_reactions = 0 and at < now() - interval '24 hours'),
        'older_24h', (select count(*) from pr where at < now() - interval '24 hours'),
        'reacted_within_24h', (select count(*) from pr where first_at is not null and first_at - at <= interval '24 hours'),
        'median_hours_to_first', (
          select coalesce(percentile_cont(0.5) within group (order by extract(epoch from (first_at - at)) / 3600.0), 0)
          from pr where first_at is not null
        ),
        'avg_reactions', (select coalesce(avg(n_reactions), 0) from pr),
        'avg_listeners', (select coalesce(avg(n_listeners), 0) from pr),
        'reaction_mix', (
          select coalesce(jsonb_object_agg(kind, n), '{}'::jsonb)
          from (select r.kind, count(*) n from reactions r
                where r.created_at >= v_since and r.user_id <> all (v_admins) group by 1) z
        )
      )
    ),

    -- 가입 주차별 리텐션(최근 8주 코호트, 승인 여부 무관·운영자 제외).
    -- w[k] = 가입 주 + k주차에 한 번이라도 활동한 사람 수. 아직 오지 않은 주차는 null.
    'retention', (
      with act as (
        select user_id, started_at as at from analytics_sessions where user_id is not null
        union all select user_id, coalesce(published_at, created_at) from posts where status in ('published', 'expired')
        union all select user_id, created_at from likes
        union all select user_id, created_at from comments
        union all select user_id, created_at from kicks
        union all select user_id, played_at from post_plays
      ),
      coh as (
        select id as user_id,
               date_trunc('week', created_at at time zone 'Asia/Seoul')::date as wk
        from users
        where id <> all (v_admins)
          and status <> 'withdrawn'
          and created_at >= ((date_trunc('week', now() at time zone 'Asia/Seoul') - interval '7 weeks') at time zone 'Asia/Seoul')
      ),
      aw as (
        select distinct a.user_id, date_trunc('week', a.at at time zone 'Asia/Seoul')::date as wk from act a
      )
      select coalesce(jsonb_agg(jsonb_build_object('week', c.wk, 'size', c.size, 'w', c.w) order by c.wk), '[]'::jsonb)
      from (
        select coh.wk, count(*) as size,
               (select jsonb_agg(
                  case when coh.wk + k * 7 > (date_trunc('week', now() at time zone 'Asia/Seoul'))::date then null
                       else (select count(distinct aw.user_id) from aw
                             join coh c2 on c2.user_id = aw.user_id and c2.wk = coh.wk
                             where aw.wk = coh.wk + k * 7) end
                  order by k)
                from generate_series(0, 7) as k) as w
        from coh group by coh.wk
      ) c
    ),

    -- 네트워크: 승인 회원의 Companion 수 분포
    'network', (
      with m as (
        select u.id,
               (select count(*) from companions c
                where c.status = 'accepted' and (c.requester_id = u.id or c.addressee_id = u.id)) as n
        from users u
        where u.status = 'approved' and u.id <> all (v_admins)
      )
      select jsonb_build_object(
        'members', count(*),
        'b0', count(*) filter (where n = 0),
        'b1_2', count(*) filter (where n between 1 and 2),
        'b3_5', count(*) filter (where n between 3 and 5),
        'b6', count(*) filter (where n >= 6),
        'median', coalesce(percentile_cont(0.5) within group (order by n), 0)
      )
      from m
    ),

    -- 기간 중 가장 많이 노출된 게시물 10개 — 노출 대비 재생·완주
    'top_posts', (
      select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.impressions desc, t.plays desc), '[]'::jsonb)
      from (
        select po.id,
               coalesce(nullif(po.title, ''), nullif(po.caption, ''), '(제목 없음)') as title,
               u.nickname as author,
               po.visibility,
               count(*) filter (where ev.name = 'post_impression') as impressions,
               count(*) filter (where ev.name = 'play_start') as plays,
               count(*) filter (where ev.name = 'play_end' and nullif(ev.props->>'pct', '')::numeric >= 90) as completed,
               round(avg((ev.props->>'listened_s')::numeric) filter (where ev.name = 'play_end')) as avg_listened_s
        from e ev
        join posts po on po.id = ev.post_id
        join users u on u.id = po.user_id
        where ev.name in ('post_impression', 'play_start', 'play_end')
        group by po.id, po.title, po.caption, u.nickname, po.visibility
        order by count(*) filter (where ev.name = 'post_impression') desc, count(*) filter (where ev.name = 'play_start') desc
        limit 10
      ) t
    ),

    -- 업로드 시도 → 막힌 이유
    'uploads', jsonb_build_object(
      'submits', (select count(*) from e where name = 'upload_submit'),
      'errors', (select count(*) from e where name = 'upload_error'),
      'posts', (select count(*) from p),
      'top_errors', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb)
                     from (select props->>'message' k, count(*) n from e where name = 'upload_error'
                           group by 1 order by 2 desc limit 5) z)
    ),

    -- 홈 화면 설치 안내
    'installs', jsonb_build_object(
      'shown', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb)
                from (select props->>'platform' k, count(*) n from e where name = 'install_prompt_shown' group by 1) z),
      'results', (select coalesce(jsonb_agg(jsonb_build_object('platform', pl, 'result', rs, 'n', n) order by n desc), '[]'::jsonb)
                  from (select props->>'platform' pl, props->>'result' rs, count(*) n
                        from e where name = 'install_prompt_result' group by 1, 2) z),
      'installed', (select count(*) from e where name = 'pwa_installed')
    )
  ) into v_result;

  return v_result;
end;
$$;


revoke all on function public.admin_stats_core(integer, boolean) from public, anon, authenticated;
grant execute on function public.admin_stats_core(integer, boolean) to service_role;

-- 화면용 — 관리자 확인 후 core를 그대로.
create or replace function public.admin_stats(p_days integer default 30, p_include_admins boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return admin_stats_core(p_days, p_include_admins);
end;
$$;

revoke all on function public.admin_stats(integer, boolean) from public, anon;
grant execute on function public.admin_stats(integer, boolean) to authenticated;

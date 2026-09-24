-- 이용 통계 1단계 — 수집만(2026-09-25, 사용자 요청: "커뮤니티 발전에 도움이 되는 지표는 최대한 기록").
-- 대시보드(/admin/stats)는 2단계, 90일 지난 원본 이벤트를 일별 집계로 줄이는 크론은 3단계.
--
-- 좋아요·댓글·Kick·Companion·post_plays는 이미 각 테이블에 시각과 함께 남으므로 여기 다시 적지
-- 않는다 — 여기엔 "그 테이블들로는 알 수 없는 것"만 쌓는다: 어떤 기기로 몇 시에 들어와 얼마나
-- 머물렀는지, 어떤 게시물이 화면에 보였는데 안 눌렸는지, 몇 초나 들었는지, 알림·공유 링크로 들어왔는지.
--
-- 쓰기는 /api/t 라우트(service role)가 analytics_ingest()로만 한다 — 클라이언트가 테이블에 직접
-- 쓰면 남의 user_id로 기록하거나 active_seconds를 부풀릴 수 있어서 insert 정책을 아예 두지 않는다.
-- 읽기는 관리자만.

-- 1) 방문(세션) — 30분 넘게 활동이 없으면 새 세션(클라이언트 src/lib/analytics.ts가 판단).
--    같은 브라우저의 여러 탭은 localStorage로 같은 세션 id를 쓴다.
create table analytics_sessions (
  id              uuid primary key,
  -- 로그인 전 방문은 null. 세션 도중 로그인하면 그 시점부터 채워진다(가입 퍼널 추적).
  user_id         uuid references users(id) on delete set null,
  -- 브라우저 단위 익명 id(localStorage) — 가입 전 방문과 가입 후 계정을 잇는 데 쓴다.
  anon_id         uuid not null,
  started_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  -- 화면이 보이고 최근 60초 안에 입력이 있었거나 소리가 나던 시간(초). 탭만 켜두고 자리를 비운
  -- 시간은 안 센다(PresenceHeartbeat의 last_seen_at과 다른 점).
  active_seconds  integer not null default 0,
  -- 소리가 난 시간(초) — 화면이 꺼져 있어도(백그라운드 재생) 센다.
  listen_seconds  integer not null default 0,
  device_type     text,      -- mobile | tablet | desktop
  os              text,      -- iOS | Android | Windows | macOS | Linux | ChromeOS | other
  browser         text,      -- Safari | Chrome | Samsung | KakaoTalk | Instagram | NAVER | ...
  is_pwa          boolean not null default false,  -- 홈 화면 앱(standalone)으로 열었는지
  screen_w        smallint,
  screen_h        smallint,
  entry_path      text,      -- 세션 첫 화면
  entry_src       text,      -- ?src= 태그(push, email_reaction, weekly_report, share_copy ...)
  referrer_host   text,      -- 외부에서 링크로 들어왔을 때 그 사이트
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  user_agent      text
);

create index analytics_sessions_started_idx on analytics_sessions (started_at);
create index analytics_sessions_user_idx on analytics_sessions (user_id, started_at) where user_id is not null;
create index analytics_sessions_anon_idx on analytics_sessions (anon_id);

-- 2) 행동 이벤트 — append-only. 이름은 /api/t가 화이트리스트로 거른다.
--    post_id는 FK를 걸지 않는다(게시물이 지워져도 "그때 보였다/들었다" 기록은 집계에 남아야 함).
create table analytics_events (
  id           bigint generated always as identity primary key,
  session_id   uuid not null references analytics_sessions(id) on delete cascade,
  user_id      uuid references users(id) on delete set null,
  anon_id      uuid not null,
  name         text not null,
  path         text,
  post_id      uuid,
  props        jsonb not null default '{}'::jsonb,
  -- 클라이언트에서 일어난 시각(배치로 늦게 도착하므로 created_at과 다름). 서버에서 [now()-1일, now()]로 자른다.
  occurred_at  timestamptz not null,
  created_at   timestamptz not null default now()
);

create index analytics_events_occurred_idx on analytics_events (occurred_at);
create index analytics_events_name_idx on analytics_events (name, occurred_at);
create index analytics_events_user_idx on analytics_events (user_id, occurred_at) where user_id is not null;
create index analytics_events_post_idx on analytics_events (post_id, name) where post_id is not null;
create index analytics_events_session_idx on analytics_events (session_id);

alter table analytics_sessions enable row level security;
alter table analytics_events enable row level security;

create policy "analytics_sessions_select_admin"
  on analytics_sessions for select
  using (is_admin(auth.uid()));

create policy "analytics_events_select_admin"
  on analytics_events for select
  using (is_admin(auth.uid()));

-- 3) 수집 창구 — /api/t가 service role로 호출. 세션 upsert(누적 시간 가산) + 이벤트 일괄 insert를
--    한 트랜잭션에. 시간 가산은 한 번에 최대 10분으로 캡(클라이언트 전송 주기는 30초).
create or replace function public.analytics_ingest(
  p_session_id uuid,
  p_user_id    uuid,
  p_anon_id    uuid,
  p_meta       jsonb,
  p_active_s   integer,
  p_listen_s   integer,
  p_events     jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into analytics_sessions as s (
    id, user_id, anon_id, active_seconds, listen_seconds,
    device_type, os, browser, is_pwa, screen_w, screen_h,
    entry_path, entry_src, referrer_host, utm_source, utm_medium, utm_campaign, user_agent
  )
  values (
    p_session_id, p_user_id, p_anon_id,
    greatest(0, least(coalesce(p_active_s, 0), 600)),
    greatest(0, least(coalesce(p_listen_s, 0), 600)),
    p_meta->>'device_type', p_meta->>'os', p_meta->>'browser',
    coalesce((p_meta->>'is_pwa')::boolean, false),
    nullif(p_meta->>'screen_w', '')::smallint, nullif(p_meta->>'screen_h', '')::smallint,
    left(p_meta->>'entry_path', 300), left(p_meta->>'entry_src', 60), left(p_meta->>'referrer_host', 200),
    left(p_meta->>'utm_source', 100), left(p_meta->>'utm_medium', 100), left(p_meta->>'utm_campaign', 100),
    left(p_meta->>'user_agent', 400)
  )
  on conflict (id) do update set
    last_seen_at   = now(),
    active_seconds = s.active_seconds + greatest(0, least(coalesce(p_active_s, 0), 600)),
    listen_seconds = s.listen_seconds + greatest(0, least(coalesce(p_listen_s, 0), 600)),
    -- 세션 도중 로그인하면 채운다(이미 채워졌으면 유지).
    user_id        = coalesce(s.user_id, excluded.user_id),
    -- 첫 요청이 유실됐을 때 대비해 비어 있는 기기 정보만 보충.
    is_pwa         = s.is_pwa or excluded.is_pwa;

  if p_events is not null and jsonb_typeof(p_events) = 'array' then
    insert into analytics_events (session_id, user_id, anon_id, name, path, post_id, props, occurred_at)
    select
      p_session_id,
      p_user_id,
      p_anon_id,
      left(e->>'n', 40),
      left(e->>'p', 300),
      case when (e->>'post') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           then (e->>'post')::uuid end,
      case when jsonb_typeof(e->'x') = 'object' then e->'x' else '{}'::jsonb end,
      least(now(), greatest(now() - interval '1 day',
        coalesce(to_timestamp(nullif(e->>'t', '')::double precision / 1000.0), now())))
    from jsonb_array_elements(p_events) as e
    where coalesce(e->>'n', '') <> '';
  end if;
end;
$$;

revoke all on function public.analytics_ingest(uuid, uuid, uuid, jsonb, integer, integer, jsonb) from public, anon, authenticated;
grant execute on function public.analytics_ingest(uuid, uuid, uuid, jsonb, integer, integer, jsonb) to service_role;

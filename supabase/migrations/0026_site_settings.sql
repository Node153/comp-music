-- 사이트 전역 설정(key-value) — 로그인 화면 배경음악부터 시작. 나중에 다른 전역 설정이
-- 생기면 이 테이블에 행만 추가하면 된다.
create table site_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id)
);

alter table site_settings enable row level security;

-- 로그인 화면(비로그인 상태)에서도 값을 읽어야 해서 조회는 전체 공개.
create policy "site_settings_select_anyone"
  on site_settings for select
  using (true);

-- 쓰기는 관리자만 — /admin/bgm 화면은 proxy.ts가 role=admin으로 이미 가드하지만,
-- API를 직접 두드리는 경로까지 막으려면 DB 레벨 정책이 있어야 한다.
create policy "site_settings_write_admin"
  on site_settings for all
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

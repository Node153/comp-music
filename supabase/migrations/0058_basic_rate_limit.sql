-- 앱 전체에 rate limit이 전혀 없어서(check_duplicate_identity가 anon에게 열려 있어 로그인
-- 없이 "이름+생년월일로 가입여부"를 무제한 조회 가능, upload-url도 무제한 발급 가능) 기초적인
-- 고정 윈도 카운터를 하나 만든다. 새 서비스(Upstash 등)를 새로 붙이지 않고 있는 Postgres로
-- 충분한 수준 — service_role(관리자 클라이언트)에서만 호출하고 클라이언트에는 노출 안 한다.
create table rate_limit_hits (
  bucket text not null,
  key_hash text not null,
  window_start timestamptz not null,
  count int not null default 1,
  primary key (bucket, key_hash, window_start)
);

alter table rate_limit_hits enable row level security;
-- 정책을 하나도 안 만든다 — anon/authenticated는 RLS로 완전히 막히고, service_role만
-- (admin client, RLS 우회) 읽고 쓸 수 있다.

create function public.check_rate_limit(p_bucket text, p_key_hash text, p_window_seconds int, p_max int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  bucket_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  current_count int;
begin
  insert into rate_limit_hits (bucket, key_hash, window_start, count)
  values (p_bucket, p_key_hash, bucket_start, 1)
  on conflict (bucket, key_hash, window_start)
  do update set count = rate_limit_hits.count + 1
  returning count into current_count;

  return current_count <= p_max;
end;
$$;

-- check_duplicate_identity(0044)가 anon에게도 열려 있는 건 가입 전(비로그인) 호출이라
-- 필요한 게 맞지만, rate limit 없이 그대로 두면 로그인 없이 "이름+생년월일 존재 확인"을
-- 무제한 반복할 수 있는 프라이버시 오라클이 된다 — anon 직접 호출은 막고, 서버 라우트
-- (/api/auth/check-duplicate-identity, service_role + IP 기준 rate limit)로만 거치게 한다.
-- authenticated(onboarding 화면, 로그인 상태에서만 호출)는 그대로 둔다.
revoke execute on function public.check_duplicate_identity(text, date, uuid) from anon;

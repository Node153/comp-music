-- 소셜로그인(Google/Kakao) 지원.
--
-- 문제: handle_new_user 트리거(0023)는 auth.users에 새 행이 생기면 무조건 저작권/공동창작
-- 동의 3건을 고정 버전으로 남긴다. 이건 "회원가입 폼의 체크박스 3개가 전부 required라서,
-- 가입이 성사됐다는 것 자체가 셋 다 동의했다는 뜻"이라는 전제 위에 만들어진 로직인데,
-- 소셜로그인은 그 체크박스 화면 자체를 거치지 않고 auth.users 행이 바로 생기므로 이 전제가
-- 깨진다 — 트리거가 그대로면 사용자가 보지도 않은 동의를 서버가 대신 "동의했다"고 기록하게 됨.
--
-- 해결: 신규 users 행에 needs_onboarding 플래그를 두고, 트리거가 OAuth 가입(provider가
-- 'email'이 아님)이면 이 값을 true로 남기고 agreements 3건 삽입은 건너뛴다. proxy.ts가 이
-- 플래그를 보고 온보딩 화면(src/app/onboarding)으로 보내 실명/닉네임 확인 + 동의 체크박스를
-- 그제서야 받는다 — 이메일 가입자는 지금까지와 동일하게 즉시 false로 시작(온보딩 스킵).
alter table users add column needs_onboarding boolean not null default false;

-- Google 계정의 표시 이름은 raw_user_meta_data에 full_name(구버전) 또는 name(신버전 필드,
-- provider별로 다를 수 있어 둘 다 시도)으로 들어온다. 이메일 가입은 그동안 options.data.name을
-- 썼으므로 이것도 계속 우선 시도 — 셋 다 없으면 최후 수단으로 이메일.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_oauth boolean := coalesce(new.raw_app_meta_data->>'provider', 'email') <> 'email';
  display_name text := coalesce(
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    new.email
  );
begin
  insert into public.users (id, email, name, nickname, needs_onboarding)
  values (
    new.id,
    new.email,
    display_name,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'nickname'), ''),
      'user_' || left(replace(new.id::text, '-', ''), 6)
    ),
    is_oauth
  );

  if not is_oauth then
    insert into public.agreements (user_id, type, version)
    values
      (new.id, 'content_rights', '2026-08-10'),
      (new.id, 'collab_disclaimer', '2026-08-10'),
      (new.id, 'license_grant', '2026-08-10');
  end if;

  return new;
end;
$$;

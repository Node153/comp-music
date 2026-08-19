-- 동명이인 판별 보조용 생년월일 — 소셜로그인(Google/Kakao/Spotify) 다른 이메일로 같은 사람이
-- 여러 계정을 만드는 문제(0030 동명이인 경고 기능 후속) 대응. 이름만으로는 오탐이 많아서
-- 생년월일까지 같이 보고 관리자가 판단하게 한다.
-- 기존 회원 14명은 값이 없으니 nullable로 두고(not null 강제하면 기존 데이터 깨짐), 새 가입자
-- 부터는 앱(signup/onboarding 폼)에서 required로 막는다 — DB 레벨 강제는 다음 하드닝 때.
alter table users add column birth_date date;

-- 이메일 가입자는 signUp options.data로 생년월일을 같이 보내면 트리거가 바로 기록한다.
-- OAuth(Google/Kakao/Spotify)는 어느 제공자도 생년월일을 기본 스코프로 안 주기 때문에
-- (Kakao는 별도 동의항목 필요, 이메일과 같은 사업자 인증 이슈) 여전히 /onboarding 화면에서
-- 직접 입력받아 별도 update로 채운다 — 트리거는 이메일 가입 경로만 처리.
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
  insert into public.users (id, email, name, nickname, needs_onboarding, birth_date)
  values (
    new.id,
    new.email,
    display_name,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'nickname'), ''),
      'user_' || left(replace(new.id::text, '-', ''), 6)
    ),
    is_oauth,
    nullif(new.raw_user_meta_data->>'birth_date', '')::date
  );

  if not is_oauth then
    insert into public.agreements (user_id, type, version)
    values
      (new.id, 'content_rights', '2026-08-10'),
      (new.id, 'collab_disclaimer', '2026-08-10'),
      (new.id, 'license_grant', '2026-08-10'),
      (new.id, 'terms_of_service', '2026-08-19'),
      (new.id, 'privacy_policy', '2026-08-19');
  end if;

  return new;
end;
$$;

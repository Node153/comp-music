-- 긴급 버그 수정 — Kakao 로그인 자체가 지금 100% 실패한다.
-- SocialLoginButtons.tsx가 Kakao에 profile_nickname 스코프만 요청하도록 만들어놨는데
-- (이메일은 카카오 비즈니스 인증 없이는 요청 불가, KOE205 에러 회피용), handle_new_user()
-- 트리거는 여전히 new.email을 그대로 public.users.email(not null unique)에 넣고 있었다.
-- Kakao 가입자는 new.email이 NULL이라 insert가 NOT NULL 제약을 위반해서 트리거가 실패하고,
-- 그 결과 auth.users 생성 자체가 롤백돼서 회원가입/로그인이 전부 실패한다.
-- 해결: 이메일이 없으면 본인 id 기반의 유니크한 가짜 이메일을 대신 넣는다. 실제로는 아무한테도
-- 안 쓰이는 자리표시자일 뿐이고(이메일 알림도 이 사람껜 못 감), 나중에 프로필에서 진짜
-- 이메일을 추가하게 하는 건 별도 후속 작업.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_oauth boolean := coalesce(new.raw_app_meta_data->>'provider', 'email') <> 'email';
  safe_email text := coalesce(new.email, new.id::text || '@no-email.comp.local');
  display_name text := coalesce(
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    new.email,
    '회원'
  );
begin
  insert into public.users (id, email, name, nickname, needs_onboarding, birth_date)
  values (
    new.id,
    safe_email,
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

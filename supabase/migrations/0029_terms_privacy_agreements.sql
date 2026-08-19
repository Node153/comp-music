-- 이용약관(/terms)·개인정보처리방침(/privacy) 신설(0-4, 0-6 관련 개선)에 맞춰 동의 기록 추가.
-- 기존 3종(content_rights/collab_disclaimer/license_grant)과 같은 원칙 — 체크박스가
-- required라서 가입이 성사됐다는 것 자체가 동의했다는 뜻이라, 트리거가 고정 버전으로 남긴다.
-- 버전 문자열은 문서 시행일자(2026-08-19)와 맞춤 — 나중에 약관 내용이 바뀌면 새 버전으로
-- 다시 동의를 받아야 하므로(agreements.version 컬럼 설계 의도) 별도로 관리한다.
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
      (new.id, 'license_grant', '2026-08-10'),
      (new.id, 'terms_of_service', '2026-08-19'),
      (new.id, 'privacy_policy', '2026-08-19');
  end if;

  return new;
end;
$$;

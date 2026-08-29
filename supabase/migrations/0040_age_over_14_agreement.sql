-- 만 14세 이상 체크박스 재도입(2026-08-29, 사용자 요청) — 생년월일로 실제 나이를 검증하는
-- 로직(src/lib/age.ts, isOldEnough)은 이미 있지만, 사용자가 생년월일 자체를 조작해서 입력할
-- 수도 있으니(허위 기재) 별도의 명시적 자기신고 체크박스도 같이 받기로 함. 데이터 검증 +
-- 자기신고 둘 다 두는 방식 — 데이터 검증이 뚫려도(생년월일 조작) 최소한 "허위로 동의했다"는
-- 기록은 남는다.
--
-- ⚠️ handle_new_user()를 또 고치는 것이라, 적용 전 반드시 실제 DB의 현재 정의를 먼저
-- 확인할 것(동료와의 마이그레이션 번호 충돌로 이 함수가 한 번 사고 난 적 있음, 0038 참고).
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
  new_tag text;
begin
  loop
    new_tag := lpad(floor(random() * 10000)::text, 4, '0');
    exit when not exists (select 1 from users where nickname_tag = new_tag);
  end loop;

  insert into public.users (id, email, name, nickname, nickname_tag, needs_onboarding, birth_date)
  values (
    new.id,
    safe_email,
    display_name,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'nickname'), ''),
      'user_' || left(replace(new.id::text, '-', ''), 6)
    ),
    new_tag,
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
      (new.id, 'privacy_policy', '2026-08-19'),
      (new.id, 'community_guidelines', '2026-08-20'),
      (new.id, 'age_over_14', '2026-08-29');
  end if;

  return new;
end;
$$;

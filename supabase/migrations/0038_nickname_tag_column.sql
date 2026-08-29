-- 닉네임 구조 재설계(2026-08-20, 사용자 요청 — "회원가입시 태그번호 미노출" +
-- "태그번호 절대 중복되면 안됨"). 지금까지는 nickname 컬럼 하나에 "문구_태그"를 합쳐서
-- 저장하고(unique 제약도 이 합친 문자열 기준), 화면에서만 정규식으로 태그를 잘라 보여줬다.
-- 문제: 그 방식은 (a) 가입 화면 자체에서는 여전히 합쳐진 값이 그대로 보였고, (b) 태그가
-- "문구별로" 우연히 안 겹치는 정도지 전체 회원 기준 유일함을 보장하지 않았다.
--
-- 새 구조: nickname(문구)과 nickname_tag(4자리 숫자)를 완전히 분리한다.
-- - nickname: 이제 중복 허용(여러 사람이 같은 문구를 써도 됨 — 오히려 익명성 목적에 부합).
-- - nickname_tag: 전체 회원 기준 절대 유일(unique 제약), 트리거가 가입 시점에 자동 배정하고
--   그 이후로는 아무도(본인 포함) 못 바꿈 — 사용자 입력을 아예 안 받으니 가입 화면에 노출될
--   일 자체가 없다. 클라이언트는 문구만 다루고 태그는 존재조차 모르는 채로 둔다.
-- 화면 표시 레이어(user_display 등)는 nickname을 그대로 보여주면 되므로 태그를 잘라내는
-- 로직은 더 이상 필요 없어 원래대로(태그 없는 순수 값) 되돌린다.
--
-- ⚠️ 번호 충돌 메모: 이 마이그레이션은 원래 로컬에서 0034로 작성했는데, 그 사이 동료가
-- 병행 작업한 0032~0037이 이미 이 프로젝트(dev/프로덕션 둘 다)에 적용되어 있었다 —
-- 그중 0034_fix_kakao_null_email_signup.sql이 handle_new_user()를 고쳐서(Kakao처럼
-- 이메일 없는 OAuth 가입이 NOT NULL 제약으로 100% 실패하던 버그의 safe_email 처리)
-- 있었는데, 내 최초 버전이 그 로직 없이 handle_new_user()를 통째로 갈아끼워서 잠깐
-- dev DB에서 그 버그가 되살아났었다(즉시 발견해 병합·재적용으로 복구, 실사용자 영향 없음).
-- 그래서 파일명을 0034 대신 다음 빈 번호(0038)로 옮기고, 아래 트리거에는 safe_email
-- 로직을 그대로 유지한 채로 nickname_tag 배정만 추가했다 — 앞으로 handle_new_user()를
-- 또 고칠 일이 있으면 반드시 최신 버전(0034 fix 포함)을 CREATE OR REPLACE 전에 먼저
-- 확인할 것.

alter table users add column nickname_tag varchar(4);

-- 기존 회원 백필 — 최근 가입자는 nickname에 "_1234"가 이미 붙어있을 수 있어 그걸 태그로
-- 재활용하고 phrase만 남기게 정리, 그 외(구가입자)는 새로 무작위 배정.
do $$
declare
  r record;
  candidate text;
  extracted text;
begin
  for r in select id, nickname from users where nickname_tag is null loop
    extracted := substring(r.nickname from '_([0-9]{4})$');
    if extracted is not null and not exists (
      select 1 from users where nickname_tag = extracted and id <> r.id
    ) then
      candidate := extracted;
    else
      loop
        candidate := lpad(floor(random() * 10000)::text, 4, '0');
        exit when not exists (select 1 from users where nickname_tag = candidate);
      end loop;
    end if;
    update users
      set nickname_tag = candidate,
          nickname = regexp_replace(nickname, '_[0-9]{4}$', '')
      where id = r.id;
  end loop;
end $$;

alter table users alter column nickname_tag set not null;
create unique index users_nickname_tag_unique on users (nickname_tag);

-- nickname 자체의 유니크 제약은 이제 뺀다 — 문구 중복은 의도된 설계.
drop index if exists users_nickname_unique;

-- 트리거가 가입 시점에 태그를 직접 배정(클라이언트가 절대 관여 안 함 — 그래야 가입 화면에
-- 노출될 수가 없다). safe_email/display_name 폴백은 0034_fix_kakao_null_email_signup.sql
-- 그대로 유지 — 여기서 안 지우면 Kakao 등 이메일 없는 OAuth 가입이 다시 깨진다.
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
      (new.id, 'privacy_policy', '2026-08-19');
  end if;

  return new;
end;
$$;

-- 화면 표시 레이어를 태그 없는 순수 nickname으로 되돌림 — nickname 자체에 이제 태그가
-- 안 붙어있으니 잘라낼 필요가 없다.
drop view if exists user_display;
drop function if exists knock_context(uuid);
drop view if exists public_post_authors;

create view user_display as
select
  u.id,
  case
    when u.id = auth.uid() or are_companions(u.id, auth.uid()) then u.name
    else u.nickname
  end as display_name,
  (u.id = auth.uid() or are_companions(u.id, auth.uid())) as shows_real_name
from users u
where is_approved(auth.uid())
  and (u.status = 'approved' or u.id = auth.uid());

create function knock_context(pid uuid)
returns table (display_name text, is_companion boolean)
language sql
security definer
stable
as $$
  select
    case
      when are_companions(u.id, auth.uid()) then u.name
      else u.nickname
    end as display_name,
    are_companions(u.id, auth.uid()) as is_companion
  from post_access pa
  join posts p on p.id = pa.post_id
  join users u on u.id = pa.user_id
  where pa.post_id = pid
    and pa.status in ('invited', 'accepted')
    and pa.user_id <> p.user_id
    and pa.user_id <> auth.uid()
    and is_approved(auth.uid())
  order by is_companion desc, display_name;
$$;

create view public_post_authors as
select u.id, u.nickname as display_name
from users u
where u.status = 'approved'
  and exists (
    select 1 from posts p
    where p.user_id = u.id and p.visibility = 'public' and p.status in ('published', 'expired')
  );

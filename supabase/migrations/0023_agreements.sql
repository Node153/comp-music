-- 가입 시 저작권/공동창작 동의 기록(docs/copyright_agreement_draft.md 참고).
-- 세 항목 모두 회원가입 폼에서 필수 체크(HTML required)라, 가입이 성사됐다는 것 자체가
-- 셋 다 동의했다는 뜻이다. 그래서 별도 boolean 메타데이터를 안 거치고 handle_new_user
-- 트리거가 고정 버전으로 3행을 한 번에 남긴다 — 트리거는 security definer라 RLS·세션
-- 유무와 무관하게 동작하고, 이메일 인증 대기 중이라 세션이 아직 없는 신규 가입자에게도
-- 그대로 적용된다.
create table agreements (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  type       varchar(30) not null,   -- content_rights / collab_disclaimer / license_grant
  version    varchar(20) not null,   -- 약관 개정 시 새 버전 문자열로 재동의 이력을 구분
  agreed_at  timestamptz not null default now(),
  unique (user_id, type, version)
);

alter table agreements enable row level security;

create policy "agreements_select_self"
  on agreements for select
  using (user_id = auth.uid());

create policy "agreements_select_admin"
  on agreements for select
  using (is_admin(auth.uid()));

-- 이후 약관이 개정되면 재동의 화면에서 클라이언트가 새 버전 행을 직접 넣을 수 있게
-- (가입 트리거 경로 말고) self-insert도 열어둔다.
create policy "agreements_insert_self"
  on agreements for insert
  with check (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, nickname)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'nickname'), ''),
      'user_' || left(replace(new.id::text, '-', ''), 6)
    )
  );

  insert into public.agreements (user_id, type, version)
  values
    (new.id, 'content_rights', '2026-08-10'),
    (new.id, 'collab_disclaimer', '2026-08-10'),
    (new.id, 'license_grant', '2026-08-10');

  return new;
end;
$$;

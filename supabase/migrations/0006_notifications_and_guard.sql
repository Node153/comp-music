-- 인앱뱃지 알림(1.4)용 컬럼 + users_update_self 정책의 권한 상승 취약점 수정.
--
-- 문제: 0002_rls.sql의 users_update_self 정책은 "id = auth.uid()"만 검사하고
-- 어떤 컬럼이 바뀌는지는 검사하지 않는다. 즉 일반 사용자가 자기 행의
-- status/role을 직접 update 호출로 바꿔 자가 승인하거나 관리자 권한을
-- 탈취할 수 있었다. RLS는 컬럼 단위 제어를 지원하지 않으므로 트리거로 막는다.

alter table users add column notifications_seen_at timestamptz not null default now();

create or replace function public.prevent_self_status_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.status is distinct from old.status or new.role is distinct from old.role)
     and not is_admin(auth.uid()) then
    raise exception 'Only admins can change status or role';
  end if;
  return new;
end;
$$;

create trigger enforce_status_role_admin_only
  before update on users
  for each row execute function public.prevent_self_status_role_escalation();

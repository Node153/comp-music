-- 회원 관리 2차: 관리자 조치 감사 로그 + 기간 정지 + 권한 변경.
--
-- 지금까지 승인/반려는 관리자 세션이 users.status를 직접 update했다(users_update_admin RLS) —
-- 누가/언제/왜 바꿨는지 기록이 안 남았다. 이제 회원 상태·권한 변경은 전부 아래 security definer
-- 함수를 거치게 하고, 함수 안에서 admin_actions에 한 줄씩 남긴다(분쟁 대응·관리자 증원 대비).
--
-- 정지(suspended): status가 approved가 아니게 되므로 proxy.ts·is_approved() 기반 RLS가 기존
-- 미승인 회원과 똑같이 자동으로 막아준다(별도 차단 로직 불필요). 기간 정지는 suspended_until에
-- 만료 시각을 두고, 만료 후 본인이 접속하면 proxy.ts가 lift_my_expired_suspension()을 불러
-- 스스로 풀리게 한다(크론 없이 — 접속하지 않는 사람은 풀릴 필요도 없음). null이면 영구 정지.

alter table users add column suspended_until timestamptz;
-- 반려/정지 사유 — 본인에게 /status 화면에서 보여준다.
alter table users add column status_reason text;

create table admin_actions (
  id             bigserial primary key,
  -- null이면 시스템 처리(정지 기간 만료 자동 해제 등)
  admin_id       uuid references users(id) on delete set null,
  target_user_id uuid references users(id) on delete set null,
  action         varchar(40) not null, -- status_change / role_change / suspension_expired
  before         jsonb,
  after          jsonb,
  reason         text,
  created_at     timestamptz not null default now()
);
create index admin_actions_target_idx on admin_actions (target_user_id, created_at desc);
create index admin_actions_created_idx on admin_actions (created_at desc);

alter table admin_actions enable row level security;
-- 조회만 관리자에게 연다. insert는 아래 security definer 함수만 하므로 정책을 두지 않는다
-- (클라이언트가 로그를 위조/삭제할 경로 자체가 없음).
create policy "admin_actions_select_admin"
  on admin_actions for select
  using (is_admin(auth.uid()));

-- 0046 가드 확장:
-- 1) suspended_until·status_reason은 관리자만 바꿀 수 있다 — users_update_self 정책이 본인 행의
--    모든 컬럼 수정을 허용하기 때문에, 이걸 안 막으면 정지된 본인이 만료 시각을 과거로 바꿔
--    스스로 풀 수 있다.
-- 2) 본인의 정지 해제(suspended→approved)는 만료 시각이 이미 지난 경우에만 허용한다
--    (lift_my_expired_suspension 경로).
create or replace function public.prevent_self_status_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin(auth.uid()) then
    return new;
  end if;
  if new.role is distinct from old.role then
    raise exception 'Only admins can change role';
  end if;
  if (new.suspended_until is distinct from old.suspended_until
      or new.status_reason is distinct from old.status_reason)
     and not (old.status = 'suspended' and new.status = 'approved'
              and old.suspended_until is not null and old.suspended_until <= now()
              and auth.uid() = old.id) then
    raise exception 'Only admins can change suspension';
  end if;
  if new.status is distinct from old.status
     and not (new.status = 'withdrawn' and old.status is distinct from 'withdrawn' and auth.uid() = old.id)
     and not (old.status = 'suspended' and new.status = 'approved'
              and old.suspended_until is not null and old.suspended_until <= now()
              and auth.uid() = old.id) then
    raise exception 'Only admins can change status';
  end if;
  return new;
end;
$$;

-- 관리자: 회원 상태 변경(승인/반려/정지/대기). 정지는 사유 필수, p_until null이면 영구.
create or replace function public.admin_set_member_status(
  p_target uuid,
  p_status text,
  p_reason text default null,
  p_until timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row users%rowtype;
  clean_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not is_admin(auth.uid()) then
    raise exception 'Only admins can change status';
  end if;
  if p_status not in ('pending', 'approved', 'rejected', 'suspended') then
    raise exception 'Invalid status: %', p_status;
  end if;
  if p_target = auth.uid() then
    raise exception '본인 계정의 상태는 바꿀 수 없어요';
  end if;
  select * into old_row from users where id = p_target for update;
  if not found then
    raise exception 'User not found';
  end if;
  if old_row.status = 'withdrawn' then
    raise exception '탈퇴한 회원은 변경할 수 없어요';
  end if;
  if p_status = 'suspended' and clean_reason is null then
    raise exception '정지 사유를 입력해주세요';
  end if;
  if p_status = 'suspended' and p_until is not null and p_until <= now() then
    raise exception '정지 종료 시각은 현재 이후여야 해요';
  end if;

  update users
     set status = p_status,
         suspended_until = case when p_status = 'suspended' then p_until else null end,
         status_reason = case when p_status in ('rejected', 'suspended') then clean_reason else null end
   where id = p_target;

  insert into admin_actions (admin_id, target_user_id, action, before, after, reason)
  values (
    auth.uid(), p_target, 'status_change',
    jsonb_build_object('status', old_row.status, 'suspended_until', old_row.suspended_until),
    jsonb_build_object('status', p_status,
                       'suspended_until', case when p_status = 'suspended' then p_until end),
    clean_reason
  );
end;
$$;

-- 관리자: 권한 변경(user ↔ admin). 사유 필수, 본인 변경 불가, 마지막 관리자 강등 불가.
create or replace function public.admin_set_member_role(
  p_target uuid,
  p_role text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_role text;
  clean_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not is_admin(auth.uid()) then
    raise exception 'Only admins can change role';
  end if;
  if p_role not in ('user', 'admin') then
    raise exception 'Invalid role: %', p_role;
  end if;
  if p_target = auth.uid() then
    raise exception '본인 계정의 권한은 바꿀 수 없어요';
  end if;
  if clean_reason is null then
    raise exception '변경 사유를 입력해주세요';
  end if;
  select role into old_role from users where id = p_target for update;
  if not found then
    raise exception 'User not found';
  end if;
  if old_role = p_role then
    return;
  end if;
  if old_role = 'admin' and (select count(*) from users where role = 'admin') <= 1 then
    raise exception '마지막 관리자는 강등할 수 없어요';
  end if;

  update users set role = p_role where id = p_target;

  insert into admin_actions (admin_id, target_user_id, action, before, after, reason)
  values (auth.uid(), p_target, 'role_change',
          jsonb_build_object('role', old_role), jsonb_build_object('role', p_role), clean_reason);
end;
$$;

-- 본인: 기간이 끝난 정지를 해제. proxy.ts가 status=suspended인 요청마다 호출 — 풀렸으면 true.
create or replace function public.lift_my_expired_suspension()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  old_until timestamptz;
begin
  select suspended_until into old_until from users
   where id = auth.uid() and status = 'suspended'
     and suspended_until is not null and suspended_until <= now()
   for update;
  if not found then
    return false;
  end if;

  update users set status = 'approved', suspended_until = null, status_reason = null
   where id = auth.uid();

  insert into admin_actions (admin_id, target_user_id, action, before, after, reason)
  values (null, auth.uid(), 'suspension_expired',
          jsonb_build_object('status', 'suspended', 'suspended_until', old_until),
          jsonb_build_object('status', 'approved'), null);
  return true;
end;
$$;

revoke execute on function public.admin_set_member_status(uuid, text, text, timestamptz) from anon;
revoke execute on function public.admin_set_member_role(uuid, text, text) from anon;
revoke execute on function public.lift_my_expired_suspension() from anon;

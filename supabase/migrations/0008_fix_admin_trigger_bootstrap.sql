-- 0006에서 추가한 prevent_self_status_role_escalation 트리거가 auth.uid()로만 판단하는데,
-- SQL Editor/service-role 등 JWT 세션이 없는 컨텍스트에서는 auth.uid()가 NULL이 되어
-- is_admin(NULL)도 false로 평가된다. 그 결과 최초 관리자 부트스트랩(대시보드에서
-- 직접 role='admin'으로 바꾸는 것)까지 막혀버리는 문제가 있었다.
--
-- 익명/일반 사용자 클라이언트는 로그인 세션이 있으면 항상 auth.uid()가 채워지므로,
-- "auth.uid()가 NULL인 경우"는 이미 DB에 직접 접근 가능한 신뢰된 컨텍스트(SQL Editor,
-- service-role 스크립트, 마이그레이션)로 간주해 통과시켜도 안전하다.
create or replace function public.prevent_self_status_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and (new.status is distinct from old.status or new.role is distinct from old.role)
     and not is_admin(auth.uid()) then
    raise exception 'Only admins can change status or role';
  end if;
  return new;
end;
$$;

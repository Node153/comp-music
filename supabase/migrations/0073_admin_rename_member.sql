-- 회원 관리: 관리자가 회원 실명(users.name)을 수정. 오타·가입 시 잘못 입력한 이름 정정용.
-- 상태·권한 변경(0064)과 같이 security definer 함수를 거쳐 admin_actions에 전후 값을 남긴다.
create or replace function public.admin_set_member_name(
  p_target uuid,
  p_name text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_name text;
  clean_name text := nullif(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'), '');
  clean_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not is_admin(auth.uid()) then
    raise exception 'Only admins can change name';
  end if;
  if clean_name is null then
    raise exception '이름을 입력해주세요';
  end if;
  if char_length(clean_name) > 100 then
    raise exception '이름은 100자 이하로 입력해주세요';
  end if;
  select name into old_name from users where id = p_target for update;
  if not found then
    raise exception 'User not found';
  end if;
  if old_name = clean_name then
    return;
  end if;

  update users set name = clean_name where id = p_target;

  insert into admin_actions (admin_id, target_user_id, action, before, after, reason)
  values (auth.uid(), p_target, 'name_change',
          jsonb_build_object('name', old_name), jsonb_build_object('name', clean_name), clean_reason);
end;
$$;

revoke execute on function public.admin_set_member_name(uuid, text, text) from anon;

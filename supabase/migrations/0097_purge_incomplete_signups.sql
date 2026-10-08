-- 가입을 끝내지 않은 계정 자동 삭제(2026-10-08, 사용자 결정 — "가입 중"인 채로 하루 지나면 삭제).
--
-- 소셜로그인은 버튼을 누르는 순간 auth.users와 users 행(status=pending, needs_onboarding=true, 0027)이
-- 생긴다. /onboarding(실명·생년월일·약관 동의)을 마치지 않고 떠난 사람의 이메일·소셜 프로필 이름이
-- 동의도 없이 계속 남아 있었고, 회원 관리 화면에도 "가입 중"으로 쌓였다.
--
-- 대상: status=pending이고 needs_onboarding=true인 채로, 계정 생성과 마지막 로그인 둘 다 기준 시간보다
-- 오래된 계정. 마지막 로그인까지 보는 건 며칠 뒤 다시 로그인해 온보딩 화면을 채우는 중인 사람을
-- 그 자리에서 지우지 않기 위해서다. 지워진 뒤 같은 소셜 계정으로 다시 로그인하면 새 계정으로 처음부터 가입한다.
--
-- users.id는 auth.users FK가 아니라서 두 행을 같이 지운다(한쪽만 지워지면 로그인은 되는데 회원 행이
-- 없는 계정이 남는다). 계정마다 따로 묶어, 걸리는 데이터가 있어 못 지우는 계정은 건너뛰고 나머지는 지운다.
-- 온보딩 전에는 proxy.ts가 /onboarding 밖으로 못 나가게 막으므로 게시물·대화 같은 활동 데이터는 없다.
--
-- 하루 1번 도는 expire-posts 크론이 service role로 부른다.
create or replace function public.purge_incomplete_signups(p_older_than_hours integer default 24)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz;
  v_deleted integer := 0;
  v_skipped integer := 0;
  r record;
begin
  if p_older_than_hours is null or p_older_than_hours < 1 then
    raise exception 'p_older_than_hours는 1 이상이어야 합니다';
  end if;
  v_cutoff := now() - make_interval(hours => p_older_than_hours);

  for r in
    select u.id
    from users u
    left join auth.users au on au.id = u.id
    where u.status = 'pending'
      and u.needs_onboarding
      and u.role <> 'admin'
      and u.created_at < v_cutoff
      and coalesce(au.last_sign_in_at, u.created_at) < v_cutoff
  loop
    begin
      delete from users where id = r.id;
      delete from auth.users where id = r.id;
      v_deleted := v_deleted + 1;
    exception when others then
      v_skipped := v_skipped + 1;
      raise warning 'purge_incomplete_signups: % 건너뜀 — %', r.id, sqlerrm;
    end;
  end loop;

  return jsonb_build_object('deleted', v_deleted, 'skipped', v_skipped);
end;
$$;

revoke all on function public.purge_incomplete_signups(integer) from public, anon, authenticated;
grant execute on function public.purge_incomplete_signups(integer) to service_role;

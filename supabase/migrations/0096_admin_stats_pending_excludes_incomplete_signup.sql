-- 이용 통계의 "심사 대기" 수에서 가입을 끝내지 않은 사람을 뺀다(2026-10-08, 회원 관리 화면과 같은 기준).
-- 소셜로그인은 버튼을 누르는 순간 users 행이 status=pending으로 생기지만, /onboarding(실명·생년월일·
-- 약관 동의)을 마치기 전(needs_onboarding=true, 0027)에는 승인할 대상이 아니다.
--
-- admin_stats_core()(0083)의 실제 DB 정의에서 조건 한 줄만 바꿔 끼운다(0092~0095와 같은 방식).
do $$
declare
  fn constant regprocedure := to_regprocedure('public.admin_stats_core(integer, boolean)');
  def text;
  old_line constant text := $q$'pending', count(*) filter (where status = 'pending'),$q$;
  new_line constant text := $q$'pending', count(*) filter (where status = 'pending' and not needs_onboarding),$q$;
begin
  if fn is null then
    raise notice 'admin_stats_core() 없음 — 건너뜀';
    return;
  end if;
  def := pg_get_functiondef(fn);
  if position(new_line in def) > 0 then
    return; -- 이미 적용됨
  end if;
  if position(old_line in def) = 0 then
    raise exception 'admin_stats_core(): 기준 줄을 찾지 못해 중단';
  end if;
  execute replace(def, old_line, new_line);
end;
$$;

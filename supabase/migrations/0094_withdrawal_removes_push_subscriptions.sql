-- 회원 탈퇴 때 푸시 알림 구독 정보도 지운다(2026-10-08, 개인정보처리방침 개정에 맞춤 —
-- "푸시 알림 구독 정보: 알림을 끄거나 구독이 만료될 때, 또는 회원 탈퇴 시까지").
-- push_subscriptions(0074)는 users on delete cascade지만, 탈퇴는 users 행을 지우지 않고
-- 익명화만 해서(0046) 구독 주소·암호화 키가 그대로 남아 있었다.
--
-- withdraw_own_account()도 실제 DB의 현재 정의에 한 줄만 끼워 넣는다(0092/0093과 같은 방식).
-- 개발 DB처럼 0046이 적용되지 않아 함수가 없는 곳에서는 건너뛴다.
do $$
declare
  fn constant regprocedure := to_regprocedure('public.withdraw_own_account()');
  def text;
  anchor constant text := 'delete from verifications where user_id = uid;';
  added  constant text := 'delete from push_subscriptions where user_id = uid;';
begin
  if fn is null then
    raise notice 'withdraw_own_account() 없음 — 건너뜀';
    return;
  end if;
  def := pg_get_functiondef(fn);
  if position(added in def) > 0 then
    return; -- 이미 적용됨
  end if;
  if position(anchor in def) = 0 then
    raise exception 'withdraw_own_account(): 기준 줄을 찾지 못해 중단';
  end if;
  execute replace(def, anchor, anchor || E'\n\n  ' || added);
end;
$$;

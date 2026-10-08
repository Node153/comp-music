-- 회원 탈퇴 때 비공개(Companion 공개·특정 회원 공개) 게시물도 지운다(2026-10-08, 사용자 결정).
-- 0046은 전체 공개 글만 지우고 비공개 글은 "memo의 공동 작업물"이라며 익명화만 해서 남겼는데,
-- memo 작업물 기능이 DEMO로 합쳐진 뒤(0088)로는 비공개 글도 그냥 본인 게시물이다 — 탈퇴하면
-- 공개 범위와 상관없이 전부 지운다(댓글·좋아요·게시물 채팅·열람 권한 등은 posts on delete cascade).
-- DM(messages)은 그대로 남는다 — 상단에 고정된 게시물 참조(source_post_id)만 먼저 끊는다.
-- 첨부 파일(R2)은 탈퇴 화면(WithdrawAccountSection)이 RPC 호출 전에 /api/storage/delete로 지운다.
--
-- withdraw_own_account()의 실제 DB 정의에서 조건 두 곳만 바꿔 끼운다(0092~0094와 같은 방식).
-- 개발 DB처럼 0046이 적용되지 않아 함수가 없는 곳에서는 건너뛴다.
do $$
declare
  fn constant regprocedure := to_regprocedure('public.withdraw_own_account()');
  def text;
  old_ref constant text := $q$where source_post_id in (select id from posts where user_id = uid and visibility = 'public');$q$;
  new_ref constant text := $q$where source_post_id in (select id from posts where user_id = uid);$q$;
  old_del constant text := $q$delete from posts where user_id = uid and visibility = 'public';$q$;
  new_del constant text := $q$delete from posts where user_id = uid;$q$;
begin
  if fn is null then
    raise notice 'withdraw_own_account() 없음 — 건너뜀';
    return;
  end if;
  def := pg_get_functiondef(fn);
  if position(new_del in def) > 0 and position(new_ref in def) > 0 then
    return; -- 이미 적용됨
  end if;
  if position(old_ref in def) = 0 or position(old_del in def) = 0 then
    raise exception 'withdraw_own_account(): 기준 줄을 찾지 못해 중단';
  end if;
  execute replace(replace(def, old_ref, new_ref), old_del, new_del);
end;
$$;

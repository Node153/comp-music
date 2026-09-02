-- 회원 탈퇴(이용약관 제12조) — "서비스 내 설정 화면"에서 직접 탈퇴할 수 있는 기능.
--
-- 완전한 계정 삭제(auth.users 행 삭제)는 지금 스키마에서 안전하지 않다: messages/conversations가
-- users를 on delete cascade 없이 참조해서, DM을 한 번이라도 보낸 사용자를 삭제하면 FK 위반으로
-- 실패한다. 그래서 "삭제"가 아니라 "비활성화 + 개인정보 파기"로 구현한다(개인정보보호법상
-- 익명화도 파기로 인정됨):
-- - 실명·생년월일·프로필 항목·이메일은 지우거나 식별 불가능한 값으로 바꾼다.
-- - DEMO(visibility='public') 게시물·댓글·좋아요는 하드 삭제한다(본인 직접삭제와 동일 원칙,
--   privacy 3장 "게시물·댓글: 작성자가 직접 삭제하거나 회원 탈퇴 시까지").
-- - memo/Complex(followers·invite_only) 게시물은 다른 참여자와 공동 작업물이라 남긴다
--   (terms 제12조 4항 "참여 회원 간 협의 원칙, 협의 없으면 운영자가 유지 가능") — 다만 작성자
--   이름은 아래에서 users.name/nickname을 바꾸면 자동으로 "탈퇴한 사용자"로 보인다(이름을
--   스냅샷으로 따로 저장해두는 테이블이 없어서, 여기서 한 번만 바꾸면 전부 반영됨).
-- - DM(messages)도 같은 이유로 남긴다.

alter table users add column withdrawn_at timestamptz;

-- 0006에서 만든 트리거가 본인 status 변경을 전부 막아놨다(관리자만 가능) — "탈퇴로의 자진
-- 전환"만 예외로 허용한다. role 변경은 여전히 막는다.
create or replace function public.prevent_self_status_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not is_admin(auth.uid()) then
    raise exception 'Only admins can change role';
  end if;
  if new.status is distinct from old.status
     and not is_admin(auth.uid())
     and not (new.status = 'withdrawn' and old.status is distinct from 'withdrawn' and auth.uid() = old.id) then
    raise exception 'Only admins can change status';
  end if;
  return new;
end;
$$;

-- 탈퇴 처리 — 매개변수로 사용자 id를 받지 않고 항상 auth.uid()(자기 자신)에만 작용한다.
-- 이게 유일한 보안장치다: security definer라 RLS를 우회하지만, 대상은 호출자 본인으로 고정.
create or replace function public.withdraw_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if (select status from users where id = uid) = 'withdrawn' then
    raise exception 'Already withdrawn';
  end if;

  -- 내 DEMO 게시물이 DM 상단에 고정된 경우(messages.source_post_id) 게시물 삭제 시 FK
  -- 위반을 막기 위해 먼저 참조를 끊는다 — 대화 내용 자체는 그대로 남는다.
  update messages set source_post_id = null
    where source_post_id in (select id from posts where user_id = uid and visibility = 'public');

  -- DEMO만 하드 삭제(댓글·좋아요·복제 참여 정보는 posts on delete cascade로 함께 삭제됨).
  -- memo/Complex(followers/invite_only) 게시물은 공동 작업물이라 건드리지 않는다.
  delete from posts where user_id = uid and visibility = 'public';

  delete from verifications where user_id = uid;

  update profiles set
    school = null,
    major = null,
    instruments = null,
    region = null,
    bio = null,
    portfolio_links = null,
    profile_image_url = null
  where user_id = uid;

  update users set
    name = '탈퇴한 사용자',
    nickname = '탈퇴한 사용자',
    birth_date = null,
    email = 'withdrawn-' || uid || '@deleted.local',
    status = 'withdrawn',
    withdrawn_at = now()
  where id = uid;
end;
$$;

grant execute on function public.withdraw_own_account() to authenticated;

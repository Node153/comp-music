-- 소셜로그인 중복가입 사전 차단(2026-08-29, 사용자 요청) — 같은 사람이 Google로 가입한 뒤
-- 나중에(로그인 방법을 잊어버려서) Spotify로 또 가입하면 온보딩 화면에서 이름+생년월일이
-- 겹치는 게 실제로 확인됨(관리자 화면 "동일인 가능성 높음" 경고). 지금까지는 사후에
-- 관리자가 발견해서 처리하는 방식이었는데, 이번엔 온보딩/가입 제출 시점에 아예 막기로 함
-- (완전 자동 차단 — 사용자가 "우선 완전차단해줘"라고 명시적으로 요청함. 추후 PASS 본인인증
-- 도입 시 연락처 기반으로 더 정확하게 재검토 예정이라고 함).
--
-- users_select_self_or_approved_peers RLS(0031)가 본인 또는 승인된 사람끼리만 서로 볼 수
-- 있게 막아놔서, 가입 중인/대기 중인 사용자는 클라이언트에서 직접 users 테이블을 조회해도
-- 다른 pending 계정의 이름·생년월일을 못 본다(항상 빈 결과) — public_taken_nicknames(0032)
-- 때 겪었던 것과 같은 함정. 그래서 "이름+생년월일 일치 여부"만 boolean으로 알려주는 좁은
-- security definer 함수를 하나 둔다 — 다른 사람의 실제 개인정보는 전혀 노출하지 않는다.
create or replace function public.check_duplicate_identity(
  p_name text,
  p_birth_date date,
  p_exclude_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from users
    where trim(name) = trim(p_name)
      and birth_date = p_birth_date
      and (p_exclude_id is null or id <> p_exclude_id)
  );
$$;

-- 이메일 가입(로그인 전, anon)과 소셜로그인 온보딩(로그인 후, authenticated) 양쪽에서 호출.
grant execute on function public.check_duplicate_identity(text, date, uuid) to anon, authenticated;

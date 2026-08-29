-- 닉네임 숫자 접미사(_0000)는 유니크 보장용 내부 값일 뿐, 평상시 화면에는 노출하지 않는다
-- (2026-08-20, 사용자 요청 — 익명성 강화를 위해 접미사를 되살린 직후 "그래도 남들 눈엔 안
-- 보이게 하자"는 후속 요청). users.nickname 컬럼 자체(저장값)는 그대로 두고, 표시 레이어
-- 3곳(user_display 뷰, knock_context 함수, public_post_authors 뷰)에서만 정규식으로 잘라낸다
-- — 이 셋을 거의 모든 화면(피드/댓글/DM/알림/프로필/노크 등)이 공용으로 쓰고 있어서
-- (signup/SearchPanel.tsx만 예외 — 별도로 클라이언트에서 처리) 여기 세 곳만 고치면 충분하다.

-- CREATE OR REPLACE로는 안 됨 — nickname이 varchar(30)이라 regexp_replace()를 씌우면
-- 반환 타입이 text로 바뀌는데, PostgreSQL은 뷰/함수의 기존 컬럼 타입 변경을 REPLACE로
-- 허용하지 않는다(구조 자체를 바꾸는 거라 DROP 후 재생성 필요).
drop view if exists user_display;
drop function if exists knock_context(uuid);
drop view if exists public_post_authors;

create view user_display as
select
  u.id,
  case
    when u.id = auth.uid() or are_companions(u.id, auth.uid()) then u.name
    else regexp_replace(u.nickname, '_[0-9]{4}$', '')
  end as display_name,
  (u.id = auth.uid() or are_companions(u.id, auth.uid())) as shows_real_name
from users u
where is_approved(auth.uid())
  and (u.status = 'approved' or u.id = auth.uid());

create function knock_context(pid uuid)
returns table (display_name text, is_companion boolean)
language sql
security definer
stable
as $$
  select
    case
      when are_companions(u.id, auth.uid()) then u.name
      else regexp_replace(u.nickname, '_[0-9]{4}$', '')
    end as display_name,
    are_companions(u.id, auth.uid()) as is_companion
  from post_access pa
  join posts p on p.id = pa.post_id
  join users u on u.id = pa.user_id
  where pa.post_id = pid
    and pa.status in ('invited', 'accepted')
    and pa.user_id <> p.user_id
    and pa.user_id <> auth.uid()
    and is_approved(auth.uid())
  order by is_companion desc, display_name;
$$;

create view public_post_authors as
select u.id, regexp_replace(u.nickname, '_[0-9]{4}$', '') as display_name
from users u
where u.status = 'approved'
  and exists (
    select 1 from posts p
    where p.user_id = u.id and p.visibility = 'public' and p.status in ('published', 'expired')
  );

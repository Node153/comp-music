-- 노크 UI 참여자 요약 개편(0018 실명/닉네임 이원화 후속).
--
-- 기존 knock_context(0017)는 "내 Companion만 이름, 그 외는 '외 n명'으로만 카운트"하는
-- 부분 공개였다 — 0018에서 실명/닉네임 뷰(user_display)가 생기기 전이라, 참여자 존재 자체를
-- 숨기는 게 유일한 프라이버시 수단이었기 때문. 이제는 닉네임이 "공개해도 되는 식별자"로
-- 자리잡았으므로, Companion 여부와 무관하게 참여자 전원을 이름으로 보여주되 실명/닉네임만
-- 뷰어 기준으로 갈린다(user_display와 동일한 로직) — 앱 전체의 이름 표시 정책과 일관되게 통일.
-- 반환 타입(테이블 컬럼 구성)이 바뀌어서 create or replace로는 안 되고 drop 후 재생성해야 함.
drop function knock_context(uuid);

create function knock_context(pid uuid)
returns table (display_name text)
language sql
security definer
stable
as $$
  select
    case
      when are_companions(u.id, auth.uid()) then u.name
      else u.nickname
    end as display_name
  from post_access pa
  join posts p on p.id = pa.post_id
  join users u on u.id = pa.user_id
  where pa.post_id = pid
    and pa.status in ('invited', 'accepted')
    and pa.user_id <> p.user_id
    and pa.user_id <> auth.uid()
    and is_approved(auth.uid())
  order by display_name;
$$;

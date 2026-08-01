-- 참여자 요약을 "아직 참여자 아님(잠김) → 내 Companion 이름 + 나머지 인원수" /
-- "이미 참여자(공개) → 전원 이름"의 두 단계로 나눠 보여주기 위해(0019 후속), knock_context가
-- 참여자별 Companion 여부까지 함께 반환하도록 확장한다. 최종 문구 조립은 서버(feed/page.tsx)가
-- canViewMedia(참여자 여부)를 보고 결정 — 그래야 아직 참여 안 한 뷰어에게 비Companion
-- 참여자의 닉네임이 응답 페이로드로라도 새지 않는다(서버 컴포넌트에서 최종 문자열만
-- 클라이언트로 내려보냄).
drop function knock_context(uuid);

create function knock_context(pid uuid)
returns table (display_name text, is_companion boolean)
language sql
security definer
stable
as $$
  select
    case
      when are_companions(u.id, auth.uid()) then u.name
      else u.nickname
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

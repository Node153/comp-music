-- feed/page.tsx가 invite_only 게시물마다 knock_context(pid uuid)를 개별 호출해서(Promise.all로
-- 병렬화는 했지만 라운드트립 수는 그대로 게시물 수만큼) N+1이 됐다 — post_id 배열을 한 번에
-- 받는 배치 버전을 추가한다. 로직은 0038의 knock_context와 동일, post_id 컬럼만 추가.
create function knock_context_batch(pids uuid[])
returns table (post_id uuid, display_name text, is_companion boolean)
language sql
security definer
stable
as $$
  select
    pa.post_id,
    case
      when are_companions(u.id, auth.uid()) then u.name
      else u.nickname
    end as display_name,
    are_companions(u.id, auth.uid()) as is_companion
  from post_access pa
  join posts p on p.id = pa.post_id
  join users u on u.id = pa.user_id
  where pa.post_id = any(pids)
    and pa.status in ('invited', 'accepted')
    and pa.user_id <> p.user_id
    and pa.user_id <> auth.uid()
    and is_approved(auth.uid())
  order by pa.post_id, is_companion desc, display_name;
$$;

-- conversationList.ts(대화 목록 조립)가 "대화당 마지막 메시지 1개"만 필요한데 해당 유저의
-- 모든 대화의 모든 메시지를 통째로 가져와 JS에서 첫 번째만 골라쓰고 있었다 — 대화 이력이
-- 쌓일수록 목록 하나 그릴 때마다 전체 메시지 테이블을 훑는 셈이라 가장 심각한 병목이었다.
-- DISTINCT ON으로 대화당 1행만 돌려주는 함수로 대체한다. security definer를 안 붙여서
-- (invoker 기본값) 호출자 세션 그대로 messages_select_participant RLS가 적용된다 — 참여자인
-- 대화의 메시지만 보인다는 보장이 함수를 거쳐도 그대로 유지된다.
create function public.latest_messages_for_conversations(conversation_ids uuid[])
returns table (conversation_id uuid, content text, created_at timestamptz)
language sql
stable
as $$
  select distinct on (m.conversation_id) m.conversation_id, m.content, m.created_at
  from messages m
  where m.conversation_id = any(conversation_ids)
  order by m.conversation_id, m.created_at desc;
$$;

grant execute on function public.latest_messages_for_conversations(uuid[]) to authenticated;

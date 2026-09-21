-- 0007에서 만든 messages_update_participant / conversations_update_participant 정책이
-- with check 없이 using만 있어서, "그 대화 참여자"이기만 하면 UPDATE 시 어떤 컬럼이든(
-- messages.content, messages.sender_id, conversations.user_a_id/user_b_id 포함) 바꿀 수
-- 있었다. 원래 의도는 각각 "read_at 갱신"과 "last_message_at 갱신" 뿐이었다.
--
-- with check로 컬럼 단위 제한을 표현할 수 없어서(비교 대상인 OLD 값에 접근 불가), 테이블
-- 직접 UPDATE 권한 자체를 없애고 그 용도만 수행하는 security definer 함수로 대체한다.
-- 0046_account_withdrawal.sql과 같은 원칙: 함수가 RLS를 우회하는 대신, 호출자가 실제
-- 참여자인지를 함수 내부에서 auth.uid()로 직접 검증한다.

drop policy "messages_update_participant" on messages;
drop policy "conversations_update_participant" on conversations;

create function public.mark_messages_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from conversations c
    where c.id = p_conversation_id
      and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid())
  ) then
    raise exception 'not a participant';
  end if;

  update messages
  set read_at = now()
  where conversation_id = p_conversation_id
    and sender_id <> auth.uid()
    and read_at is null;
end;
$$;

create function public.touch_conversation_last_message(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversations
  set last_message_at = now()
  where id = p_conversation_id
    and (user_a_id = auth.uid() or user_b_id = auth.uid());
end;
$$;

grant execute on function public.mark_messages_read(uuid) to authenticated;
grant execute on function public.touch_conversation_last_message(uuid) to authenticated;

-- 피드백 채팅(0047)에 "운영자에게만(비공개)" 옵션과 유형(버그/불편/아이디어/좋아요)을 추가한다.
-- 전체 공개만 있으면 소규모 파일럿에선 불만·버그를 남기기 부담스러워서(2026-09 피드백 창구 분석),
-- 비공개 메시지는 작성자 본인 + 관리자만 볼 수 있게 select 정책을 좁힌다.
-- 기존 행/구버전 클라이언트는 is_private=false(공개), category=null(일반 대화)로 그대로 동작한다.
alter table feedback_messages
  add column is_private boolean not null default false,
  add column category   text check (category in ('bug', 'inconvenience', 'idea', 'praise'));

drop policy "feedback_messages_select_approved" on feedback_messages;

create policy "feedback_messages_select_approved"
  on feedback_messages for select
  using (
    is_approved(auth.uid())
    and (not is_private or user_id = auth.uid() or is_admin(auth.uid()))
  );

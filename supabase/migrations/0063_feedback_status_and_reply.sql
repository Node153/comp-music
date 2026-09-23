-- 피드백 "처리 결과"를 작성자에게 돌려주는 구조(2026-09 피드백 창구 분석 P1).
-- 남긴 의견이 어떻게 됐는지 보이지 않으면 다음 피드백이 끊기므로, 관리자가 상태
-- (접수/검토중/반영됨/보류)와 답변을 달고, 작성자는 채팅과 알림 패널에서 그 결과를 본다.
--
-- admin_updated_at — 관리자가 상태/답변을 바꾼 마지막 시각. 알림(notificationList.ts)은
-- 별도 테이블 없이 이 값이 users.notifications_seen_at보다 최신인지로 안읽음을 판정한다.
alter table feedback_messages
  add column status           text not null default 'received'
    check (status in ('received', 'reviewing', 'done', 'on_hold')),
  add column admin_reply      text check (char_length(admin_reply) <= 2000),
  add column admin_updated_at timestamptz;

-- 상태/답변 수정은 관리자만. 작성자 본인도 update 불가(내용 수정 기능은 없음).
create policy "feedback_messages_update_admin"
  on feedback_messages for update
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

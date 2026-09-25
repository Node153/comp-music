-- 업로드 "피드백 받기"(2026-09-26 사용자 요청) — 어떤 부분을 봐줬으면 하는지(복수)와 한 줄 요청.
-- feedback_focus가 null이면 피드백 요청 안 한 글, 배열이면 요청한 글(분야 목록은 src/lib/feedbackFocus.ts).
alter table posts add column if not exists feedback_focus text[];
alter table posts add column if not exists feedback_note text;
alter table posts drop constraint if exists posts_feedback_note_len;
alter table posts add constraint posts_feedback_note_len check (feedback_note is null or char_length(feedback_note) <= 120);

-- 정책 변경(사용자 요청): memo(전체공개가 아닌 게시물 — Companion공개/특정인초대)는
-- 영상을 못 올리고 음원만 올릴 수 있다. /upload 폼(client)은 이미 memo 선택 시
-- 파일 선택기를 mp3/wav로 제한하고 media_type을 'audio'로 강제해서 막고 있었지만,
-- DB에는 이를 강제하는 제약이 없어서 클라이언트를 우회한 API 호출로는 여전히 memo에
-- 영상/이미지를 올릴 수 있었다(RLS posts_insert_self도 소유자·승인 여부만 검사, 미디어
-- 타입은 안 봄). 여기서 실제 정책으로 못박는다.
--
-- NOT VALID로 추가 — 이 시점 이전에 이미 올라간 memo 영상 게시물(운영 DB 기준 5건,
-- 서비스가 정책 없이 열려있던 시절 콘텐츠)은 건드리지 않고 그대로 둔다. 이 마이그레이션
-- 이후의 INSERT/UPDATE부터만 강제된다(NOT VALID는 기존 행 전수 검사만 건너뛸 뿐, 새
-- 쓰기는 여전히 즉시 검사됨 — Postgres 문서 기준).
alter table posts add constraint posts_memo_audio_only
  check (visibility = 'public' or media_type = 'audio')
  not valid;

-- 0049에서 추가한 "memo(전체공개 아닌 게시물)는 음원만" 제약을 되돌린다(사용자 요청,
-- 정책을 다시 바꿈 — 이제 공동창작(collab_available) 체크 여부로 memo 게시물이
-- 두 갈래로 나뉜다: 체크 시 기존 음원 전용 협업 채팅방, 체크 해제 시 DEMO와 동일하게
-- 영상/이미지/음원 다 허용 + 좋아요/댓글/조회자 목록. 미체크 쪽은 영상을 다시 받아야
-- 하므로 "visibility=public 아니면 무조건 audio" 제약은 더 이상 맞지 않는다.
-- 공동창작 체크 시에 한해 음원만 허용하는 제약은 그 기능을 실제로 구현하는 후속
-- 마이그레이션에서 별도로 추가한다.
alter table posts drop constraint if exists posts_memo_audio_only;

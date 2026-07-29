-- demo도 Complex처럼 영상 또는 음원(mp3/wav) 게시물을 지원하게 됨(2026-07-29).
-- video_url/image_url과 같은 패턴으로 audio_url을 추가하고, media_type 체크 제약을
-- video/image/audio 3종으로 넓힌다.
-- media_type 체크 제약은 0010에서 `alter table ... add column ... check (...)`로 이름 없이
-- 추가돼서 Postgres가 자동으로 이름을 붙였다 — 정확한 이름을 장담할 수 없어 이름으로 드롭하지 않고
-- pg_constraint에서 media_type 관련 check 제약을 찾아 동적으로 드롭한다.
do $$
declare
  found_constraint text;
begin
  select con.conname into found_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'posts'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%media_type%'
    and pg_get_constraintdef(con.oid) ilike '%video%';
  if found_constraint is not null then
    execute format('alter table posts drop constraint %I', found_constraint);
  end if;
end $$;

alter table posts drop constraint if exists posts_media_url_matches_type;

alter table posts add column audio_url varchar(500);

alter table posts add constraint posts_media_type_check
  check (media_type in ('video', 'image', 'audio'));

alter table posts add constraint posts_media_url_matches_type check (
  (media_type = 'video' and video_url is not null and image_url is null and audio_url is null) or
  (media_type = 'image' and image_url is not null and video_url is null and audio_url is null) or
  (media_type = 'audio' and audio_url is not null and video_url is null and image_url is null)
);

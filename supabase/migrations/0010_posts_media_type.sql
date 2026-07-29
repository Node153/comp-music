-- 업로드 화면에서 영상뿐 아니라 이미지도 올릴 수 있게 됨(2026-07-29).
-- video_url을 이미지 게시물에도 재사용하면 컬럼명이 실제와 안 맞아서, image_url을 별도로 두고
-- media_type으로 어느 쪽을 봐야 하는지 구분한다. 기존 행은 전부 영상이라 media_type 기본값 'video'.
alter table posts add column media_type varchar(10) not null default 'video'
  check (media_type in ('video', 'image'));
alter table posts add column image_url varchar(500);
alter table posts alter column video_url drop not null;
alter table posts add constraint posts_media_url_matches_type check (
  (media_type = 'video' and video_url is not null and image_url is null) or
  (media_type = 'image' and image_url is not null and video_url is null)
);

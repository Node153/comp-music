-- 업로드 폼에서 "콘텐츠 유형" 선택을 없애고 해시태그(instrument_tags)만으로 진행하기로 해서
-- content_type을 더 이상 필수로 받지 않음. 기존 게시물의 값은 그대로 유지.
alter table posts alter column content_type drop not null;

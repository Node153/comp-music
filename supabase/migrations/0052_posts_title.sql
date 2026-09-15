-- 게시물 캡션과 별도로 "작품 제목"을 입력받기 위한 컬럼(2026-09-15, 사용자 요청).
-- caption은 계속 부가 설명(선택)으로 남고, title이 작품 이름 역할을 한다.
-- 기존 게시물(prod 포함)에는 값이 없어 nullable로 추가 — 업로드 폼에서는 필수로 받되
-- DB 레벨 NOT NULL 제약은 caption과 동일하게 걸지 않는다(레거시 게시물 보호).
alter table public.posts add column title text;

-- 가입 인증 단계(/verify/documents)에서 "좋아하는 장르"(정확히 3개) 받기 위한 컬럼.
-- profiles.instruments(포지션 — 무엇을 하는 사람인지)와 대칭되는 축으로, 스타일/장르 태그를
-- 담는다(GenreTagPicker.tsx, src/lib/genres.ts의 GENRE_TAGS). instruments와 같은 패턴으로
-- nullable text[] — 기존 verify/documents upsert 로직이 실패해도 인증 제출 자체는 막지 않는
-- "부가 정보" 취급 원칙을 그대로 따른다.
alter table profiles add column favorite_genres text[];

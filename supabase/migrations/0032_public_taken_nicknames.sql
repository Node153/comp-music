-- 버그 수정: 닉네임 자동추천 겹침 방지(62ffae9)가 회원가입/온보딩 화면에서는 조용히 안 먹었음.
-- users_select_self_or_approved_peers(0002)가 "본인" 또는 "승인된 상대"만 허용해서, 비로그인
-- (signup) 또는 승인 전(onboarding) 상태로는 다른 사람 닉네임을 아예 조회 못 함 — 쿼리 자체는
-- 에러 없이 그냥 빈 결과만 돌려줘서 배포 후에도 티가 안 났다.
-- 닉네임은 애초에 "남이 검색해서 찾을 수 있는" 공개 식별자라(NicknameForm.tsx 안내 문구
-- 참고) 이 용도로 공개해도 프라이버시 문제는 없음 — 다만 users 테이블 전체를 열어주는 대신
-- 후보 문구뱅크(최대 35개)와 겹치는 닉네임만 딱 돌려주는 좁은 함수로 노출 범위를 최소화한다.
create or replace function public_taken_nicknames(candidates text[])
returns setof text
language sql
security definer
stable
as $$
  select nickname from users where nickname = any(candidates);
$$;

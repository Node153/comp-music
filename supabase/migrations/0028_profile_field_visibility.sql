-- 프로필 필드별 공개 여부(PROFILE-02) — 닉네임/포지션/소개글은 항상 전체공개, 나머지
-- (활동 유형/학교/지역)는 사용자가 켜고 끌 수 있는 선택 공개로 바꾼다.
-- 기존 사용자는 지금까지 이 필드들이 그냥 보이고 있었으므로, 기본값을 true(공개)로 둬서
-- 이 마이그레이션 자체가 기존 노출 상태를 바꾸지 않게 한다 — 원치 않는 사람만 프로필
-- 수정에서 끄면 된다.
alter table profiles
  add column user_type_public boolean not null default true,
  add column school_public boolean not null default true,
  add column region_public boolean not null default true;

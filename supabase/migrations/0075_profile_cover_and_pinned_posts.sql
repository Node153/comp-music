-- 프로필 커버 사진 + 상단 고정 게시물(2026-09-24, 페이스북 프로필 참고 — 사용자 요청).
--
-- 1) profiles.cover_image_url — 프로필 사진(profile_image_url)과 같은 방식으로 R2 key를 저장하고,
--    표시는 /api/cover/[userId] 한 라우트가 바이트를 직접 실어 보낸다(/api/avatar와 동일 패턴).
-- 2) posts.profile_pinned_at — 작성자가 자기 프로필 맨 위(페이스북 "하이라이트" 자리)에 고정한
--    게시물. memo 탭의 post_pins(0055)는 "보는 사람 본인 화면에만" 적용되는 개인화 설정이라
--    개념이 달라 별도 컬럼으로 둔다 — 이건 이 프로필을 보는 모든 사람에게 똑같이 보인다.
--    쓰기는 기존 posts_update_self RLS(작성자 본인만 update)로 충분하다. 최대 3개.

alter table profiles add column cover_image_url varchar(500);

alter table posts add column profile_pinned_at timestamptz;

create index posts_profile_pinned_idx on posts (user_id, profile_pinned_at desc)
  where profile_pinned_at is not null;

create or replace function public.enforce_profile_pin_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.profile_pinned_at is not null and old.profile_pinned_at is null then
    if (select count(*) from posts where user_id = new.user_id and profile_pinned_at is not null and id <> new.id) >= 3 then
      raise exception '상단 고정은 최대 3개까지 할 수 있어요';
    end if;
  end if;
  return new;
end;
$$;

create trigger posts_profile_pin_limit
  before update of profile_pinned_at on posts
  for each row execute function public.enforce_profile_pin_limit();

-- 탈퇴(0046 withdraw_own_account)가 프로필 사진은 지우는데 커버는 이 마이그레이션 이전이라
-- 모른다 — 함수 전체를 다시 쓰는 대신 탈퇴로 바뀌는 순간 커버도 같이 지우는 트리거를 둔다.
create or replace function public.clear_cover_on_withdraw()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'withdrawn' and old.status is distinct from 'withdrawn' then
    update profiles set cover_image_url = null where user_id = new.id;
  end if;
  return new;
end;
$$;

create trigger users_clear_cover_on_withdraw
  after update of status on users
  for each row execute function public.clear_cover_on_withdraw();

-- 실명/닉네임 이원화(0017 Companion 후속).
--
-- 정책: 나와 Companion인 사람(및 본인)에게는 실명(users.name)만, 그 외에는 닉네임(users.nickname)만
-- 보인다 — demo/memo 구분 없이 모든 화면 동일. 가입 시 실명+닉네임 둘 다 필수.
--
-- 구현: 뷰어 기준 판정이 필요하므로 user_display 뷰가 auth.uid() 기준으로 둘 중 하나만
-- display_name으로 내려준다. 앱은 이름 표시 목적의 조회를 전부 users → user_display로 바꾼다.
-- (알려진 한계: users.name 컬럼 자체는 기존 RLS상 승인 사용자가 여전히 직접 select할 수 있다.
--  화면 표시는 전부 뷰를 거치므로 UI 레벨에서는 새지 않지만, API 직접 호출로는 조회 가능 —
--  컬럼 단위 차단(column privilege)은 admin 화면 재설계가 필요해 Phase 1 하드닝으로 미룸.)

-- 1) nickname 컬럼 + 기존 사용자 백필. 실명이 닉네임으로 새지 않게 예시 목록
--    (src/lib/nicknameExamples.ts와 동일) 기반 + id 앞 4자리로 유니크하게 생성 —
--    프로필 수정의 닉네임 폼에서 각자 바꾸는 것을 전제로 한 임시값.
alter table users add column nickname varchar(30);

update users set nickname =
  (array[
    '좋은음악앞에서침묵',
    '좋은음악앞에서말실수',
    '좋은음악앞에서뒤도돌아보지않음',
    '비트반응함',
    '귀가열림',
    '명곡탐지견',
    '음악 좋으면 벽 봄',
    '음악 좋으면 갑자기 진지함',
    '음악 좋으면 매미됨'
  ])[1 + abs(hashtext(id::text)) % 9]
  || '_' || left(replace(id::text, '-', ''), 4);

alter table users alter column nickname set not null;
create unique index users_nickname_unique on users (lower(nickname));

-- 2) 가입 트리거 갱신 — signUp options.data로 name(실명)과 nickname을 함께 받는다.
--    닉네임 누락 시(구버전 클라이언트) id 기반 임시 닉네임으로 대체해 가입 자체는 막지 않는다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, nickname)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'nickname'), ''),
      'user_' || left(replace(new.id::text, '-', ''), 6)
    )
  );
  return new;
end;
$$;

-- 3) 뷰어 기준 표시 이름 뷰 — 본인/Companion이면 실명, 아니면 닉네임.
--    security definer(뷰 기본값)로 users RLS를 우회하되, 승인된 사용자에게만 행을 준다.
create view user_display as
select
  u.id,
  case
    when u.id = auth.uid() or are_companions(u.id, auth.uid()) then u.name
    else u.nickname
  end as display_name,
  (u.id = auth.uid() or are_companions(u.id, auth.uid())) as shows_real_name
from users u
-- 뷰어도 승인돼야 하고, 대상도 승인된 사용자(또는 본인)만 노출 — 미승인 계정 이름은 안 보인다.
where is_approved(auth.uid())
  and (u.status = 'approved' or u.id = auth.uid());

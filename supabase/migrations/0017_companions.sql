-- 팔로우 → Companion(맞팔 전용, 디스코드 친구추가 개념) 전환.
--
-- 배경: demo는 전체공개 알고리즘 피드(릴스식)라 팔로우의 실질 용도가 memo 접근 제어 하나뿐인데,
-- 단방향 팔로우면 "내가 팔로우 안 한 사람이 내 memo를 보는" 비대칭이 생긴다. 상호 수락 모델로
-- 전환해 memo 열람·노크 조건을 "Companion 여부" 하나로 통일한다.
-- UI 표기는 팔로워/팔로잉 두 숫자 대신 "나의 Companion n명" 하나만 쓴다.
--
-- 데이터 이행: 기존 상호 팔로우 쌍만 accepted Companion으로 승격, 단방향 팔로우는 삭제(버림).

-- 1) companions — 한 쌍당 행 하나(요청자/수신자 + 상태). 방향은 "누가 신청했나"만 의미하고,
--    accepted 이후 관계 자체는 무방향이다.
create table companions (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references users(id) on delete cascade,
  addressee_id uuid not null references users(id) on delete cascade,
  status       varchar(10) not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  check (requester_id <> addressee_id)
);

-- 방향을 바꿔 중복 신청(A→B 있는데 B→A insert)하는 것까지 막는 무방향 유니크.
create unique index companions_pair_unique
  on companions (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index idx_companions_addressee on companions(addressee_id, status);

-- 2) 두 사용자가 Companion(accepted)인지 — RLS·노크 판정 공용.
create or replace function are_companions(a uuid, b uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from companions c
    where c.status = 'accepted'
      and ((c.requester_id = a and c.addressee_id = b)
        or (c.requester_id = b and c.addressee_id = a))
  );
$$;

alter table companions enable row level security;

-- select: 당사자는 자기 관련 행 전부(pending 포함), 그 외 승인 사용자는 accepted만
-- (프로필의 "Companion n명" 카운트/목록 표시용 — pending 신청은 당사자 외에 노출하지 않음).
create policy "companions_select_involved_or_accepted"
  on companions for select
  using (
    is_approved(auth.uid())
    and (requester_id = auth.uid() or addressee_id = auth.uid() or status = 'accepted')
  );

-- insert: 본인이 요청자, pending으로만 생성(자기 자신 신청은 테이블 check가 막음).
create policy "companions_insert_request_self"
  on companions for insert
  with check (
    requester_id = auth.uid()
    and is_approved(auth.uid())
    and status = 'pending'
  );

-- update: 수신자만 pending → accepted 수락 가능.
create policy "companions_update_accept_by_addressee"
  on companions for update
  using (addressee_id = auth.uid() and status = 'pending')
  with check (addressee_id = auth.uid() and status = 'accepted');

-- delete: 당사자 누구나 — 요청 취소(요청자), 거절(수신자), 관계 해제(둘 다).
create policy "companions_delete_involved"
  on companions for delete
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- 3) 데이터 이행 — 상호 팔로우 쌍만 accepted로 승격(쌍당 한 행), 단방향은 버린다.
insert into companions (requester_id, addressee_id, status, created_at, accepted_at)
select f1.follower_id, f1.followee_id, 'accepted', least(f1.created_at, f2.created_at), now()
from follows f1
join follows f2
  on f2.follower_id = f1.followee_id and f2.followee_id = f1.follower_id
where f1.follower_id < f1.followee_id;

-- 4) memo(followers 공개) 열람 판정을 팔로우 → Companion으로 교체.
--    visibility 저장값 'followers'는 그대로 두고 의미만 "Companion 공개"로 재정의한다
--    (UI 라벨만 변경 — 컬럼 값 마이그레이션으로 얻는 게 없어서).
create or replace function can_access_post_content(pid uuid, uid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from posts p
    where p.id = pid
      and (
        p.user_id = uid
        or p.visibility = 'public'
        or (p.visibility = 'followers' and are_companions(p.user_id, uid))
        or (p.visibility = 'invite_only' and exists (
              select 1 from post_access pa
              where pa.post_id = p.id and pa.user_id = uid and pa.status in ('invited', 'accepted')
            ))
      )
  );
$$;

drop table follows;

-- 5) 노크는 방장과 Companion인 사람만 — 클라이언트 disabled는 UX 힌트일 뿐이므로
--    (0012의 다른 정책들과 같은 원칙) 실제 경계는 여기 RLS에 둔다.
drop policy "post_access_insert_knock_self" on post_access;

create policy "post_access_insert_knock_self"
  on post_access for insert
  with check (
    status = 'pending'
    and user_id = auth.uid()
    and is_approved(auth.uid())
    and exists (
      select 1 from posts p
      where p.id = post_id
        and p.user_id <> auth.uid()
        and are_companions(p.user_id, auth.uid())
    )
  );

-- 6) 노크 UI용 참여자 요약 — invite_only 게시물의 참여자(초대/수락, 방장·본인 제외) 중
--    나와 Companion인 사람은 이름을, 아닌 사람은 인원수만 돌려준다.
--    post_access select RLS는 참여자 명단을 비참여자에게 숨기므로(0012 설계 유지),
--    이 함수가 "Companion 이름 + 외 n명"이라는 부분 공개만 security definer로 뚫어준다.
create or replace function knock_context(pid uuid)
returns table (companion_names text[], other_count int)
language sql
security definer
stable
as $$
  with participants as (
    select pa.user_id
    from post_access pa
    join posts p on p.id = pa.post_id
    where pa.post_id = pid
      and pa.status in ('invited', 'accepted')
      and pa.user_id <> p.user_id
      and pa.user_id <> auth.uid()
      and is_approved(auth.uid())
  )
  select
    coalesce(
      array_agg(u.name order by u.name) filter (where are_companions(pt.user_id, auth.uid())),
      '{}'
    ),
    coalesce(count(*) filter (where not are_companions(pt.user_id, auth.uid())), 0)::int
  from participants pt
  join users u on u.id = pt.user_id;
$$;

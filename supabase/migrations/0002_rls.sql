-- Row Level Security 기본 정책
-- 근거: spec 1.2 권한 매트릭스 — 미승인(대기/반려) 사용자는 피드/프로필/DM 등 전체 비노출(0-1).
-- 이 마이그레이션은 스캐폴딩 단계의 baseline 정책이며, 기능별로 세부 정책을 계속 다듬어야 한다.

alter table users enable row level security;
alter table profiles enable row level security;
alter table verifications enable row level security;
alter table posts enable row level security;
alter table likes enable row level security;
alter table comments enable row level security;
alter table follows enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

-- 본인 status 조회는 항상 허용(S5 심사 상태 화면), 승인된 사용자는 서로를 조회 가능(1.2)
create or replace function is_approved(uid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from users where id = uid and status = 'approved'
  );
$$;

-- users
create policy "users_select_self_or_approved_peers"
  on users for select
  using (id = auth.uid() or (is_approved(auth.uid()) and status = 'approved'));

create policy "users_update_self"
  on users for update
  using (id = auth.uid());

-- profiles
create policy "profiles_select_self_or_approved_peers"
  on profiles for select
  using (user_id = auth.uid() or is_approved(auth.uid()));

create policy "profiles_update_self"
  on profiles for update
  using (user_id = auth.uid());

create policy "profiles_insert_self"
  on profiles for insert
  with check (user_id = auth.uid());

-- verifications: 본인 것만 조회/생성, 승인 처리는 서비스 롤(관리자 API)에서 처리
create policy "verifications_select_self"
  on verifications for select
  using (user_id = auth.uid());

create policy "verifications_insert_self"
  on verifications for insert
  with check (user_id = auth.uid());

-- posts: 승인 사용자만 조회(0-1). Phase 0은 visibility가 public 고정이므로 승인 여부만 체크.
-- deleted 상태는 하드삭제되므로 별도 필터 불필요.
create policy "posts_select_approved_users"
  on posts for select
  using (is_approved(auth.uid()));

create policy "posts_insert_self"
  on posts for insert
  with check (user_id = auth.uid() and is_approved(auth.uid()));

create policy "posts_update_self"
  on posts for update
  using (user_id = auth.uid());

create policy "posts_delete_self"
  on posts for delete
  using (user_id = auth.uid());

-- likes
create policy "likes_select_approved_users"
  on likes for select
  using (is_approved(auth.uid()));

create policy "likes_insert_self"
  on likes for insert
  with check (user_id = auth.uid() and is_approved(auth.uid()));

create policy "likes_delete_self"
  on likes for delete
  using (user_id = auth.uid());

-- comments
create policy "comments_select_approved_users"
  on comments for select
  using (is_approved(auth.uid()));

create policy "comments_insert_self"
  on comments for insert
  with check (user_id = auth.uid() and is_approved(auth.uid()));

create policy "comments_delete_self"
  on comments for delete
  using (user_id = auth.uid());

-- follows
create policy "follows_select_approved_users"
  on follows for select
  using (is_approved(auth.uid()));

create policy "follows_insert_self"
  on follows for insert
  with check (follower_id = auth.uid() and is_approved(auth.uid()));

create policy "follows_delete_self"
  on follows for delete
  using (follower_id = auth.uid());

-- conversations / messages: 참여자만 조회 가능
create policy "conversations_select_participant"
  on conversations for select
  using (user_a_id = auth.uid() or user_b_id = auth.uid());

create policy "conversations_insert_participant"
  on conversations for insert
  with check ((user_a_id = auth.uid() or user_b_id = auth.uid()) and is_approved(auth.uid()));

create policy "messages_select_participant"
  on messages for select
  using (
    exists (
      select 1 from conversations c
      where c.id = conversation_id
        and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid())
    )
  );

create policy "messages_insert_participant"
  on messages for insert
  with check (
    sender_id = auth.uid()
    and is_approved(auth.uid())
    and exists (
      select 1 from conversations c
      where c.id = conversation_id
        and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid())
    )
  );

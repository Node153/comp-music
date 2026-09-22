-- 프로필 게시물 탭에 사용자가 직접 만드는 "폴더" 탭(2026-09, 협업자 정태인 제안) — 현재/보관된
-- 게시물처럼 자동 분류가 아니라, 본인이 원하는 게시물만 모아 이름 붙이는 사용자 정의 묶음이다
-- (인스타그램 하이라이트/페이스북 앨범과 비슷한 개념, 새 업로드가 아니라 기존 게시물을 담기만
-- 함). 폴더/포함 게시물 둘 다 다른 사람에게도 보이는 공개 정보라 select는 posts와 동일하게
-- is_approved 유저 전체에게 열어두고(0002_rls.sql의 posts_select_approved_users와 동일 게이트),
-- 쓰기(생성/이름변경/삭제/게시물 담기·빼기)만 폴더 주인 본인으로 제한한다.
create table post_folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  name       varchar(30) not null,
  created_at timestamptz not null default now()
);

create index post_folders_user_id_idx on post_folders(user_id);

alter table post_folders enable row level security;

create policy "post_folders_select_approved_users"
  on post_folders for select
  using (is_approved(auth.uid()));

create policy "post_folders_insert_self"
  on post_folders for insert
  with check (user_id = auth.uid() and is_approved(auth.uid()));

create policy "post_folders_update_self"
  on post_folders for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "post_folders_delete_self"
  on post_folders for delete
  using (user_id = auth.uid());

-- 폴더에 담긴 게시물 — 폴더 주인의 자기 게시물만 담을 수 있다(다른 사람 글을 남의 폴더에
-- 몰래 끼워넣을 수 없게 insert에서 폴더 소유권과 게시물 소유권을 둘 다 확인).
create table post_folder_items (
  folder_id  uuid not null references post_folders(id) on delete cascade,
  post_id    uuid not null references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (folder_id, post_id)
);

create index post_folder_items_post_id_idx on post_folder_items(post_id);

alter table post_folder_items enable row level security;

create policy "post_folder_items_select_approved_users"
  on post_folder_items for select
  using (is_approved(auth.uid()));

create policy "post_folder_items_insert_self"
  on post_folder_items for insert
  with check (
    exists (select 1 from post_folders f where f.id = folder_id and f.user_id = auth.uid())
    and exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid())
  );

create policy "post_folder_items_delete_self"
  on post_folder_items for delete
  using (
    exists (select 1 from post_folders f where f.id = folder_id and f.user_id = auth.uid())
  );

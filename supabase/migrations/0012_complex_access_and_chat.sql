-- Complex(팔로워공개/특정인초대 게시물)를 mock에서 실제 DB 연동으로 전환(2026-07-31).
--
-- 프라이버시 경계는 두 군데로 나뉜다:
-- 1) posts 행 자체(캡션/작성자/태그/노크 버튼)는 모든 승인된 사용자에게 계속 보임 —
--    "존재는 보이되 미디어/채팅만 잠긴" 노크 UX를 위해 필수. posts_select_approved_users는
--    건드리지 않는다.
-- 2) 실제 미디어(signed URL)는 R2에 버킷 레벨 RLS가 없어서 애플리케이션(feed/page.tsx)이
--    뷰어별로 조건부로만 서명 URL을 발급하는 방식으로 막는다 — 이 마이그레이션 범위 밖.
-- post_access(초대/노크)와 post_chat_messages(채팅)는 신규 테이블이라 RLS로 완전히 행 단위 차단.

-- visibility는 지금까지 전부 'public'(demo)이었는데 이제 처음으로 다른 값이 실제로 쓰인다.
-- Complex는 'followers' 또는 'invite_only'(신규 — Phase 1의 'private'는 "나만 보기"에 가까운
-- 다른 의미라 값을 분리) 사용. 컬럼 자체는 제약 없는 varchar(20)이었으므로 오타 방지용 체크 추가.
alter table posts add constraint posts_visibility_check
  check (visibility in ('public', 'major', 'school', 'followers', 'invite_only', 'private'));

-- 초대(작성자가 업로드 시 지정) + 노크(열람 요청)를 하나의 테이블로 통합.
create table post_access (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  status     varchar(20) not null check (status in ('invited', 'pending', 'accepted')),
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index idx_post_access_post_status on post_access(post_id, status);
create index idx_post_access_user on post_access(user_id);

alter table post_access enable row level security;

-- select: 본인 행(내 초대/노크 상태) 또는 게시물 작성자(초대·대기 목록 확인)만.
create policy "post_access_select_self_or_author"
  on post_access for select
  using (
    user_id = auth.uid()
    or exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid())
  );

-- insert (1): 작성자가 특정인을 초대. 자기 자신은 초대 대상이 될 수 없다.
create policy "post_access_insert_invite_by_author"
  on post_access for insert
  with check (
    status = 'invited'
    and user_id <> auth.uid()
    and exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid())
  );

-- insert (2): 열람 요청(노크) — 본인만, 승인된 사용자만, 자기 게시물엔 노크 불가.
create policy "post_access_insert_knock_self"
  on post_access for insert
  with check (
    status = 'pending'
    and user_id = auth.uid()
    and is_approved(auth.uid())
    and not exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid())
  );

-- update: 작성자만, 자기 게시물 행만 — 노크 수락(pending→accepted) 용도.
create policy "post_access_update_accept_by_author"
  on post_access for update
  using (exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid()))
  with check (exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid()));

-- delete: 거절(작성자가 pending 행을 삭제 — 재노크 가능하도록 상태값이 아닌 행 자체를 지움) 또는
-- 본인이 스스로 초대/노크를 취소.
create policy "post_access_delete_author_or_self"
  on post_access for delete
  using (
    user_id = auth.uid()
    or exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid())
  );

-- Discord식 채팅 + 재창작물 스택. generation(N차 창작물)은 저장하지 않는다 — is_work=true 메시지를
-- created_at 순으로 나열했을 때의 위치로 조회 시마다 계산한다(동시 업로드 시 저장된 값이 충돌할
-- 수 있는 파생 데이터라 컬럼으로 두지 않음).
create table post_chat_messages (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  sender_id  uuid not null references users(id),
  type       varchar(10) not null check (type in ('text', 'image', 'video', 'audio')),
  content    text,
  file_key   varchar(500),
  is_work    boolean not null default false,
  created_at timestamptz not null default now()
);

-- posts_media_url_matches_type과 같은 스타일 — 타입별로 어느 컬럼이 채워져야 하는지 강제.
alter table post_chat_messages add constraint post_chat_messages_content_matches_type check (
  (type = 'text' and content is not null and file_key is null)
  or (type in ('image', 'video', 'audio') and file_key is not null)
);

create index idx_post_chat_messages_post_created on post_chat_messages(post_id, created_at);

alter table post_chat_messages enable row level security;

-- 게시물 "내용"(미디어/채팅)에 대한 실제 접근 판정 — posts 행 자체의 select와는 분리된 함수.
-- posts_select_approved_users는 이 함수를 쓰지 않는다(위 설명 참고) — post_chat_messages RLS와
-- feed/page.tsx의 signed URL 발급 조건에서만 사용.
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
        or (p.visibility = 'followers' and exists (
              select 1 from follows f
              where f.follower_id = uid and f.followee_id = p.user_id
            ))
        or (p.visibility = 'invite_only' and exists (
              select 1 from post_access pa
              where pa.post_id = p.id and pa.user_id = uid and pa.status in ('invited', 'accepted')
            ))
      )
  );
$$;

create policy "post_chat_messages_select_participant"
  on post_chat_messages for select
  using (is_approved(auth.uid()) and can_access_post_content(post_id, auth.uid()));

-- image/audio 업로드는 mock과 동일하게 collab_available인 게시물에서만 허용(video/text는 항상 허용).
-- mock에서는 클라이언트 disabled 속성으로만 막혀 있었는데(devtools로 우회 가능), 이제 직접 insert
-- 방식으로 가므로 RLS 자체에 이 제약을 넣어 서버 측에서 강제되게 한다.
create policy "post_chat_messages_insert_participant"
  on post_chat_messages for insert
  with check (
    sender_id = auth.uid()
    and is_approved(auth.uid())
    and can_access_post_content(post_id, auth.uid())
    and (
      type in ('text', 'video')
      or exists (select 1 from posts p where p.id = post_id and p.collab_available = true)
    )
  );

-- update/delete 정책 없음(의도적) — 메시지 수정/삭제 기능은 이번 범위 밖.
-- Realtime도 이번 범위에서 보류 — 켜려면 나중에 아래 한 줄만 추가:
-- alter publication supabase_realtime add table post_chat_messages;

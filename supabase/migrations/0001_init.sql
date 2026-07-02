-- Phase 0 (진짜 MVP) 초기 스키마
-- 근거: music-network-mvp-spec.md 4.2, 1.4
-- Phase 1 확장을 대비해 테이블/컬럼은 스펙 4.2 전체를 기준으로 하되,
-- reactions / bookmarks / collab_proposals 3개 테이블만 제외한다 (1.4 "Phase 0 DB 테이블" 참고).
-- posts.visibility 등 Phase 1 전용 컬럼은 남겨두고 기본값으로 고정해 나중에 컬럼을 다시 만들 필요가 없게 한다.

create extension if not exists pgcrypto;

-- 사용자 계정
create table users (
  id            uuid primary key default gen_random_uuid(),
  email         varchar(255) unique not null,
  password_hash varchar(255),              -- 소셜로그인 시 NULL 허용
  name          varchar(100) not null,
  status        varchar(30) not null default 'pending',  -- Phase 0: pending/approved/rejected (0-70)
  role          varchar(20) not null default 'user',     -- user/admin
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 프로필
create table profiles (
  user_id           uuid primary key references users(id) on delete cascade,
  user_type         varchar(20) not null,   -- student/activist
  school            varchar(150),
  major             varchar(100),
  instruments       text[],                 -- 복수 악기
  region            varchar(100),
  collab_available  boolean not null default true,
  bio               text,
  portfolio_links   jsonb,                  -- {"soundcloud": "...", "youtube": "..."}
  profile_image_url varchar(500)
);

create index idx_users_name on users(name);
create index idx_profiles_school on profiles(school);
create index idx_profiles_major on profiles(major);

-- 인증 심사
create table verifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  type          varchar(20) not null,       -- student/activist
  status        varchar(30) not null default 'pending',
  documents     jsonb not null,             -- [{"doc_type":"transcript","file_url":"..."}]
  reject_reason text,
  reviewer_id   uuid references users(id),
  submitted_at  timestamptz not null default now(),
  reviewed_at   timestamptz
);

-- 게시물(릴스)
-- Phase 0: visibility는 'public' 고정(FEED-03 5단계 UI 없음), scheduled_at/즉시게시만 사용(FEED-04 예약 UI 없음)
create table posts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users(id) on delete cascade,
  video_url           varchar(500) not null,
  thumbnail_url       varchar(500),
  caption             text,
  content_type        varchar(30) not null,  -- composition/performance/practice/rehearsal/improv/ensemble
  instrument_tags     text[],
  visibility          varchar(20) not null default 'public', -- public/major/school/followers/private (Phase 0: public 고정)
  collab_available    boolean not null default false,
  collab_role_needed  varchar(200),
  status              varchar(20) not null default 'scheduled', -- scheduled/published/expired/deleted (expired도 영구보관, deleted만 하드삭제)
  scheduled_at        timestamptz,
  published_at        timestamptz,
  expire_hours        int not null,          -- 6/12/24/48
  expires_at          timestamptz,
  created_at          timestamptz not null default now()
);

create index idx_posts_status_expires on posts(status, expires_at);
create index idx_posts_status_scheduled on posts(status, scheduled_at);

-- 좋아요
create table likes (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);

-- 댓글
create table comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  parent_id  uuid references comments(id),   -- 대댓글 1단계
  content    text not null,
  created_at timestamptz not null default now()
);

-- 팔로우
create table follows (
  id           uuid primary key default gen_random_uuid(),
  follower_id  uuid not null references users(id) on delete cascade,
  followee_id  uuid not null references users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique(follower_id, followee_id)
);

-- 대화방
create table conversations (
  id              uuid primary key default gen_random_uuid(),
  user_a_id       uuid not null references users(id),
  user_b_id       uuid not null references users(id),
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  unique(user_a_id, user_b_id)
);

-- 메시지
create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid not null references users(id),
  content         text not null,
  source_post_id  uuid references posts(id),  -- 영상에서 바로 보낸 DM 출처
  created_at      timestamptz not null default now(),
  read_at         timestamptz
);

-- reactions / bookmarks / collab_proposals 테이블은 Phase 0에서 제외 (1.4 참고).
-- Phase 1 전환 시 spec 4.2의 해당 CREATE TABLE 문을 그대로 추가하면 된다.

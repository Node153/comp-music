-- 반응(좋아요·댓글) 즉시 알림 + 웹 푸시(PWA).
--
-- 배경: 앱 출시 전이라 네이티브 푸시가 없고, 기존 이메일은 하루 1회(18:00 KST) 다이제스트에
-- 좋아요·댓글 알림이 기본 꺼짐(0033)이라 신규 유저는 반응을 받아도 사실상 알 방법이 없었다.
-- "반응 → 알림 → 재방문 → 다음 업로드" 루프를 살리려고:
--   1) 좋아요·댓글 이메일을 기본 켜짐으로 바꾸고(파일럿 오픈 전이라 기존 회원도 일괄 켬),
--      다이제스트가 아니라 반응이 생기는 즉시(/api/notify/reaction) 보낸다.
--   2) 브라우저 웹 푸시 구독(push_subscriptions)과 종류별 푸시 설정(push_notify_*)을 추가한다.
--   3) reaction_notifications에 보낸 기록을 남겨 중복 발송(좋아요 껐다 켜기 반복 등)을 막고,
--      이메일 묶음 발송(같은 게시물 좋아요는 1시간에 한 통)·하루 상한 판정에 쓴다.

alter table users alter column email_notify_like set default true;
alter table users alter column email_notify_comment set default true;
update users set email_notify_like = true, email_notify_comment = true;

alter table users
  add column push_notify_like boolean not null default true,
  add column push_notify_comment boolean not null default true,
  add column push_notify_kick boolean not null default true;

-- 브라우저(기기)마다 하나. endpoint가 사실상 구독의 신원이라 unique — 같은 브라우저에서
-- 다른 계정으로 로그인해 다시 구독하면 user_id만 새 계정으로 옮긴다(upsert).
-- 서버(service_role)만 읽고 쓴다 — 정책 없음 = 일반 사용자 접근 불가.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);
create index idx_push_subscriptions_user on push_subscriptions (user_id);
alter table push_subscriptions enable row level security;

-- 반응 알림 발송 기록 — 서버 전용(정책 없음).
--   like    : 같은 사람이 같은 게시물에 평생 1번만(좋아요 토글 반복으로 알림 폭탄 방지).
--   comment : 게시물 작성자에게, 댓글 하나당 1번.
--   reply   : 답글이 달린 원댓글 작성자에게, 답글 하나당 1번.
-- emailed_at은 실제로 메일이 나간 행에만 채워진다(묶음/상한에 걸리면 null).
create table reaction_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references users(id) on delete cascade,
  actor_id uuid not null references users(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  kind text not null check (kind in ('like', 'comment', 'reply')),
  comment_id uuid references comments(id) on delete cascade,
  emailed_at timestamptz,
  pushed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index uq_reaction_notifications_like
  on reaction_notifications (actor_id, post_id) where kind = 'like';
create unique index uq_reaction_notifications_comment
  on reaction_notifications (comment_id, recipient_id) where kind in ('comment', 'reply');
create index idx_reaction_notifications_recipient
  on reaction_notifications (recipient_id, created_at desc);
alter table reaction_notifications enable row level security;

-- 반응 자체가 생기게 만들기(2026-09-24, 사용자 요청 — 파일럿 초기엔 새 글에 반응이 0개면
-- 알림 채널이 아무리 좋아도 보낼 알림이 없다). 이 마이그레이션이 받치는 기능:
--   1) 새 글 부스트: 피드 상단 "첫 반응을 기다리는 Drop" — awaiting_first_reactions()
--   2) 운영자 첫 반응 보장: /admin/awaiting-reactions(서버 service_role 조회라 DB 객체 불필요)
--   3) 빠른 반응 + 타임스탬프 댓글: comments.timestamp_sec
--   4) 재생 수 알림: mark_post_played가 "처음 기록됐는지"를 돌려주게 바꾸고, 청취자 수
--      마일스톤(1·5·10·25…명)을 post_milestones에 한 번씩만 기록
--   5) Companion 새 글 알림: post_milestones(kind='published')로 중복 발송 방지
--   6) PEAK 진행률 알림: post_milestones(kind='peak_progress', value=50/80)
-- 알림 설정 컬럼도 추가 — 푸시는 기본 켜짐, 이메일은 하루 1회 다이제스트에 한 줄씩(기본 켜짐).

alter table users
  add column push_notify_companion_post boolean not null default true,
  add column push_notify_progress boolean not null default true,
  add column email_notify_companion_post boolean not null default true,
  add column email_notify_progress boolean not null default true;

-- "0:42 여기 좋다" — 재생 중인 위치를 붙인 댓글. null이면 일반 댓글.
alter table comments
  add column timestamp_sec integer check (timestamp_sec is null or (timestamp_sec >= 0 and timestamp_sec < 86400));

create table post_milestones (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  kind text not null check (kind in ('plays', 'peak_progress', 'published')),
  value integer not null,
  created_at timestamptz not null default now(),
  unique (post_id, kind, value)
);
create index idx_post_milestones_post on post_milestones (post_id);
alter table post_milestones enable row level security;
-- 쓰기는 서버(service_role)만. 읽기는 게시물 작성자 본인만(알림 목록/뱃지가 사용자 세션으로 읽음).
create policy "post_milestones_select_owner"
  on post_milestones for select
  using (exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid()));

-- 0072의 mark_post_played를 "이번 호출로 처음 기록됐으면 true"를 돌려주게 바꾼다 — 클라이언트가
-- true일 때만 재생 알림 트리거(/api/notify/reaction kind=play)를 불러 같은 사람의 재청취로
-- 요청이 반복되지 않게. 반환 타입이 바뀌어 drop 후 다시 만든다.
drop function if exists public.mark_post_played(uuid);
create function public.mark_post_played(pid uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into post_plays (post_id, user_id)
  values (pid, auth.uid())
  on conflict do nothing;
  return found;
end;
$$;
grant execute on function public.mark_post_played(uuid) to authenticated;

-- 새 글 부스트 후보: 최근 48시간 안에 올라온 남의 DEMO 중 다른 사람 반응(좋아요+댓글)이 3개
-- 미만이고 내가 아직 반응 안 한 것 — 반응 적은 순, 그다음 최신순. security invoker라 posts/likes/
-- comments RLS가 그대로 걸린다(승인 회원만 실질적으로 결과가 나옴).
create or replace function public.awaiting_first_reactions(p_limit int default 8)
returns table (post jsonb, reaction_count integer)
language sql
stable
security invoker
set search_path = public
as $$
  select to_jsonb(p.*) as post, r.cnt as reaction_count
  from posts p
  cross join lateral (
    select (
      (select count(*) from likes l where l.post_id = p.id and l.user_id <> p.user_id)
      + (select count(*) from comments c where c.post_id = p.id and c.user_id <> p.user_id)
    )::int as cnt
  ) r
  where auth.uid() is not null
    and p.status = 'published'
    and p.visibility = 'public'
    and p.published_at > now() - interval '48 hours'
    and (p.expires_at is null or p.expires_at > now())
    and p.user_id <> auth.uid()
    and r.cnt < 3
    and not exists (select 1 from likes l where l.post_id = p.id and l.user_id = auth.uid())
    and not exists (select 1 from comments c where c.post_id = p.id and c.user_id = auth.uid())
  order by r.cnt asc, p.published_at desc
  limit least(greatest(p_limit, 1), 20);
$$;
grant execute on function public.awaiting_first_reactions(int) to authenticated;

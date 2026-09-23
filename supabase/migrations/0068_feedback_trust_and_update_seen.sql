-- 피드백 페이지 신뢰감·발견성 개선(2026-09-24).
--
-- 1) feedback_stats() — 페이지 상단 "처리 현황 띠"용 집계(받은 의견/검토 중/반영/이번 달 반영/
--    평균 첫 응답 시간). 비공개 피드백은 회원이 RLS로 못 읽어 직접 셀 수 없으므로 security
--    definer로 숫자만 돌려준다(내용은 노출 안 함). 승인 회원만 호출 가능.
--    "의견" = 유형을 골랐거나 운영자에게만 보낸 메시지(일반 잡담 제외), 관리자 본인 글 제외.
-- 2) feedback_messages.announcement_id — 반영 공지를 등록하면 채팅에도 운영자 메시지로
--    "반영됐어요" 카드를 자동으로 올린다(이 값이 있으면 채팅이 공지 카드로 렌더링).
-- 3) users.updates_seen_at — 사이드바 피드백 아이콘의 "새 소식" 점/홈 배너 판정.
--    기존 회원은 마이그레이션 시점으로 초기화(과거 공지로 점이 뜨지 않게).

alter table feedback_messages
  add column announcement_id uuid references announcements(id) on delete cascade;

alter table users add column updates_seen_at timestamptz not null default now();

create or replace function public.feedback_stats()
returns table (
  received           integer,
  reviewing          integer,
  done               integer,
  done_this_month    integer,
  avg_response_hours numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with fb as (
    select f.*
    from feedback_messages f
    join users u on u.id = f.user_id
    where (f.category is not null or f.is_private)
      and u.role <> 'admin'
      and f.announcement_id is null
  )
  select
    count(*)::int,
    count(*) filter (where status = 'reviewing')::int,
    count(*) filter (where status = 'done')::int,
    count(*) filter (
      where status = 'done'
        and admin_updated_at >= date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'
    )::int,
    round(
      (avg(extract(epoch from (admin_updated_at - created_at))) filter (
        where admin_updated_at is not null and created_at > now() - interval '90 days'
      ) / 3600)::numeric,
      1
    )
  from fb
  where is_approved(auth.uid());
$$;

revoke all on function public.feedback_stats() from public;
grant execute on function public.feedback_stats() to authenticated;

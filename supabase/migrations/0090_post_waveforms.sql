-- 게시물 파형 미리 계산(2026-09-26) — 예전엔 재생할 때마다 /api/media/waveform-proxy가 R2 원본 파일
-- 전체를 Vercel 함수로 받아 흘려보내고 브라우저가 디코딩해 파형을 그렸다. 곡 하나(평균 7~8MB, 영상은
-- 100MB 이상)가 재생마다 Vercel Fast Origin Transfer(Hobby 월 10GB)를 통째로 써서 회원 수십 명이면
-- 한도에 닿는 구조였다. 이제 업로드할 때 로컬 파일로 한 번 계산해 여기 저장하고, 재생 화면은 이걸 읽는다.
-- posts에 컬럼으로 두지 않은 건 posts를 select * 하는 곳마다 1KB씩 딸려가지 않게 하려고.
-- bars: 0~100 정수 200개(src/lib/waveform.ts STORED_WAVEFORM_BARS) — 화면마다 필요한 막대 수로 줄여 쓴다.
create table if not exists public.post_waveforms (
  post_id uuid primary key references public.posts(id) on delete cascade,
  bars smallint[] not null,
  created_at timestamptz not null default now(),
  constraint post_waveforms_bars_shape check (
    array_ndims(bars) = 1 and array_length(bars, 1) = 200 and 0 <= all(bars) and 100 >= all(bars)
  )
);

alter table public.post_waveforms enable row level security;

-- 읽기는 그 게시물을 볼 수 있는 사람이면 누구나(posts RLS를 그대로 따름 — 게스트도 전체공개 글은 읽힘).
drop policy if exists post_waveforms_select on public.post_waveforms;
create policy post_waveforms_select on public.post_waveforms
  for select using (exists (select 1 from public.posts p where p.id = post_id));

-- 쓰기는 업로드 직후 작성자 본인만(업로드 화면이 insert).
drop policy if exists post_waveforms_insert_own on public.post_waveforms;
create policy post_waveforms_insert_own on public.post_waveforms
  for insert with check (
    exists (select 1 from public.posts p where p.id = post_id and p.user_id = (select auth.uid()))
  );

-- 업로드 때 계산에 실패한 음원(브라우저가 디코딩 못 한 경우 등)은 처음 재생한 회원의 브라우저가 예전
-- 방식(프록시)으로 한 번 계산해 여기 채운다 — 이미 있으면 아무것도 안 함. 영상은 파일이 커서 대상 아님.
create or replace function public.save_post_waveform(p_post_id uuid, p_bars smallint[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;
  if not can_access_post_content(p_post_id, uid) then
    return;
  end if;
  insert into post_waveforms (post_id, bars)
  select p.id, p_bars from posts p where p.id = p_post_id and p.media_type = 'audio'
  on conflict (post_id) do nothing;
end;
$$;

revoke all on function public.save_post_waveform(uuid, smallint[]) from public, anon;
grant execute on function public.save_post_waveform(uuid, smallint[]) to authenticated;

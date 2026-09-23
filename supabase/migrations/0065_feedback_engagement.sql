-- 피드백 참여 유도(2026-09 피드백 창구 분석 P2).
--   1) "나도 👍" — 공개 피드백에 동의 표시. 같은 불만이 반복 글로 흩어지지 않고 한 곳에 모여
--      운영자가 우선순위를 볼 수 있게 한다. 비공개 피드백·본인 피드백엔 못 누른다.
--   2) 스크린샷 첨부 — 버그는 말보다 화면 한 장이 빠르다. private 버킷 feedback-images,
--      경로는 `${user_id}/${uuid}.${ext}`. 피드백 메시지를 볼 수 있는 사람만 이미지도 볼 수 있다.
--   3) 짧은 설문(feedback_pulses) — 특정 시점(트랙을 올려본 뒤 / 가입 7일째)에 이모지 한 번
--      탭 + 선택 한 줄. score null = "다음에" 로 닫음(다시 묻지 않기 위한 기록).

-- ── 1) 나도 👍 ─────────────────────────────────────────────
create table feedback_reactions (
  feedback_id uuid not null references feedback_messages(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (feedback_id, user_id)
);

alter table feedback_reactions enable row level security;

-- 볼 수 있는 피드백(feedback_messages RLS를 그대로 따름)의 반응만 보인다.
create policy "feedback_reactions_select_visible"
  on feedback_reactions for select
  using (
    is_approved(auth.uid())
    and exists (select 1 from feedback_messages f where f.id = feedback_id)
  );

create policy "feedback_reactions_insert_self_public_others"
  on feedback_reactions for insert
  with check (
    user_id = auth.uid()
    and is_approved(auth.uid())
    and exists (
      select 1 from feedback_messages f
      where f.id = feedback_id and not f.is_private and f.user_id <> auth.uid()
    )
  );

create policy "feedback_reactions_delete_self"
  on feedback_reactions for delete
  using (user_id = auth.uid());

alter publication supabase_realtime add table feedback_reactions;

-- ── 2) 스크린샷 첨부 ──────────────────────────────────────
alter table feedback_messages add column image_path text;

-- 이미지만 보내는 경우도 허용(내용 비어도 이미지가 있으면 OK).
alter table feedback_messages drop constraint feedback_messages_content_check;
alter table feedback_messages add constraint feedback_messages_content_check
  check (char_length(content) <= 2000 and (char_length(content) >= 1 or image_path is not null));

-- 남의 이미지 경로를 끼워 넣어 열람 권한을 얻지 못하게, image_path는 본인 폴더만.
drop policy "feedback_messages_insert_self" on feedback_messages;
create policy "feedback_messages_insert_self"
  on feedback_messages for insert
  with check (
    user_id = auth.uid()
    and is_approved(auth.uid())
    and (image_path is null or split_part(image_path, '/', 1) = auth.uid()::text)
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-images', 'feedback-images', false, 5242880,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "feedback_images_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'feedback-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and is_approved(auth.uid())
  );

-- 본인 업로드분 + 그 이미지가 달린 피드백을 볼 수 있는 사람(비공개면 작성자·관리자만).
create policy "feedback_images_select_visible"
  on storage.objects for select
  using (
    bucket_id = 'feedback-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or is_admin(auth.uid())
      or exists (select 1 from public.feedback_messages f where f.image_path = storage.objects.name)
    )
  );

-- ── 3) 짧은 설문 ─────────────────────────────────────────
create table feedback_pulses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  trigger    text not null check (trigger in ('upload', 'day7')),
  score      smallint check (score between 1 and 4),
  comment    text check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  unique (user_id, trigger)
);

create index idx_feedback_pulses_user_created on feedback_pulses (user_id, created_at desc);

alter table feedback_pulses enable row level security;

create policy "feedback_pulses_select_own_or_admin"
  on feedback_pulses for select
  using (user_id = auth.uid() or is_admin(auth.uid()));

create policy "feedback_pulses_insert_self"
  on feedback_pulses for insert
  with check (user_id = auth.uid() and is_approved(auth.uid()));

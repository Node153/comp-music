-- 영상 업로드(FEED-01)용 private 스토리지 버킷.
-- 파일 경로는 `${user_id}/${filename}` 규칙을 따른다 (verification-documents와 동일 패턴).
-- Phase 0 visibility는 public 고정이지만, 미승인 사용자 완전 차단(0-1)을 스토리지 레벨에서도
-- 강제하기 위해 select는 is_approved(auth.uid())로 제한한다.

insert into storage.buckets (id, name, public)
values ('posts', 'posts', false)
on conflict (id) do nothing;

create policy "posts_bucket_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'posts'
    and (storage.foldername(name))[1] = auth.uid()::text
    and is_approved(auth.uid())
  );

create policy "posts_bucket_select_approved"
  on storage.objects for select
  using (
    bucket_id = 'posts'
    and is_approved(auth.uid())
  );

create policy "posts_bucket_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'posts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

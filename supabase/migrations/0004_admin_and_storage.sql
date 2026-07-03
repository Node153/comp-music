-- 관리자 심사 처리(AUTH-04/06, ADMIN-01/02)에 필요한 RLS 확장 + 인증서류 스토리지 버킷.

create or replace function is_admin(uid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from users where id = uid and role = 'admin'
  );
$$;

-- 관리자는 모든 심사 건을 조회/처리할 수 있어야 함 (기존 self 정책과 OR로 합쳐짐)
create policy "verifications_select_admin"
  on verifications for select
  using (is_admin(auth.uid()));

create policy "verifications_update_admin"
  on verifications for update
  using (is_admin(auth.uid()));

-- 관리자는 심사 처리 시 사용자 status를 승인/반려로 갱신해야 함
create policy "users_update_admin"
  on users for update
  using (is_admin(auth.uid()));

-- 인증서류 저장용 private 버킷. 파일 경로는 `${user_id}/${filename}` 규칙을 따른다.
-- 0-4: 승인/반려 확정 후 90일 파기는 Phase 1에서 스케줄 작업으로 구현 예정, 버킷 자체는 Phase 0부터 필요.
insert into storage.buckets (id, name, public)
values ('verification-documents', 'verification-documents', false)
on conflict (id) do nothing;

create policy "verification_documents_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'verification-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "verification_documents_select_own_or_admin"
  on storage.objects for select
  using (
    bucket_id = 'verification-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin(auth.uid()))
  );

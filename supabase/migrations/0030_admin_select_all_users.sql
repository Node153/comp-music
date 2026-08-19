-- 버그 수정: 관리자가 대기/반려 상태 회원을 조회할 수 있는 RLS 정책이 없었음.
-- users_select_self_or_approved_peers(0002)는 "본인" 또는 "승인된 상대"만 허용해서, 관리자가
-- /admin/members에서 대기 중인 신규 가입자를 목록에서 아예 못 보는 버그가 있었다(실사용자
-- 리포트로 발견 — "회원관리에서 안뜨는데?"). users_update_admin(UPDATE, 0004)은 이미 있었는데
-- 대응하는 SELECT 정책이 빠져있었던 것 — 예전 /admin/verifications 화면에서도 신청자 이름이
-- "-"로 나왔을 텐데(RLS에 막혀 null) 서류 자체는 verifications_select_admin으로 보였어서
-- 못 알아챈 것으로 보인다.
create policy "users_select_admin"
  on users for select
  using (is_admin(auth.uid()));

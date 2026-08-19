// 임시 기능 플래그 — 2026-08-19, 사용자 요청으로 서류 심사를 잠깐 끔("추후에 진행할 것").
// verify/documents/page.tsx와 status/page.tsx 양쪽이 같은 값을 봐야 서로 어긋나지 않아서
// 한 곳에 모아둔다. 나중에 서류 심사를 다시 켤 땐 이 값만 true로 바꾸면 된다.
//
// true일 때: 서류 업로드 필수, verifications 행 생성, /admin/verifications에서 서류 보고 심사.
// false일 때: 서류 없이 프로필 정보만 받고 pending 상태로 남김 → 관리자가 /admin/members에서
// 서류 없이 바로 승인/반려(MemberStatusActions.tsx).
export const DOCUMENT_VERIFICATION_ENABLED = false;

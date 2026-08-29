// 임시 기능 플래그 — 2026-08-19, 사용자 요청으로 서류 심사를 잠깐 끔("추후에 진행할 것").
// verify/documents/page.tsx와 status/page.tsx 양쪽이 같은 값을 봐야 서로 어긋나지 않아서
// 한 곳에 모아둔다. 나중에 서류 심사를 다시 켤 땐 이 값만 true로 바꾸면 된다.
//
// true일 때: 서류 업로드 필수, verifications 행 생성, /admin/verifications에서 서류 보고 심사.
// false일 때: 서류 없이 프로필 정보만 받고 pending 상태로 남김 → 관리자가 /admin/members에서
// 서류 없이 바로 승인/반려(MemberStatusActions.tsx).
export const DOCUMENT_VERIFICATION_ENABLED = false;

// Kakao 로그인 버튼 숨김 — 2026-08-20, 사용자 요청("추후 사업자 등록하고 나서 넣을게").
// Kakao 앱이 사업자 인증 전이라 "카카오계정(이메일)" 동의항목 자체를 쓸 권한이 없어서(앱
// 레벨 제한, 유저 동의 여부와 무관), 지금은 닉네임만 받는 상태로 우회해뒀었는데(SocialLoginButtons.tsx
// SCOPES.kakao) 이메일 없는 가입 자체가 완전히 검증되지 않아 아예 버튼을 숨기기로 함.
// SocialLoginButtons.tsx가 이 값을 보고 목록에서 kakao만 제외한다 — 사업자 등록 후 true로
// 바꾸면 버튼과 이메일 스코프 요청 로직 전부 그대로 부활.
export const KAKAO_LOGIN_ENABLED = false;

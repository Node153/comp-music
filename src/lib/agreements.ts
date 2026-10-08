// 가입 동의 8종의 현재 버전(= 각 문서·문구의 시행일). 가입할 때 agreements 테이블에 이 값으로 남아
// "누가 어떤 버전에 동의했는지"를 구분한다. 약관 문서 화면(/terms 등)의 시행일자도 여기서 읽는다.
// - 소셜 가입: onboarding/page.tsx가 signupAgreementRows()를 그대로 insert한다.
// - 이메일 가입: 가입 시점엔 세션이 없어서 DB 트리거 handle_new_user()가 같은 값을 직접 넣는다.
// ⚠️ 여기 값을 바꾸면 트리거의 같은 값도 바꾸는 마이그레이션을 반드시 같이 만들 것(최신: 0093 —
//    함수를 통째로 다시 쓰지 말고 0092/0093처럼 버전 문자열만 바꿔 끼우는 방식으로).
// ⚠️ 문구·문서 내용을 바꿀 때만 해당 항목의 버전을 올린다. 기존 회원에게는 시행 7일 전(불리한 변경은
//    30일 전) 공지가 필요하다(이용약관 제3조).
export const AGREEMENT_VERSIONS = {
  content_rights: "2026-08-10",
  collab_disclaimer: "2026-10-08",
  license_grant: "2026-08-10",
  terms_of_service: "2026-10-15",
  privacy_policy: "2026-10-15",
  community_guidelines: "2026-10-15",
  age_over_14: "2026-08-29",
  beta_notice: "2026-10-15",
} as const;

export type AgreementType = keyof typeof AGREEMENT_VERSIONS;

export function signupAgreementRows(userId: string) {
  return (Object.keys(AGREEMENT_VERSIONS) as AgreementType[]).map((type) => ({
    user_id: userId,
    type,
    version: AGREEMENT_VERSIONS[type],
  }));
}

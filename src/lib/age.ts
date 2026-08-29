// 가입 연령 제한(만 14세, 2026-08-20 — 커뮤니티 운영정책/community-guidelines 신설과 함께
// 추가) — 자기신고 체크박스 대신 실제로 이미 받고 있는 생년월일(0031, 동명이인 판별용으로
// 도입)로 직접 검증한다. 체크박스형 "만 14세 이상입니다" 자기신고보다 이게 더 정확하고,
// 입력한 생년월일과 모순되는 별도 체크박스를 하나 더 만들 이유가 없다.
export const MIN_SIGNUP_AGE = 14;

export function isOldEnough(birthDateStr: string, minAge: number = MIN_SIGNUP_AGE): boolean {
  const birth = new Date(birthDateStr);
  if (Number.isNaN(birth.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= minAge;
}

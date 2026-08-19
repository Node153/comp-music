// 비밀번호 정책 — 회원가입(signup)과 비밀번호 재설정(reset-password) 양쪽에서 동일하게 써야
// 한다. 정책이 서로 다르면 재설정 쪽으로 우회해서 약한 비밀번호를 설정할 수 있어서 한 곳에
// 모아둔다. 10자 이상 + 특수문자(영문/숫자 아닌 문자) 최소 1개.
const SPECIAL_CHAR_PATTERN = /[^A-Za-z0-9]/;
export const PASSWORD_MIN_LENGTH = 10;

export function isValidPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && SPECIAL_CHAR_PATTERN.test(password);
}

export const PASSWORD_POLICY_MESSAGE = `비밀번호는 특수문자를 포함해 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`;
export const PASSWORD_MISMATCH_MESSAGE = "비밀번호가 일치하지 않습니다.";

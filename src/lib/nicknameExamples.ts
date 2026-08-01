// 닉네임 입력란 placeholder용 예시(0018) — 가입 폼과 프로필 수정에서 랜덤으로 하나 보여준다.
// 0018 마이그레이션의 기존 유저 백필 닉네임도 같은 목록 기반(순서·내용 맞출 것).
export const NICKNAME_EXAMPLES = [
  "좋은음악앞에서침묵",
  "좋은음악앞에서말실수",
  "좋은음악앞에서뒤도돌아보지않음",
  "비트반응함",
  "귀가열림",
  "명곡탐지견",
  "음악 좋으면 벽 봄",
  "음악 좋으면 갑자기 진지함",
  "음악 좋으면 매미됨",
];

export function randomNicknameExample(): string {
  return NICKNAME_EXAMPLES[Math.floor(Math.random() * NICKNAME_EXAMPLES.length)];
}

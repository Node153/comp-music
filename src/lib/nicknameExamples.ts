// 닉네임 추천 문구는 이제 nickname_phrases 테이블에서 관리한다(관리자가 /admin/nickname-phrases
// 에서 편집). 아래 배열은 DB를 아직 못 읽었을 때의 fallback — 가입/온보딩/프로필수정 화면이
// useNicknamePhrases 훅으로 DB 목록을 받아 그중 하나를 무작위로 추천한다.
//
// 참고: 0018_nickname_and_display_name.sql의 백필 SQL은 그 시점 문구 9개를 SQL 안에 그대로
// 박아둔 것이라 이 목록/테이블을 바꿔도 이미 적용된 그 마이그레이션엔 영향 없다.
// nickname_tag(4자리 유일값, 0038)는 서버(handle_new_user 트리거)가 배정하므로 여기 없다.

export const NICKNAME_FALLBACK = [
  "좋은음악앞에서침묵",
  "좋은음악앞에서말실수",
  "좋은음악앞에서뒤도돌아보지않음",
  "비트반응함",
  "귀가열림",
  "명곡탐지견",
  "음악좋으면벽봄",
  "음악좋으면갑자기진지함",
  "음악좋으면매미됨",
];

// 닉네임 띄어쓰기 금지(2026-08-20) — 자동생성 문구뿐 아니라 사용자가 직접 입력하는 경우도
// 막아야 해서 signup/onboarding/NicknameForm 제출 시 공용으로 검사한다.
export function hasWhitespace(nickname: string): boolean {
  return /\s/.test(nickname);
}

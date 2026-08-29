// 배달의민족 가입 화면 참고 — 재밌는 닉네임 후보를 자동으로 만들어서 입력칸에 채워주고,
// 마음에 안 들면 다시 뽑을 수 있게 한다("고르는 건 유저의 몫").
//
// 추천 후보를 원래 9개(0018 마이그레이션 백필 때 쓰던 것과 동일한 목록)로 다시 좁혔다
// (2026-08-20, 사용자 요청) — 한동안 템플릿 조합으로 35개까지 늘렸었는데, 그 방향을
// 되돌려서 이 고정된 9개 문구 안에서만 무작위로 추천한다.
//
// 익명성 강화(2026-08-20): 여러 사람이 같은 문구를 써도 되게(오히려 익명 커뮤니티 느낌에
// 도움) nickname의 유니크 제약을 없앴다. 대신 "회원별 절대 유일" 요구는 별도 컬럼
// nickname_tag(4자리, 0038)로 옮겼는데, 이건 가입 시점에 서버(handle_new_user 트리거)가
// 직접 배정하고 클라이언트는 절대 관여하지 않는다 — 그래서 이 파일엔 태그 생성 로직이 없다
// (가입 화면에 노출될 수가 없게 만드는 핵심 포인트).
//
// 주의: 0018_nickname_and_display_name.sql의 백필 SQL은 그 시점 문구 9개를 SQL 안에
// 그대로 박아둔 것이라 여기 목록을 바꿔도 이미 적용된 그 마이그레이션엔 영향 없다.

const NICKNAME_PHRASES = [
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

function randomPhrase(): string {
  return NICKNAME_PHRASES[Math.floor(Math.random() * NICKNAME_PHRASES.length)];
}

// 입력창 placeholder(예시 문구)용.
export function randomNicknameExample(): string {
  return randomPhrase();
}

// 가입 폼 자동 채움용 — nickname_tag(0038)가 유니크를 보장하므로 여기선 그냥 문구 하나만
// 뽑으면 된다(중복 문구 허용, 서버가 알아서 유일한 태그를 붙여줌).
export function generateNicknameCandidate(): string {
  return randomPhrase();
}

// 닉네임 띄어쓰기 금지(2026-08-20) — 자동생성 문구뿐 아니라 사용자가 직접 입력하는 경우도
// 막아야 해서 signup/onboarding/NicknameForm 제출 시 공용으로 검사한다.
export function hasWhitespace(nickname: string): boolean {
  return /\s/.test(nickname);
}

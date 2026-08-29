// 배달의민족 가입 화면 참고 — 재밌는 닉네임 후보를 자동으로 만들어서 입력칸에 채워주고,
// 마음에 안 들면 다시 뽑을 수 있게 한다("고르는 건 유저의 몫").
// 손으로 문구를 다 써두는 대신, 기존 9개 예시에 이미 있던 두 템플릿("좋은음악앞에서___",
// "음악좋으면___")의 반응 문구 뱅크를 늘려서 조합으로 다양성을 확보한다.
//
// 익명성 강화(2026-08-20, 사용자 요청): 여러 사람이 같은 문구를 써도 되게(오히려 익명
// 커뮤니티 느낌에 도움) nickname의 유니크 제약을 없앴다. 대신 "회원별 절대 유일" 요구는
// 별도 컬럼 nickname_tag(4자리, 0038)로 옮겼는데, 이건 가입 시점에 서버(handle_new_user
// 트리거)가 직접 배정하고 클라이언트는 절대 관여하지 않는다 — 그래서 이 파일엔 태그 생성
// 로직이 없다(가입 화면에 노출될 수가 없게 만드는 핵심 포인트).
//
// 주의: 0018_nickname_and_display_name.sql의 백필 SQL은 그 시점 문구 9개를 SQL 안에
// 그대로 박아둔 것이라 여기 목록을 바꿔도 이미 적용된 그 마이그레이션엔 영향 없다.

const TEMPLATE_A_PREFIX = "좋은음악앞에서";
const TEMPLATE_A_REACTIONS = [
  "침묵",
  "말실수",
  "뒤도돌아보지않음",
  "눈감음",
  "숨멈춤",
  "소름",
  "무장해제",
  "눈물참기",
  "시간정지",
  "넋놓음",
  "심장쿵",
  "고개끄덕",
  "발끝박자",
  "세상뒷전",
  "정신나감",
];

// 닉네임 띄어쓰기 금지(2026-08-20, 사용자 요청)로 프리픽스 끝 공백과 두 반응 문구의
// 내부 공백을 제거했다 — TEMPLATE_A/STANDALONE은 원래부터 공백이 없어서 안 건드림.
const TEMPLATE_B_PREFIX = "음악좋으면";
const TEMPLATE_B_REACTIONS = [
  "갑자기진지함",
  "매미됨",
  "벽봄",
  "눈물남",
  "목소리커짐",
  "어깨들썩임",
  "정색함",
  "눈빛변함",
  "대화끊김",
  "표정관리안됨",
  "소리지름",
  "넋나감",
];

const STANDALONE = [
  "비트반응함",
  "귀가열림",
  "명곡탐지견",
  "박자귀신",
  "리듬중독",
  "무한반복러",
  "음색감별사",
  "떼창유발자",
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPhrase(): string {
  const roll = Math.random();
  if (roll < 0.4) return TEMPLATE_A_PREFIX + randomFrom(TEMPLATE_A_REACTIONS);
  if (roll < 0.8) return TEMPLATE_B_PREFIX + randomFrom(TEMPLATE_B_REACTIONS);
  return randomFrom(STANDALONE);
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

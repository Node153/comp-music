// 배달의민족 가입 화면 참고 — 재밌는 닉네임 후보를 자동으로 만들어서 입력칸에 채워주고,
// 마음에 안 들면 다시 뽑을 수 있게 한다("고르는 건 유저의 몫").
// 손으로 문구를 다 써두는 대신, 기존 9개 예시에 이미 있던 두 템플릿("좋은음악앞에서___",
// "음악 좋으면 ___")의 반응 문구 뱅크를 늘려서 조합으로 다양성을 확보한다.
//
// 숫자 접미사(2026-08-20, 사용자 요청): DEMO에서 회원들이 적극적으로 활동하도록 익명성을
// 높이는 방향으로, 닉네임의 "문구" 부분은 여러 사람이 겹쳐 보여도 되게(오히려 익명 커뮤니티
// 느낌에 도움) 하고 뒤에 짧은 랜덤 숫자를 붙여 실제 문자열은 유니크하게 유지한다 — 검색/식별은
// 문제없이 되면서 "나만 이 닉네임"이라는 부담 없이 가볍게 쓰게 하려는 의도.
// (한때 번호가 "닉네임처럼 안 보인다"는 이유로 뺀 적 있었는데, 이번엔 반대 방향 요청이라
// 되돌림 — 0018 마이그레이션의 기존 유저 닉네임 백필(예시 문구 + id 앞 4자리)과 같은 원리.)
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

const TEMPLATE_B_PREFIX = "음악 좋으면 ";
const TEMPLATE_B_REACTIONS = [
  "갑자기 진지함",
  "매미됨",
  "벽 봄",
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

// 입력창 placeholder(예시 문구)용 — 숫자 없이 깔끔하게 하나만 보여준다(실제 값으로 안 쓰이므로
// 유니크할 필요 없음).
export function randomNicknameExample(): string {
  return randomPhrase();
}

// 가입 폼 자동 채움용 — 실제 값으로 쓰일 거라 유니크 보장이 필요해서 숫자 접미사를 붙인다.
export function generateNicknameCandidate(): string {
  const suffix = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `${randomPhrase()}_${suffix}`;
}

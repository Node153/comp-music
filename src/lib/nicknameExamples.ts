// 배달의민족 가입 화면 참고 — 재밌는 닉네임 후보를 자동으로 만들어서 입력칸에 채워주고,
// 마음에 안 들면 다시 뽑을 수 있게 한다("고르는 건 유저의 몫").
// 손으로 문구를 다 써두는 대신, 기존 9개 예시에 이미 있던 두 템플릿("좋은음악앞에서___",
// "음악 좋으면 ___")의 반응 문구 뱅크를 늘려서 조합으로 다양성을 확보한다.
// 겹침 방지는 짧은 랜덤 숫자 접미사로 해결 — 0018 마이그레이션의 기존 유저 닉네임 백필
// (예시 문구 + id 앞 4자리)과 같은 원리.
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

// 입력창 placeholder(예시 문구)용 — 숫자 없이 깔끔하게 하나만 보여준다.
export function randomNicknameExample(): string {
  return randomPhrase();
}

// 가입 폼 자동 채움용. 예전엔 유니크 보장을 위해 숫자 접미사를 붙였는데, 번호가 붙으면
// 닉네임처럼 안 보인다는 피드백으로 뺐다 — 중복 시엔 signup/onboarding 양쪽에서 이미
// "이미 사용 중인 닉네임" 에러로 안내하고 🎲로 다시 뽑거나 직접 수정하게 되어 있어 안전하다.
export function generateNicknameCandidate(): string {
  return randomPhrase();
}

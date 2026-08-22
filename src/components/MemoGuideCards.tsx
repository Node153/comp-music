// memo(Complex) 탭 소개 카드 — DEMO는 남의 게시물을 구경하는 것만으로 "이런 서비스구나"가
// 학습되지만, memo는 Companion끼리만 보여서 비로그인 방문자·막 가입한 유저는 텅 빈 화면(또는
// 잠금)만 보고 노크/재창작 스택/실시간 채팅 같은 기능을 전혀 알 수가 없다. 그래서 두 군데
// (비로그인 잠금 화면, 로그인했지만 Companion이 없어 피드가 비어있는 화면)에 이 카드를 대신
// 보여준다. 카피는 앱의 기존 목소리(닉네임 생성기의 위트있는 톤)에 맞춰 유머러스하게 잡았고,
// 아이콘은 작게·카피는 크게·설명은 흐리게 둬서 카피가 먼저 읽히게 했다.
// 아이콘은 지금은 Tabler류 라인아이콘이고, 나중에 디자이너가 그린 손그림 아이콘으로 교체 예정.
const CARDS = [
  {
    icon: "🚪",
    headline: ["몰래 보기 없기,", "노크하고 보기"],
    sub: "비공개 게시물은 노크해야 볼 수 있어요",
  },
  {
    icon: "🗂️",
    headline: ["혼자 만들면 노잼,", "같이 만들면 꿀잼"],
    sub: "작업물을 주고받으며 곡을 함께 완성해요",
  },
  {
    icon: "💬",
    headline: ["채팅 켜고", "텐션 유지"],
    sub: "실시간으로 이야기하며 협업해요",
  },
];

export function MemoGuideCards() {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2 md:justify-center md:px-0">
      {CARDS.map((card) => (
        <div
          key={card.headline.join()}
          className="flex w-[168px] shrink-0 flex-col items-center gap-2.5 rounded-2xl border border-gray-200 px-4 pb-5 pt-6 text-center dark:border-gray-800"
        >
          <span className="text-lg" aria-hidden>
            {card.icon}
          </span>
          <p className="text-[15px] font-medium leading-snug text-gray-900 dark:text-gray-100">
            {card.headline.map((line, i) => (
              <span key={i}>
                {line}
                {i < card.headline.length - 1 && <br />}
              </span>
            ))}
          </p>
          <p className="text-[11px] leading-tight text-gray-400 opacity-70 dark:text-gray-600">{card.sub}</p>
        </div>
      ))}
    </div>
  );
}

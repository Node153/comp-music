"use client";

// DEMO 피드 최상단 — 열자마자 게시물이 바로 안 보이도록 화면 한 판을 비워 힐링 멘트를
// 가운데 띄운다(사용자 요청). 자동 로테이션은 없고, DEMO 탭에 들어올 때마다(= 이 컴포넌트가
// 새로 마운트될 때마다) 문구를 랜덤으로 하나 골라 페이드인한다.
// 문구는 feed_hero_messages 테이블에서 서버가 읽어 prop으로 넘겨준다(관리자가 /admin/feed-hero
// 에서 편집). DB가 비어 있으면 아래 기본 문구를 쓴다.
import { useEffect, useState } from "react";

export type HeroMessage = { q: string; a: string };

const FALLBACK_MESSAGES: HeroMessage[] = [
  {
    q: "당신은 어떤 사람인가요?",
    a: "당신은 음악이라는, 인간이 할 수 있는 가장 가치 있는 일을 하고 있어요.",
  },
  {
    q: "요즘 마음이 좀 지치셨나요?",
    a: "그래도 계속 만들고 있다는 것, 그것만으로 이미 충분히 잘하고 있어요.",
  },
];

export function FeedHero({ messages }: { messages?: HeroMessage[] }) {
  const list = messages && messages.length > 0 ? messages : FALLBACK_MESSAGES;

  // 서버 렌더와 첫 클라이언트 렌더는 동일하게(idx 0, 투명). 마운트 후 랜덤으로 골라
  // 페이드인 — 문구가 0번에서 랜덤으로 "바뀌는" 게 안 보이고 바로 랜덤 문구가 뜬다.
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // 하이드레이션 불일치를 피하려면 랜덤 선택은 마운트 후에만 — setState-in-effect가
    // 이 경우엔 의도된 패턴이다(서버/첫 렌더는 고정, 클라이언트에서만 랜덤).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdx(Math.floor(Math.random() * list.length));
    setShown(true);
  }, [list.length]);

  const m = list[Math.min(idx, list.length - 1)];

  return (
    <section className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div className={`transition-opacity duration-700 ease-in-out ${shown ? "opacity-100" : "opacity-0"}`}>
        <p className="text-lg font-semibold leading-snug text-gray-900 dark:text-gray-100 md:text-2xl">
          {m.q}
        </p>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-gray-500 dark:text-gray-400 md:max-w-md md:text-base">
          {m.a}
        </p>
      </div>
      <span className="mt-4 text-xs text-gray-300 dark:text-gray-600">아래로 내리면 오늘의 작업들이 있어요 ↓</span>
    </section>
  );
}

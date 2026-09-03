"use client";

// DEMO 피드 최상단 — 열자마자 게시물이 바로 안 보이도록 화면 한 판을 비워 힐링 멘트를
// 가운데 띄운다(사용자 요청). 자동 로테이션은 없고, DEMO 탭에 들어올 때마다(= 이 컴포넌트가
// 새로 마운트될 때마다) 문구를 랜덤으로 하나 골라 페이드인한다.
import { useEffect, useState } from "react";

const MESSAGES: { q: string; a: string }[] = [
  {
    q: "당신은 어떤 사람인가요?",
    a: "당신은 음악이라는, 인간이 할 수 있는 가장 가치 있는 일을 하고 있어요.",
  },
  {
    q: "오늘은 어떤 소리를 들으셨나요?",
    a: "그 소리를 붙잡아 곡으로 남기는 건 아무나 하는 일이 아니에요.",
  },
  {
    q: "요즘 마음이 좀 지치셨나요?",
    a: "그래도 계속 만들고 있다는 것, 그것만으로 이미 충분히 잘하고 있어요.",
  },
  {
    q: "왜 음악을 시작했는지 기억나세요?",
    a: "그때의 마음은 지금도 당신 안에 그대로 있어요.",
  },
  {
    q: "아직 완성하지 못한 곡이 마음에 걸리나요?",
    a: "미완성인 채로도 그건 당신이 지나온 시간의 흔적이에요.",
  },
  {
    q: "아무도 안 들어주는 것 같은 날인가요?",
    a: "당신이 만든 소리는 어딘가에 분명히 가닿아 있어요.",
  },
  {
    q: "잘하고 있는 걸까, 자꾸 묻게 되나요?",
    a: "만드는 사람은 늘 그렇게 물어요. 그게 진심이라는 증거예요.",
  },
];

export function FeedHero() {
  // 서버 렌더와 첫 클라이언트 렌더는 동일하게(idx 0, 투명). 마운트 후 랜덤으로 골라
  // 페이드인 — 문구가 0번에서 랜덤으로 "바뀌는" 게 안 보이고 바로 랜덤 문구가 뜬다.
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    setIdx(Math.floor(Math.random() * MESSAGES.length));
    setShown(true);
  }, []);

  const m = MESSAGES[idx];

  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 py-16 text-center">
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

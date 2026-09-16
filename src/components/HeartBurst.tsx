"use client";

// 더블탭 좋아요 시 미디어 중앙에 하트가 잠깐 커졌다 사라지는 연출(인스타그램 참고).
// 이미 좋아요 상태에서 다시 더블탭해도(DB 호출은 안 가지만) 매번 애니메이션이 새로
// 재생돼야 해서 key를 계속 바꿔 강제로 다시 마운트한다. 호출부가 relative 컨테이너
// 안에 element를 넣어주면 absolute inset-0으로 그 위에 겹쳐진다.
import { useState } from "react";
import { HeartIcon } from "@/components/icons";

export function useHeartBurst() {
  const [popKey, setPopKey] = useState<number | null>(null);
  const burst = () => setPopKey((k) => (k ?? 0) + 1);

  const element =
    popKey !== null ? (
      <span
        key={popKey}
        onAnimationEnd={() => setPopKey(null)}
        className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
      >
        <HeartIcon
          filled
          className="h-20 w-20 text-white animate-heart-pop drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
        />
      </span>
    ) : null;

  return { burst, element };
}

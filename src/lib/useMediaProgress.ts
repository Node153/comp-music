"use client";

// timeupdate 이벤트만으로 재생 위치를 갱신하면 초당 몇 번밖에 안 들어와서, 화면(막대/
// 플레이헤드)이 넓을수록 한 번의 갱신이 더 많은 픽셀 이동으로 보여 뚝뚝 끊겨 보인다 —
// 재생 중엔 requestAnimationFrame으로 매 프레임 직접 읽어와서 화면 폭과 무관하게 항상
// 부드럽게 움직이게 한다. 정지 상태에서의 탐색(seek)은 여전히 onTimeUpdate가 잡아준다.
import { useEffect, useRef, useState } from "react";

export function useMediaProgress<T extends HTMLMediaElement>(mediaRef: React.RefObject<T | null>, isPlaying: boolean) {
  const [currentTime, setCurrentTime] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) return;
    function tick() {
      const media = mediaRef.current;
      if (media) setCurrentTime(media.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, mediaRef]);

  return [currentTime, setCurrentTime] as const;
}

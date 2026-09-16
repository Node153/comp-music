"use client";

// PC 마우스 클릭이든 모바일 터치든 브라우저에서는 결국 하나의 click 이벤트로 들어오기
// 때문에, 두 번의 클릭이 delay 안에 들어오면 더블탭/더블클릭으로 같이 처리한다(인스타그램
// 웹과 동일한 방식) — PC/모바일용 로직을 따로 둘 필요가 없다.
// 첫 클릭은 onSingleTap을 delay만큼 미뤘다가 실행하고, 그 안에 두 번째 클릭이 들어오면
// 미뤄둔 실행을 취소하고 onDoubleTap만 실행한다.
import { useCallback, useEffect, useRef } from "react";

export function useDoubleTap(onSingleTap: (() => void) | undefined, onDoubleTap: () => void, delay = 300) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      onDoubleTap();
      return;
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      onSingleTap?.();
    }, delay);
  }, [onSingleTap, onDoubleTap, delay]);
}

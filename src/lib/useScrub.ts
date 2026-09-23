"use client";

// 파형 탐색 바의 "누른 채 드래그" 스크러빙(2026-09-23, 사용자 요청 — 모바일에서 사운드바를
// 홀딩+드래그해도 반응이 없고 탭만 됐음). 기존엔 onClick만 달려 있어서 드래그는 무시됐다.
// 포인터 이벤트 + setPointerCapture로 손가락이 바 밖으로 벗어나도 계속 따라가게 하고,
// 드래그 중엔 scrubRatio로 플레이헤드·재생 구간·시간 표시만 미리 움직였다가 손을 뗄 때
// 한 번만 실제로 탐색(onCommit)한다 — 드래그 내내 currentTime을 바꾸면 모바일에서 끊김이 심함.
// 스크롤과의 충돌은 바 요소의 touch-action으로 막는다(호출하는 쪽에서 지정).
import { useState } from "react";

function ratioAt(el: HTMLElement, clientX: number) {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0) return 0;
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
}

export function useScrub(onCommit: (ratio: number) => void) {
  const [scrubRatio, setScrubRatio] = useState<number | null>(null);

  const scrubHandlers = {
    onPointerDown(e: React.PointerEvent<HTMLElement>) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setScrubRatio(ratioAt(e.currentTarget, e.clientX));
    },
    onPointerMove(e: React.PointerEvent<HTMLElement>) {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      setScrubRatio(ratioAt(e.currentTarget, e.clientX));
    },
    onPointerUp(e: React.PointerEvent<HTMLElement>) {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const ratio = ratioAt(e.currentTarget, e.clientX);
      setScrubRatio(null);
      onCommit(ratio);
    },
    // 세로 스크롤로 넘어가는 등 브라우저가 제스처를 가져가면 탐색 없이 취소
    onPointerCancel() {
      setScrubRatio(null);
    },
  };

  return { scrubRatio, scrubHandlers };
}

"use client";

// DEMO 공유(0076) — PEAK 진행 알림("친구에게 들려주면 더 빨리 닿아요")의 행동 버튼이자 외부 유입
// 경로. 모바일은 OS 공유 시트(카카오톡 등), 데스크톱은 링크 복사. 비로그인도 /feed는 열리고
// DEMO는 공개라 링크를 받은 사람이 바로 들을 수 있다(미리보기 30초, GUEST_PREVIEW_SECONDS).
// 링크의 post=는 피드 첫 페이지 맨 위에 그 게시물을 고정해 보여주게 한다(feed/page.tsx) — 피드가
// 맞춤 정렬 + 10개씩이라 #id만으로는 그 글이 첫 페이지에 없으면 이동하지 못했다.
// (인스타 스토리 공유는 2026-09-25 사용자 결정으로 제거 — 웹에선 스토리 편집기 직행이 불가능.)
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LinkIcon } from "@/components/icons";
import { track } from "@/lib/analytics";

export function ShareButton({ postId, title }: { postId: string; title: string }) {
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  // src는 이용 통계(0079)의 유입 태그 — 이 링크로 들어온 방문을 공유 경로별로 센다(도착하면 주소창에서 지워짐).
  const url = (src: "share_copy" | "share_native") =>
    `${window.location.origin}/feed?feed=completion&post=${postId}&src=${src}#${postId}`;

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  }

  async function share() {
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title, text: `「${title}」 — Compmusic에서 들어보세요`, url: url("share_native") });
        track("share", { post: postId, props: { method: "native" } });
      } catch {
        // 공유 시트를 닫은 경우 등 — 복사로 넘어가지 않고 그냥 끝낸다.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url("share_copy"));
      track("share", { post: postId, props: { method: "copy" } });
      showToast("링크를 복사했어요");
    } catch {
      window.prompt("이 링크를 복사해서 공유하세요", url("share_copy"));
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={share}
        aria-label="공유"
        title="공유"
        className="relative inline-flex items-center text-gray-600 transition hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
      >
        <LinkIcon className="h-5 w-5" />
      </button>
      {toast &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[95] flex justify-center px-4">
            <span className="rounded-full bg-black px-4 py-2 text-center text-xs font-medium text-white shadow-lg">
              {toast}
            </span>
          </div>,
          document.body,
        )}
    </>
  );
}

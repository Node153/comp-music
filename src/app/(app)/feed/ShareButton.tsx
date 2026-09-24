"use client";

// DEMO 공유(0076) — PEAK 진행 알림("친구에게 들려주면 더 빨리 닿아요")의 행동 버튼이자 외부 유입
// 경로. 모바일은 OS 공유 시트(카카오톡 등), 데스크톱은 링크 복사. 비로그인도 /feed는 열리고
// DEMO는 공개라 링크를 받은 사람이 바로 들을 수 있다(미리보기 30초, GUEST_PREVIEW_SECONDS).
import { useState } from "react";
import { LinkIcon } from "@/components/icons";

export function ShareButton({ postId, title }: { postId: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/feed?feed=completion#${postId}`;
    const text = `「${title}」 — Compmusic에서 들어보세요`;
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // 공유 시트를 닫은 경우 등 — 아래 복사로 넘어가지 않고 그냥 끝낸다.
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("이 링크를 복사해서 공유하세요", url);
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label="공유"
      title="공유"
      className="relative inline-flex items-center text-gray-600 transition hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
    >
      <LinkIcon className="h-5 w-5" />
      {copied && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black px-2.5 py-1 text-xs font-medium text-white">
          링크를 복사했어요
        </span>
      )}
    </button>
  );
}

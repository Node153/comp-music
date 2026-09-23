"use client";

// 게시물 아이콘 행 아래 "A, B 외 N명이 Kick했어요" 줄(0071) — 누가 Kick했는지는 공개
// (2026-09-24 사용자 결정). 인스타그램 "OO님 외 N명이 좋아합니다" 참고. DEMO는 닉네임만
// 보여주는 공간이라 이름은 post_kickers(nickname)에서 온다. 내 Kick은 "회원님"으로 표시.
import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePostEngagement } from "@/components/PostEngagementContext";
import { Avatar } from "@/components/Avatar";
import { KickIcon, XIcon } from "@/components/icons";

const VISIBLE_NAMES = 2;

export function KickersLine({ currentUserId, className = "" }: { currentUserId: string; className?: string }) {
  const { kickCount, kickers } = usePostEngagement();
  const [open, setOpen] = useState(false);

  if (kickCount <= 0 || kickers.length === 0) return null;

  const nameOf = (k: { id: string; name: string }) => (k.id === currentUserId ? "회원님" : k.name);
  const visible = kickers.slice(0, VISIBLE_NAMES);
  const rest = kickCount - visible.length;
  // "A, B님이" / "A, 회원님이"(이미 '님'으로 끝남) / "A 외 3명이"
  const lastIsMe = visible[visible.length - 1]?.id === currentUserId;

  return (
    <>
      <p className={`flex flex-wrap items-center gap-1 text-sm text-gray-600 dark:text-gray-300 ${className}`}>
        <KickIcon className="h-4 w-4 text-amber-500" filled />
        {visible.map((k, i) => (
          <span key={k.id}>
            <Link href={`/profile/${k.id}`} className="font-semibold text-gray-900 hover:underline dark:text-gray-100">
              {nameOf(k)}
            </Link>
            {i < visible.length - 1 && ","}
          </span>
        ))}
        {rest > 0 ? (
          <span>
            <button type="button" onClick={() => setOpen(true)} className="font-semibold text-gray-900 hover:underline dark:text-gray-100">
              외 {rest}명
            </button>
            이 Kick했어요
          </span>
        ) : (
          <span className="-ml-1">{lastIsMe ? "이 Kick했어요" : "님이 Kick했어요"}</span>
        )}
      </p>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-4 md:items-center"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Kick한 사람"
              className="flex max-h-[70vh] w-full max-w-sm flex-col rounded-2xl bg-white shadow-xl dark:bg-gray-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-800">
                <h2 className="flex items-center gap-1.5 text-base font-bold text-gray-900 dark:text-gray-100">
                  <KickIcon className="h-4 w-4 text-amber-500" filled />
                  Kick한 사람 {kickCount}
                </h2>
                <button type="button" onClick={() => setOpen(false)} aria-label="닫기" className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100">
                  <XIcon className="h-5 w-5" />
                </button>
              </div>
              <ul className="flex flex-col overflow-y-auto px-2 py-2">
                {kickers.map((k) => (
                  <li key={k.id}>
                    <Link
                      href={`/profile/${k.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800"
                    >
                      <Avatar userId={k.id} name={k.name} className="h-9 w-9 text-sm" />
                      {nameOf(k)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

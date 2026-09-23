"use client";

// Kick(0071, 2026-09-24 사용자 요청) — 좋아요의 상위 반응. 한 사람당 일주일에 한 번, 번복 불가.
// 되돌릴 수 없어서 누르면 바로 주지 않고 확인 팝업을 먼저 띄운다(사용자 요청 — 오입력 방지).
// 성공하면 좋아요도 같이 켜지고(DB give_kick이 likes에도 넣음) 카드 중앙에 "Kick!" 연출.
// 버튼 상태: 사용 가능(윤곽선) / 이 게시물에 Kick함(골드 채움, 잠김) / 이번 주 다른 곳에 사용함
// (흐리게, 누르면 다음 충전까지 남은 기간 안내) / 내 게시물(숫자만, 누를 수 없음).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePostEngagement } from "@/components/PostEngagementContext";
import { KickIcon } from "@/components/icons";
import { daysUntilNextKick } from "@/lib/feedConstants";
import {
  getMyWeeklyKickPostId,
  loadMyWeeklyKick,
  markMyWeeklyKick,
  useMyWeeklyKick,
} from "@/lib/useMyWeeklyKick";

type Dialog = "confirm" | "used" | null;

export function KickButton({
  postId,
  userId,
  isOwnPost,
  className = "",
}: {
  postId: string;
  userId: string;
  isOwnPost: boolean;
  className?: string;
}) {
  const {
    kickCount,
    kicked,
    liked,
    setKickCount,
    setKicked,
    setKickers,
    setLiked,
    setLikeCount,
    setWeeklyLikeCount,
    triggerKick,
  } = usePostEngagement();
  const { loaded, kickedPostId } = useMyWeeklyKick(userId);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedPostId, setUsedPostId] = useState<string | null>(null);

  const usedElsewhere = loaded && !kicked && kickedPostId !== null && kickedPostId !== postId;

  useEffect(() => {
    if (!dialog) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) setDialog(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, pending]);

  async function handleClick() {
    if (isOwnPost || kicked || pending) return;
    setError(null);
    await loadMyWeeklyKick(userId);
    const weeklyPostId = getMyWeeklyKickPostId(userId);
    if (weeklyPostId && weeklyPostId !== postId) {
      setUsedPostId(weeklyPostId);
      setDialog("used");
      return;
    }
    setDialog("confirm");
  }

  async function confirmKick() {
    if (pending) return;
    setPending(true);
    setError(null);
    const res = await fetch("/api/kicks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string | null };
    setPending(false);

    if (!res.ok) {
      // 다른 탭에서 먼저 써버린 경우 등 — 화면 상태를 서버 기준으로 다시 맞춘다.
      if (body.code === "weekly_used") void loadMyWeeklyKick(userId, true);
      if (body.code === "already_kicked") {
        setKicked(true);
        setDialog(null);
        return;
      }
      setError(body.error ?? "Kick을 주지 못했어요. 잠시 후 다시 시도해주세요");
      return;
    }

    setDialog(null);
    setKicked(true);
    setKickCount((c) => c + 1);
    setKickers((list) => [{ id: userId, name: "나" }, ...list.filter((k) => k.id !== userId)]);
    if (!liked) {
      setLiked(true);
      setLikeCount((c) => c + 1);
      setWeeklyLikeCount((c) => c + 1);
    }
    markMyWeeklyKick(userId, postId);
    triggerKick();
  }

  const stateClass = kicked
    ? "text-amber-500"
    : isOwnPost
      ? "cursor-default text-gray-600 dark:text-gray-300"
      : usedElsewhere
        ? "text-gray-300 hover:text-gray-400 dark:text-gray-600 dark:hover:text-gray-500"
        : "text-gray-600 hover:text-amber-500 dark:text-gray-300 dark:hover:text-amber-400";

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label="Kick"
        aria-pressed={kicked}
        title={
          kicked
            ? "이 게시물에 Kick했어요"
            : isOwnPost
              ? "내 게시물에는 Kick할 수 없어요"
              : usedElsewhere
                ? "이번 주 Kick은 이미 사용했어요"
                : "Kick — 일주일에 한 번, 가장 인상 깊은 게시물에"
        }
        className={`inline-flex items-center gap-1 text-base font-semibold transition ${stateClass} ${className}`}
      >
        <KickIcon className="h-5 w-5" filled={kicked} />
        {kickCount > 0 ? kickCount : ""}
      </button>

      {dialog &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-4 md:items-center"
            // 포털이어도 React 이벤트는 컴포넌트 트리(게시물 카드)로 버블링된다 — 카드 쪽 클릭
            // 핸들러가 반응하지 않게 여기서 끊는다.
            onClick={(e) => {
              e.stopPropagation();
              if (!pending) setDialog(null);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="kick-dialog-title"
              className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-white p-6 text-center shadow-xl dark:bg-gray-900"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-500 dark:bg-amber-950/40">
                <KickIcon className="h-8 w-8" filled />
              </span>

              {dialog === "confirm" ? (
                <>
                  <div className="flex flex-col gap-2">
                    <h2 id="kick-dialog-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      정말 Kick 하시겠어요?
                    </h2>
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                      이 게시물이 PEAK 게시물이 될 확률이 급격히 높아져요.
                    </p>
                  </div>
                  <ul className="w-full rounded-xl bg-gray-50 px-4 py-3 text-left text-xs leading-relaxed text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    <li>· Kick은 일주일에 한 번만 줄 수 있어요 (매주 월요일 0시 충전)</li>
                    <li>· 한 번 주면 취소하거나 다른 게시물로 옮길 수 없어요</li>
                    <li>· 누가 Kick했는지는 모두에게 공개돼요</li>
                  </ul>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <div className="flex w-full gap-2">
                    <button
                      type="button"
                      onClick={() => setDialog(null)}
                      disabled={pending}
                      className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-900 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={confirmKick}
                      disabled={pending}
                      className="flex-1 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
                    >
                      {pending ? "Kick 하는 중…" : "Kick 주기"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    <h2 id="kick-dialog-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      이번 주 Kick은 이미 사용했어요
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      다음 Kick은 월요일 0시에 충전돼요 (D-{daysUntilNextKick()})
                    </p>
                  </div>
                  <div className="flex w-full gap-2">
                    {usedPostId && (
                      <Link
                        href={`/feed?feed=completion#${usedPostId}`}
                        onClick={() => setDialog(null)}
                        className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-900 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
                      >
                        Kick한 게시물 보기
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => setDialog(null)}
                      className="flex-1 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                    >
                      확인
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

"use client";

// DEMO 공유(0076) — PEAK 진행 알림("친구에게 들려주면 더 빨리 닿아요")의 행동 버튼이자 외부 유입
// 경로. 비로그인도 /feed는 열리고 DEMO는 공개라 링크를 받은 사람이 바로 들을 수 있다(미리보기
// 30초, GUEST_PREVIEW_SECONDS).
// 누르면 공유 시트: 인스타그램 스토리 / 링크 복사 / 다른 앱으로 공유(OS 공유 시트).
// 인스타 스토리는 소리가 있는 게시물(음원·영상)이면 /api/story-video가 만든 "곡 처음 15초가 깔린"
// 세로 MP4를, 이미지 게시물이거나 영상 생성이 실패하면 /api/story-image의 1080×1920 이미지를 파일로
// OS 공유 시트에 넘긴다 — 웹은 인스타 스토리 편집기를 직접 열 수 없고(스포티파이식 직행은 네이티브
// 앱 + 메타 앱 등록 전용), 곡을 붙여주는 건 메타 제휴 전용이라 영상 자체에 소리를 넣었다.
// 링크는 그 순간 클립보드에 넣어둬서 스토리의 링크 스티커에 바로 붙여넣을 수 있게 한다.
// iOS Safari는 navigator.share를 탭 직후(사용자 제스처 안)에만 허용해서, 파일 fetch를 탭한
// 뒤에 기다리면 NotAllowedError가 난다 — 그래서 시트가 열리는 순간 미리 받아둔다.
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { InstagramIcon, LinkIcon, XIcon, ArrowUpIcon } from "@/components/icons";

type StoryKind = "video" | "image";
type StoryState =
  | { status: "loading"; kind: StoryKind }
  | { status: "ready"; kind: StoryKind; file: File }
  | { status: "error"; kind: StoryKind };

export function ShareButton({ postId, title, hasSound }: { postId: string; title: string; hasSound: boolean }) {
  const [open, setOpen] = useState(false);
  const [story, setStory] = useState<StoryState>({ status: "loading", kind: hasSound ? "video" : "image" });
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const storyRequested = useRef(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  const url = () => `${window.location.origin}/feed?feed=completion#${postId}`;

  function loadStory(kind: StoryKind) {
    setStory({ status: "loading", kind });
    const [endpoint, ext, type] =
      kind === "video" ? ["story-video", "mp4", "video/mp4"] : ["story-image", "png", "image/png"];
    fetch(`/api/${endpoint}/${postId}`)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((blob) =>
        setStory({ status: "ready", kind, file: new File([blob], `compmusic-${postId.slice(0, 8)}.${ext}`, { type }) }),
      )
      // 영상이 안 되면(원본 없음·인코딩 실패) 소리 없는 이미지 카드로라도 공유할 수 있게.
      .catch(() => (kind === "video" ? loadStory("image") : setStory({ status: "error", kind })));
  }

  function openSheet() {
    setOpen(true);
    setCanNativeShare(typeof navigator.share === "function");
    // 처음 열 때 한 번만 — 받는 중에 다시 열어도 중복 요청하지 않는다(실패 시 재시도는 새로고침).
    if (storyRequested.current) return;
    storyRequested.current = true;
    loadStory(hasSound ? "video" : "image");
  }

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }

  function copyLink(): Promise<boolean> {
    return navigator.clipboard
      .writeText(url())
      .then(() => true)
      .catch(() => false);
  }

  async function shareToStory() {
    if (story.status !== "ready") return;
    const file = story.file;
    // 공유 시트보다 먼저 호출 — writeText는 제스처를 소모하지 않지만 navigator.share는 소모한다.
    const copied = copyLink();
    if (navigator.canShare?.({ files: [file] })) {
      try {
        // text/url을 같이 넣으면 인스타가 대상 목록에서 빠지는 기기가 있어 파일만 넘긴다.
        await navigator.share({ files: [file] });
        setOpen(false);
        if (await copied) showToast("링크를 복사했어요 — 스토리 링크 스티커에 붙여넣으세요");
      } catch (e) {
        if ((e as DOMException)?.name === "NotAllowedError") showToast("한 번 더 눌러주세요");
      }
      return;
    }
    // 데스크톱 등 파일 공유가 안 되는 환경 — 이미지를 내려받게 하고 링크를 복사해둔다.
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    await copied;
    showToast(
      `스토리 ${story.kind === "video" ? "영상" : "이미지"}을 저장했어요 — 휴대폰에서 누르면 인스타로 바로 올릴 수 있어요`,
    );
  }

  async function onCopyLink() {
    if (await copyLink()) {
      setOpen(false);
      showToast("링크를 복사했어요");
    } else {
      window.prompt("이 링크를 복사해서 공유하세요", url());
    }
  }

  async function onNativeShare() {
    try {
      await navigator.share({ title, text: `「${title}」 — Compmusic에서 들어보세요`, url: url() });
      setOpen(false);
    } catch {
      // 공유 시트를 닫은 경우 등 — 그냥 둔다.
    }
  }

  const rowClass =
    "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-gray-900 transition hover:bg-gray-50 disabled:opacity-50 dark:text-gray-100 dark:hover:bg-gray-800";

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-label="공유"
        title="공유"
        className="relative inline-flex items-center text-gray-600 transition hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
      >
        <LinkIcon className="h-5 w-5" />
      </button>

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
              aria-label="공유"
              className="flex w-full max-w-sm flex-col rounded-2xl bg-white pb-2 shadow-xl dark:bg-gray-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-800">
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">공유</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="닫기"
                  className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="flex flex-col px-2 pt-2">
                <button type="button" onClick={shareToStory} disabled={story.status !== "ready"} className={rowClass}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 text-white">
                    <InstagramIcon className="h-5 w-5" />
                  </span>
                  <span className="flex flex-col">
                    <span>인스타그램 스토리</span>
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                      {story.status === "loading"
                        ? story.kind === "video"
                          ? "곡 15초를 넣은 영상 만드는 중…"
                          : "스토리 이미지 만드는 중…"
                        : story.status === "error"
                          ? "스토리 카드를 만들지 못했어요"
                          : `${story.kind === "video" ? "곡이 흘러나오는 영상 · " : ""}Instagram → 스토리 선택 · 링크 자동 복사`}
                    </span>
                  </span>
                </button>
                <button type="button" onClick={onCopyLink} className={rowClass}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    <LinkIcon className="h-5 w-5" />
                  </span>
                  링크 복사
                </button>
                {canNativeShare && (
                  <button type="button" onClick={onNativeShare} className={rowClass}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                      <ArrowUpIcon className="h-5 w-5" />
                    </span>
                    다른 앱으로 공유
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

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

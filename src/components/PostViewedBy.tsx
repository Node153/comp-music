"use client";

// 게시물 조회자 목록(인스타 스토리 참고, 사용자 요청) — memo에서 공동창작 미체크
// 게시물에만 쓰인다. 조회 기록(post_views, 0051)은 본인 것만 남길 수 있고, 목록은
// 작성자 본인만 볼 수 있다(RLS) — 그래서 이 컴포넌트도 isOwnPost가 아니면 아무것도
// 렌더하지 않는다. 마운트 시 "봤다"는 기록만 조용히 남기고(실패해도 UI 안 막음),
// 작성자에게는 마운트 시점에 바로 카운트를 보여주고 클릭하면 이름 목록을 펼친다.
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { EyeIcon } from "@/components/icons";

type Viewer = { id: string; name: string };

export function PostViewedBy({
  postId,
  currentUserId,
  isOwnPost,
  className = "",
}: {
  postId: string;
  currentUserId: string;
  isOwnPost: boolean;
  className?: string;
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [viewers, setViewers] = useState<Viewer[]>([]);

  // 조회 기록 — 본인 글이 아니면 마운트 시 한 번만 기록. onConflict로 중복(이미 본 글을
  // 다시 열람) 무시 — 실패해도 조용히 넘어간다(조회 기록 실패가 화면을 막을 이유는 없음).
  useEffect(() => {
    if (isOwnPost) return;
    void supabase
      .from("post_views")
      .upsert(
        { post_id: postId, user_id: currentUserId },
        { onConflict: "post_id,user_id", ignoreDuplicates: true },
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, isOwnPost]);

  // 작성자 본인이면 마운트 시 바로 조회자 목록을 받아와 카운트를 보여준다(펼치기 전에도
  // 몇 명인지는 보여야 자연스러움 — CommentPanel처럼 클릭해야만 개수가 뜨면 어색하다).
  useEffect(() => {
    if (!isOwnPost) return;
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("post_views")
        .select("user_id")
        .eq("post_id", postId)
        .order("viewed_at", { ascending: false });
      const ids = [...new Set((rows ?? []).map((r) => r.user_id))];
      const { data: users } =
        ids.length > 0
          ? await supabase.from("user_display").select("id, display_name").in("id", ids)
          : { data: [] };
      if (cancelled) return;
      const nameMap = new Map((users ?? []).map((u) => [u.id, u.display_name]));
      setViewers(ids.map((id) => ({ id, name: nameMap.get(id) ?? "알 수 없음" })));
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, isOwnPost]);

  if (!isOwnPost) return null;

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="이 게시물을 본 사람"
        className="flex items-center justify-center gap-2 py-3.5 text-base font-semibold text-gray-600 transition hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900"
      >
        <EyeIcon className="h-5 w-5" />
        {loaded ? viewers.length : ""}
      </button>
      {open && (
        <>
          <button
            aria-label="닫기"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute bottom-full left-1/2 z-50 mb-1 max-h-64 w-48 -translate-x-1/2 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-800 dark:bg-gray-950">
            {viewers.length === 0 ? (
              <p className="px-1 py-2 text-center text-xs text-gray-400 dark:text-gray-500">
                아직 아무도 안 봤어요
              </p>
            ) : (
              viewers.map((v) => (
                <div key={v.id} className="flex items-center gap-2 rounded-lg px-1 py-1.5">
                  <Avatar userId={v.id} name={v.name} className="h-6 w-6 text-[10px]" />
                  <span className="truncate text-sm text-gray-700 dark:text-gray-300">{v.name}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

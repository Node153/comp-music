"use client";

// 공지 작성 폼 — announcements 테이블(0021)에 insert 후 router.refresh()로 목록 갱신.
// RLS(announcements_insert_admin)에서 관리자만 실제로 쓸 수 있음이 강제되므로, 이 화면
// 자체는 middleware(proxy.ts, /admin 경로 role=admin 가드)로만 보호하고 별도 검사는 안 함.
// 0067 — 종류(공지/업데이트), 맨 위 고정, "직접 써보기" 링크. "피드백 반영" 공지는 여기가 아니라
// /admin/feedback에서 피드백을 골라 만든다(반영한 피드백과 연결돼야 공감한 회원에게 알림이 감).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { field, label, errorText } from "@/components/ui/styles";
import { isInternalPath } from "@/lib/announcements";

type EditTarget = {
  id: string;
  title: string;
  content: string;
  kind: "notice" | "update";
  pinned: boolean;
  link_url: string | null;
};

export function AnnouncementForm({
  authorId,
  editTarget,
  onDone,
}: {
  authorId: string;
  editTarget?: EditTarget;
  onDone?: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [title, setTitle] = useState(editTarget?.title ?? "");
  const [content, setContent] = useState(editTarget?.content ?? "");
  const [kind, setKind] = useState<"notice" | "update">(editTarget?.kind ?? "notice");
  const [pinned, setPinned] = useState(editTarget?.pinned ?? false);
  const [linkUrl, setLinkUrl] = useState(editTarget?.link_url ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!editTarget;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim() || submitting) return;
    if (linkUrl.trim() && !isInternalPath(linkUrl.trim())) {
      setError("바로가기 링크는 /로 시작하는 앱 내부 경로만 쓸 수 있어요 (예: /search)");
      return;
    }
    setSubmitting(true);
    setError(null);
    const payload = {
      title: title.trim(),
      content: content.trim(),
      kind,
      pinned,
      link_url: linkUrl.trim() || null,
    };
    const { error: saveError } = isEdit
      ? await supabase.from("announcements").update(payload).eq("id", editTarget.id)
      : await supabase.from("announcements").insert({ author_id: authorId, ...payload });
    setSubmitting(false);
    if (saveError) {
      setError(`${isEdit ? "수정" : "등록"} 실패: ${saveError.message}`);
      return;
    }
    if (isEdit) {
      onDone?.();
    } else {
      setTitle("");
      setContent("");
      setPinned(false);
      setLinkUrl("");
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-xl border border-gray-200 p-4">
      <span className={label}>{isEdit ? "공지 수정" : "새 공지 작성"}</span>
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-800">
        {(["notice", "update"] as const).map((k) => (
          <label key={k} className="flex items-center gap-1.5">
            <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />
            {k === "notice" ? "공지 (운영 안내)" : "업데이트 (새 기능·수정)"}
          </label>
        ))}
        <label className="ml-auto flex items-center gap-1.5">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />맨 위 고정
        </label>
      </div>
      <input
        type="text"
        placeholder="제목"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={field}
      />
      <textarea
        placeholder="내용"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        className={field}
      />
      <input
        type="text"
        placeholder="직접 써보기 링크 (선택, 앱 내부 경로 — 예: /search)"
        value={linkUrl}
        onChange={(e) => setLinkUrl(e.target.value)}
        className={field}
      />
      {error && <p className={errorText}>{error}</p>}
      <div className="flex justify-end gap-2">
        {isEdit && (
          <Button type="button" variant="secondary" onClick={onDone} className="px-5">
            취소
          </Button>
        )}
        <Button type="submit" disabled={submitting || !title.trim() || !content.trim()} className="px-5">
          {submitting ? (isEdit ? "수정 중..." : "등록 중...") : isEdit ? "수정 완료" : "등록"}
        </Button>
      </div>
    </form>
  );
}

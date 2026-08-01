"use client";

// 공지 작성 폼 — announcements 테이블(0021)에 insert 후 router.refresh()로 목록 갱신.
// RLS(announcements_insert_admin)에서 관리자만 실제로 쓸 수 있음이 강제되므로, 이 화면
// 자체는 middleware(proxy.ts, /admin 경로 role=admin 가드)로만 보호하고 별도 검사는 안 함.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { field, label, errorText } from "@/components/ui/styles";

export function AnnouncementForm({ authorId }: { authorId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    const { error: insertError } = await supabase
      .from("announcements")
      .insert({ author_id: authorId, title: title.trim(), content: content.trim() });
    setSubmitting(false);
    if (insertError) {
      setError(`등록 실패: ${insertError.message}`);
      return;
    }
    setTitle("");
    setContent("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-xl border border-gray-200 p-4">
      <span className={label}>새 공지 작성</span>
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
      {error && <p className={errorText}>{error}</p>}
      <Button type="submit" disabled={submitting || !title.trim() || !content.trim()} className="self-end px-5">
        {submitting ? "등록 중..." : "등록"}
      </Button>
    </form>
  );
}

"use client";

// 공지 한 건 표시 + 수정/삭제. "수정"을 누르면 AnnouncementForm을 편집 모드로 인라인 표시.
import { useState } from "react";
import { AnnouncementForm } from "./AnnouncementForm";
import { DeleteAnnouncementButton } from "./DeleteAnnouncementButton";
import { PublishDraftButton } from "./PublishDraftButton";
import { ANNOUNCEMENT_KIND_LABEL, type AnnouncementKind } from "@/lib/announcements";
import { mutedText } from "@/components/ui/styles";

type Announcement = {
  id: string;
  title: string;
  content: string;
  kind: AnnouncementKind;
  pinned: boolean;
  link_url: string | null;
  status: "published" | "draft";
  release_date: string | null;
  created_at: string;
};

export function AnnouncementItem({ announcement: a, authorId }: { announcement: Announcement; authorId: string }) {
  const [editing, setEditing] = useState(false);

  if (editing && (a.kind === "notice" || a.kind === "update")) {
    return (
      <AnnouncementForm
        authorId={authorId}
        editTarget={{
          id: a.id,
          title: a.title,
          content: a.content,
          kind: a.kind,
          pinned: a.pinned,
          link_url: a.link_url,
        }}
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${a.status === "draft" ? "border-dashed border-gray-400 bg-gray-50" : "border-gray-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5">
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
              {ANNOUNCEMENT_KIND_LABEL[a.kind]}
            </span>
            {a.status === "draft" && (
              <span className="rounded-full border border-gray-400 px-2 py-0.5 text-xs text-gray-700">
                초안{a.release_date ? ` · ${a.release_date} 커밋 요약` : ""}
              </span>
            )}
            {a.pinned && <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs text-white">고정</span>}
            <span className="font-medium text-gray-900">{a.title}</span>
          </span>
          <span className={mutedText}>{new Date(a.created_at).toLocaleString("ko-KR")}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {a.status === "draft" && <PublishDraftButton id={a.id} />}
          {(a.kind === "notice" || a.kind === "update") && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs font-medium text-gray-600 hover:underline"
            >
              수정
            </button>
          )}
          <DeleteAnnouncementButton id={a.id} />
        </div>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{a.content}</p>
      {a.link_url && <p className="mt-1 text-xs text-gray-500">바로가기: {a.link_url}</p>}
    </div>
  );
}

"use client";

// 관리자 피드백 목록에서 여러 건을 골라 "피드백 반영" 공지 하나로 묶는 흐름(0067).
// 목록 자체는 서버 컴포넌트라, 선택 상태만 이 클라이언트 컨텍스트로 공유한다:
//   <AnnounceSelectionProvider> — 목록 전체를 감쌈
//   <SelectForAnnounce id=…/>  — 각 피드백 카드의 체크박스
//   <AnnounceComposer/>        — 1건 이상 고르면 화면 하단에 뜨는 작성 패널
import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createFeedbackAnnouncement } from "@/lib/announcements";
import { field, errorText } from "@/components/ui/styles";

type Ctx = { selected: Set<string>; toggle: (id: string) => void; clear: () => void };
const SelectionContext = createContext<Ctx | null>(null);

export function AnnounceSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  return (
    <SelectionContext.Provider value={{ selected, toggle, clear: () => setSelected(new Set()) }}>
      {children}
    </SelectionContext.Provider>
  );
}

function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("AnnounceSelectionProvider 밖에서 사용됨");
  return ctx;
}

export function SelectForAnnounce({ id }: { id: string }) {
  const { selected, toggle } = useSelection();
  return (
    <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-gray-600">
      <input type="checkbox" checked={selected.has(id)} onChange={() => toggle(id)} />
      반영 공지에 포함
    </label>
  );
}

export function AnnounceComposer() {
  const router = useRouter();
  const { selected, clear } = useSelection();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [requestSummary, setRequestSummary] = useState("");
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [markDone, setMarkDone] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (selected.size === 0) return null;

  async function submit() {
    if (!title.trim() || !content.trim() || saving) return;
    setSaving(true);
    setError(null);
    const { error: err } = await createFeedbackAnnouncement(createClient(), {
      feedbackIds: [...selected],
      title,
      content,
      requestSummary,
      linkUrl,
      markDone,
    });
    setSaving(false);
    if (err) {
      setError(err);
      router.refresh();
      return;
    }
    setTitle("");
    setRequestSummary("");
    setContent("");
    setLinkUrl("");
    setOpen(false);
    clear();
    router.refresh();
  }

  return (
    <div className="sticky bottom-20 z-10 rounded-xl border border-gray-900 bg-white p-4 shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900">피드백 {selected.size}건 선택됨</span>
        <div className="flex gap-2">
          <button type="button" onClick={clear} className="text-xs text-gray-500 hover:underline">
            선택 해제
          </button>
          {!open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
            >
              반영 공지 만들기
            </button>
          )}
        </div>
      </div>
      {open && (
        <div className="mt-3 flex flex-col gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="제목 (예: 검색에 장르 필터가 생겼어요)"
            className={field}
          />
          <textarea
            value={requestSummary}
            onChange={(e) => setRequestSummary(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="요청 내용 요약 (예: 검색 결과를 장르로 좁혀 보고 싶다는 의견) — 비공개 피드백 원문은 옮기지 마세요"
            className={field}
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            placeholder="바뀐 점 (예: 검색 화면 상단에 장르 칩을 추가했어요)"
            className={field}
          />
          <input
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="직접 써보기 링크 (선택, 앱 내부 경로 — 예: /search)"
            className={field}
          />
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={markDone} onChange={(e) => setMarkDone(e.target.checked)} />
            선택한 피드백을 “반영됨”으로 바꾸고 작성자에게 알리기
          </label>
          <p className="text-xs text-gray-500">
            공지는 전체 회원에게 보여요. 요청한 회원 수와 공감 수는 숫자로만 표시되고, 공감한 회원에게도 반영 알림이 가요.
          </p>
          {error && <p className={errorText}>{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-500 hover:underline">
              접기
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving || !title.trim() || !content.trim()}
              className="rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "등록 중..." : "공지 등록"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

// 피드백 페이지 오른쪽 탭 카드(2026-09-24 정리) — 박스가 5개로 늘어 화면이 복잡해져서, 채팅 외의
// 보조 정보(업데이트 소식 / 지금 만드는 중 / 기여 랭킹)를 카드 하나의 탭으로 모았다. 기능은 그대로.
// 채팅의 반영 소식 카드가 "#updates"로 링크하면 소식 탭으로 전환된다.
import { useEffect, useState } from "react";
import { UpdatesBoard, type UpdateItem } from "@/components/UpdatesBoard";
import { ContributionPanel, type BoardRow, type MyContribution } from "@/components/ContributionPanel";
import { FeedbackStatusIcon } from "@/components/FeedbackIcons";
import { FEEDBACK_STATUS_LABEL, type FeedbackStatus } from "@/lib/feedback";
import { ThumbsUpIcon } from "@/components/icons";

export type BuildingItem = { id: string; content: string; status: FeedbackStatus; likes: number };

type Tab = "updates" | "building" | "ranking";

const HASH_TAB: Record<string, Tab> = { "#updates": "updates", "#building": "building", "#ranking": "ranking" };

export function FeedbackSidePanel({
  updates,
  building,
  contribution,
}: {
  updates: UpdateItem[];
  building: BuildingItem[];
  contribution: { userId: string; mine: MyContribution; monthBoard: BoardRow[]; allBoard: BoardRow[] } | null;
}) {
  const [tab, setTab] = useState<Tab>("updates");

  useEffect(() => {
    function onHash() {
      const next = HASH_TAB[window.location.hash];
      if (next) setTab(next);
    }
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: "updates", label: "업데이트 소식" },
    { value: "building", label: "만드는 중", count: building.length || undefined },
    ...(contribution ? [{ value: "ranking" as const, label: "기여 랭킹" }] : []),
  ];

  return (
    <div id="updates" className="flex h-full min-h-0 flex-col rounded-xl bg-box-gray">
      <div role="tablist" className="flex gap-1 border-b border-main-gray p-2">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
              tab === t.value ? "bg-black text-white" : "text-active-gray hover:bg-main-gray hover:text-black"
            }`}
          >
            {t.label}
            {t.count ? <span className="ml-1 tabular-nums opacity-70">{t.count}</span> : null}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "updates" && <UpdatesBoard items={updates} />}

        {tab === "building" && (
          <div className="flex flex-col gap-1.5">
            <p className="px-1 pb-1 text-xs text-active-gray">공감을 많이 받은 의견부터, 지금 검토하고 있는 것들이에요.</p>
            {building.map((m, i) => (
              <a
                key={m.id}
                href={`#fb-${m.id}`}
                className="flex items-center gap-3 rounded-lg bg-main-gray px-3 py-2 text-sm text-black transition hover:bg-demo-bg"
              >
                <span className="w-4 shrink-0 text-center text-xs font-semibold tabular-nums text-active-gray">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{m.content}</span>
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-active-gray">
                  <FeedbackStatusIcon status={m.status} className="h-3 w-3" />
                  {FEEDBACK_STATUS_LABEL[m.status]}
                </span>
                {m.likes > 0 && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-active-gray">
                    <ThumbsUpIcon className="h-3 w-3" /> {m.likes}
                  </span>
                )}
              </a>
            ))}
            {building.length === 0 && (
              <p className="py-8 text-center text-xs text-active-gray">
                공감을 많이 받은 의견이 여기 올라와요.
                <br />
                채팅에서 “나도”로 공감해 보세요.
              </p>
            )}
          </div>
        )}

        {tab === "ranking" && contribution && <ContributionPanel {...contribution} />}
      </div>
    </div>
  );
}

"use client";

// Help(피드백) 페이지 왼쪽 칸 "업데이트 소식"(0067) — 예전 공지사항 목록을 대체한다.
// 공지 종류별 카드: 공지(운영 안내) / 업데이트(새 기능·수정) / 피드백 반영(강조 카드 — 요청 요약,
// 바뀐 점, 요청 회원 수·공감 수, "직접 써보기"). 고정 공지는 맨 위.
// 2026-09-24 — 피드백 페이지 오른쪽 탭 카드(FeedbackSidePanel) 안으로 들어가면서 자체 박스와
// 전체/업데이트/공지 필터 탭을 없앴다(탭 안의 탭이라 복잡). 종류는 카드 머리의 라벨로 구분된다.
import Link from "next/link";
import { timeAgo } from "@/lib/timeAgo";
import { ANNOUNCEMENT_KIND_LABEL, isInternalPath, type AnnouncementKind } from "@/lib/announcements";
import {
  ArrowRightIcon,
  FeedbackIcon,
  MegaphoneIcon,
  PinIcon,
  SparkleIcon,
  ThumbsUpIcon,
  UsersIcon,
} from "@/components/icons";

export type UpdateItem = {
  id: string;
  kind: AnnouncementKind;
  title: string;
  content: string;
  pinned: boolean;
  requestSummary: string | null;
  linkUrl: string | null;
  requesterCount: number;
  likeCount: number;
  createdAt: string;
};

function KindIcon({ kind, className }: { kind: AnnouncementKind; className?: string }) {
  if (kind === "feedback") return <FeedbackIcon className={className} />;
  if (kind === "update") return <SparkleIcon className={className} />;
  return <MegaphoneIcon className={className} />;
}

export function UpdatesBoard({ items }: { items: UpdateItem[] }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((a) => {
        const isFeedback = a.kind === "feedback";
        return (
          <article
            key={a.id}
            className={`flex flex-col gap-2 rounded-xl bg-main-gray p-4 ${isFeedback ? "border border-black" : ""}`}
          >
            <div className="flex items-center justify-between gap-2 text-[11px] text-active-gray">
              <span className="inline-flex items-center gap-1 font-semibold text-black">
                <KindIcon kind={a.kind} className="h-3.5 w-3.5" />
                {ANNOUNCEMENT_KIND_LABEL[a.kind]}
                {a.pinned && (
                  <span className="ml-1 inline-flex items-center gap-0.5 font-normal text-active-gray">
                    <PinIcon className="h-3 w-3" /> 고정
                  </span>
                )}
              </span>
              <span className="shrink-0">{timeAgo(a.createdAt)}</span>
            </div>
            <h3 className="font-semibold text-black">{a.title}</h3>

            {isFeedback && a.requestSummary && (
              <div className="rounded-lg bg-box-gray px-3 py-2 text-sm">
                <span className="block text-[11px] font-semibold text-active-gray">요청 내용</span>
                <p className="mt-0.5 whitespace-pre-wrap text-black">{a.requestSummary}</p>
              </div>
            )}
            <div className="text-sm">
              {isFeedback && <span className="block text-[11px] font-semibold text-active-gray">바뀐 점</span>}
              <p className="whitespace-pre-wrap leading-relaxed text-black">{a.content}</p>
            </div>

            {(isFeedback || (a.linkUrl && isInternalPath(a.linkUrl))) && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                {isFeedback ? (
                  <span className="inline-flex items-center gap-2 text-[11px] text-active-gray">
                    {a.requesterCount > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <UsersIcon className="h-3 w-3" /> 회원 {a.requesterCount}명이 요청
                      </span>
                    )}
                    {a.likeCount > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <ThumbsUpIcon className="h-3 w-3" /> 공감 {a.likeCount}
                      </span>
                    )}
                  </span>
                ) : (
                  <span />
                )}
                {a.linkUrl && isInternalPath(a.linkUrl) && (
                  <Link
                    href={a.linkUrl}
                    className="inline-flex items-center gap-1 rounded-full bg-black px-3 py-1 text-xs font-medium text-white transition hover:opacity-90"
                  >
                    직접 써보기 <ArrowRightIcon className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )}
          </article>
        );
      })}

      {items.length === 0 && <p className="py-8 text-center text-xs text-active-gray">아직 업데이트 소식이 없어요</p>}
    </div>
  );
}

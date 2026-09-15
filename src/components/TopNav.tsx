"use client";

// 데스크톱 웹 기준 상단 네비게이션(링크드인 참고). 모바일(md 미만)에서는 BottomNav가 대신 노출됨.
// 좌: 로고 · 우: Drop(업로드)/Chat(메시지)/Alerts(알림)/Me/Help 클러스터.
// Messages/Notifications는 각각 Chat/Alerts로 축약 — Drop과 첫 글자가 겹치는 DM은 피했다.
// 안읽음 뱃지는 원래 Me 아바타에 있었는데, /notifications 알림 목록 페이지가 생기면서
// 그 전용 아이콘으로 옮김(좋아요/댓글만 1단계 — Companion 신청·Peak·공동창작 신청은 다음 단계).
// Alerts/Chat 둘 다 페이지 이동 대신 드롭다운(ProfileMenu와 같은 클릭-토글 패턴)으로 최근
// 알림/대화를 바로 훑어보게 하고, 전체 목록/필터·실제 대화는 각각 /notifications, /messages
// (해당 대화방)로 넘긴다.
// 우측 사이드바의 mock DM 위젯을 걷어내면서 메시지를 상단 메뉴 1급 항목으로 승격 — 실제
// /messages 라우트(Realtime)로 바로 연결.
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ProfileMenu } from "@/components/ProfileMenu";
import { NotificationsMenu } from "@/components/NotificationsMenu";
import { MessagesMenu } from "@/components/MessagesMenu";
import { useSearchOverlay } from "@/components/SearchOverlayContext";
import { beginThemeTransition } from "@/lib/theme";
import { PlusIcon, HelpIcon, SearchIcon } from "@/components/icons";
import { topBarIconClass } from "@/components/ui/styles";

// 전체공개(Demo, 노출시간 영구·설정불가) / 비공개(Complex, 노출시간 설정 필수 — 팔로워공개 또는
// 특정인 초대) 두 피드 탭.
// 아직 UI만 있고 실제 필터링·업로드 연동은 데이터 연결 단계에서 진행 예정.
const FEED_TABS = [
  { value: "completion", label: "DEMO", icon: "☀" },
  { value: "complex", label: "memo", icon: "☾" },
];

export function TopNav({
  currentUserId,
  userName,
  isAdmin = false,
}: {
  currentUserId: string;
  userName: string;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeFeedTab = searchParams.get("feed") ?? "completion";
  const search = useSearchOverlay();
  // 피드(/feed)는 캔버스가 흰색(PageCanvas)이라 흰 상단바가 자연스럽지만, 그 외 화면(업로드·
  // 프로필 등)은 캔버스가 짙은 active-gray라 흰 상단바만 붕 떠 보였다(사용자 제보). 캔버스 위
  // 최상위 박스는 main-gray를 쓴다는 그레이 컬러 시스템 규칙(globals.css)을 상단바에도 맞춘다.
  const isFeed = pathname === "/feed" || pathname?.startsWith("/feed/");

  return (
    <header
      className={`sticky top-0 z-40 hidden h-14 items-center gap-2 border-b px-4 md:flex ${
        isFeed
          ? "border-gray-200 bg-white dark:border-gray-800 dark:bg-[#1c1c1e]"
          : "border-box-gray bg-main-gray"
      }`}
    >
      <div className="flex flex-1 items-center gap-2">
        <Link href="/feed" className="flex shrink-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-xs font-bold text-white dark:bg-white dark:text-black">
            Comp
          </span>
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">Comp</span>
        </Link>
      </div>

      <nav className="flex h-full items-center gap-1">
        {FEED_TABS.map((tab) => {
          const isActive = pathname === "/feed" && activeFeedTab === tab.value;
          return (
            <Link
              key={tab.value}
              href={`/feed?feed=${tab.value}`}
              onClick={beginThemeTransition}
              title={
                tab.value === "completion"
                  ? "전체공개 게시물 · 노출 시간 영구"
                  : "Companion 공개 게시물 · 노출 시간 설정 필수"
              }
              className={`flex h-full items-center gap-1.5 border-b-2 px-4 text-sm font-bold transition ${
                isActive
                  ? tab.value === "complex"
                    ? "border-violet-500 text-violet-600 dark:text-violet-300"
                    : "border-demo-gold text-demo-gold"
                  : "border-transparent text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900"
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-1 items-center justify-end gap-2">
        <button
          type="button"
          onClick={search.open}
          title="검색"
          aria-label="검색"
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${topBarIconClass(search.isOpen, isFeed)}`}
        >
          <SearchIcon />
        </button>
        <Link
          href="/upload"
          title="Drop"
          aria-label="Drop"
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${topBarIconClass(pathname === "/upload", isFeed)}`}
        >
          <PlusIcon />
        </Link>
        <MessagesMenu isFeed={isFeed} />
        <NotificationsMenu userId={currentUserId} isFeed={isFeed} />
        <Link
          href="/help"
          title="Help"
          aria-label="Help"
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${topBarIconClass(pathname === "/help", isFeed)}`}
        >
          <HelpIcon />
        </Link>
        <ProfileMenu userId={currentUserId} userName={userName} isAdmin={isAdmin} />
      </div>
    </header>
  );
}

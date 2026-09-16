"use client";

// 데스크톱 좌측 메인 내비게이션(인스타그램 참고, 2026-09-16 사용자 요청) — 로고/검색/만들기(업로드)/
// 채팅/알림/Help/프로필을 TopNav 상단바에서 여기로 전부 옮겼다. 상단바(TopNav)엔 이제
// DEMO/memo 피드 탭만 남는다. 모바일(md 미만)은 그대로 BottomNav+MobileTopBar를 쓴다(hidden md:flex).
// (app)/feed/layout.tsx의 LeftSidebar(장르 필터)와는 이름·역할이 다른 별개 컴포넌트 — 그쪽은
// 피드 화면 안의 보조 패널이고, 이건 화면 전환용 전역 내비게이션이라 항상 화면 왼쪽에 고정된다.
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProfileMenu } from "@/components/ProfileMenu";
import { NotificationsMenu } from "@/components/NotificationsMenu";
import { MessagesMenu } from "@/components/MessagesMenu";
import { useSearchOverlay } from "@/components/SearchOverlayContext";
import { PlusIcon, HelpIcon, SearchIcon } from "@/components/icons";
import { navRowClass, navLabelClass } from "@/components/ui/styles";

export function NavSidebar({
  currentUserId,
  userName,
  isAdmin = false,
}: {
  currentUserId: string;
  userName: string;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const search = useSearchOverlay();
  const isFeed = pathname === "/feed" || pathname?.startsWith("/feed/");

  // 평소엔 아이콘만 보이는 좁은 레일이다가 마우스를 올리면 라벨까지 보이는 넓은 폭으로
  // 펼쳐진다(인스타그램 좌측 메뉴 참고). 처음엔 순수 CSS :hover(group-hover)로 했는데,
  // 메시지/알림처럼 사이드바 옆에 큰 패널이 이어붙는 항목을 열면 마우스가 여전히 사이드바
  // 위에 있어서 라벨이 펼쳐진 사이드바 + 패널이 동시에 겹쳐 보였다(사용자 제보 — "사이드바를
  // 확장하는 개념이 아니라 사이드바 자체에서 알림탭으로 넘어가는" 인스타그램과 다름).
  // 그래서 hover를 JS 상태로 들고, 메시지/알림 패널이 열려 있으면 강제로 접은 채 고정한다 —
  // 패널이 항상 접힌 폭(72px) 바로 옆에서 시작해서 "사이드바가 그대로 알림 화면으로 바뀐"
  // 것처럼 이어진다.
  const [hovering, setHovering] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const anyPanelOpen = messagesOpen || notificationsOpen || profileOpen;
  const expanded = hovering && !anyPanelOpen;

  return (
    <aside
      // overflow-y-auto를 쓰면(스크롤 대비로 처음에 넣었었음) CSS 스펙상 두 축 중 하나라도
      // visible이 아니면 나머지 축도 강제로 auto로 계산돼(overflow-x-visible을 명시해도 안 먹음
      // — 브라우저가 계산값 자체를 덮어씀) 메시지/알림 드롭다운(left-full로 오른쪽에 펼쳐짐)이
      // 그대로 잘려 안 보이는 문제가 있었다(2026-09-16 발견). 항목 6개+로고+프로필이 어떤
      // 화면에서도 넘칠 일이 없어서 overflow 자체를 아예 빼는 걸로 해결.
      // position:fixed라 넓어져도 옆 콘텐츠를 밀어내지 않고 그 위에 겹쳐 뜬다 — 본문 오프셋
      // ((app)/layout.tsx의 md:pl-[72px])은 항상 접힌 폭 기준으로 고정.
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      // inset-y-0(위아래 꽉 채움) 대신 top-0 + bottom-16(64px, GlobalPlayerBar의 h-16과 동일값) —
      // 전엔 사이드바가 화면 맨 아래까지 뻗어 있어서 하단 사운드바(z-50)랑 같은 자리를 두고
      // z-index로만 위아래를 가렸는데, 사이드바 폭이 바뀌는 트랜지션 중 일부 브라우저(Safari)에서
      // 겹친 영역의 쌓임 순서가 순간적으로 꼬여 사운드바 왼쪽이 사이드바에 가려 잘려 보이는
      // 문제가 있었다(2026-09-16 사용자 제보). 아예 두 요소가 세로로 안 겹치게 사이드바 높이를
      // 사운드바 바로 위에서 끊었다.
      className={`fixed left-0 top-0 bottom-16 z-40 hidden flex-col gap-1 border-r px-3 py-4 transition-[width] duration-200 ease-in-out md:flex ${
        expanded ? "w-60" : "w-[72px]"
      } ${
        isFeed
          ? "border-gray-200 bg-white dark:border-gray-800 dark:bg-[#1c1c1e]"
          : "border-box-gray bg-main-gray"
      }`}
    >
      <Link
        href="/feed"
        className={`mb-3 flex items-center px-3 py-2 ${expanded ? "justify-start gap-2" : "justify-center gap-0"}`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-xs font-bold text-white dark:bg-white dark:text-black">
          Comp
        </span>
        <span className={`text-lg font-bold text-gray-900 dark:text-gray-100 ${navLabelClass(expanded)}`}>
          Comp
        </span>
      </Link>

      {/* 메뉴 아이콘들을 로고 밑에 붙이지 않고, 남는 세로 공간 안에서 가운데로 오게
          한다(2026-09-16, 사용자 요청 — "메뉴 아이콘들 세로 중앙정렬"). flex-1이 로고 아래
          남은 높이를 전부 차지하고, justify-center가 그 안에서 그룹 전체를 가운데 정렬한다. */}
      <div className="flex flex-1 flex-col justify-center gap-1">
        <button type="button" onClick={search.open} className={navRowClass(search.isOpen, isFeed, expanded)}>
          <SearchIcon className="h-6 w-6 shrink-0" />
          <span className={navLabelClass(expanded)}>검색</span>
        </button>
        <MessagesMenu isFeed={isFeed} expanded={expanded} onOpenChange={setMessagesOpen} />
        <NotificationsMenu
          userId={currentUserId}
          isFeed={isFeed}
          expanded={expanded}
          onOpenChange={setNotificationsOpen}
        />
        <Link href="/upload" className={navRowClass(pathname === "/upload", isFeed, expanded)}>
          <PlusIcon className="h-6 w-6 shrink-0" />
          <span className={navLabelClass(expanded)}>만들기</span>
        </Link>
        <Link href="/help" className={navRowClass(pathname === "/help", isFeed, expanded)}>
          <HelpIcon className="h-6 w-6 shrink-0" />
          <span className={navLabelClass(expanded)}>Help</span>
        </Link>
        <ProfileMenu
          userId={currentUserId}
          userName={userName}
          isAdmin={isAdmin}
          isFeed={isFeed}
          expanded={expanded}
          onOpenChange={setProfileOpen}
        />
      </div>
    </aside>
  );
}

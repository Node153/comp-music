"use client";

// 데스크톱 좌측 메인 내비게이션(인스타그램 참고, 2026-09-16 사용자 요청) — 로고/검색/만들기(업로드)/
// 채팅/알림/Help/프로필을 TopNav 상단바에서 여기로 전부 옮겼다. 상단바(TopNav)엔 이제
// DEMO/memo 피드 탭만 남는다. 모바일(md 미만)은 그대로 BottomNav+MobileTopBar를 쓴다(hidden md:flex).
// (app)/feed/layout.tsx의 LeftSidebar(장르 필터)와는 이름·역할이 다른 별개 컴포넌트 — 그쪽은
// 피드 화면 안의 보조 패널이고, 이건 화면 전환용 전역 내비게이션이라 항상 화면 왼쪽에 고정된다.
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

  return (
    <aside
      // overflow-y-auto를 쓰면(스크롤 대비로 처음에 넣었었음) CSS 스펙상 두 축 중 하나라도
      // visible이 아니면 나머지 축도 강제로 auto로 계산돼(overflow-x-visible을 명시해도 안 먹음
      // — 브라우저가 계산값 자체를 덮어씀) 메시지/알림 드롭다운(left-full로 오른쪽에 펼쳐짐)이
      // 그대로 잘려 안 보이는 문제가 있었다(2026-09-16 발견). 항목 7개+로고+프로필이 어떤
      // 화면에서도 넘칠 일이 없어서 overflow 자체를 아예 빼는 걸로 해결.
      // 평소엔 아이콘만 보이는 좁은 레일(w-[72px])이다가 마우스를 올리면 라벨까지 보이는
      // 넓은 폭(hover:w-60)으로 펼쳐진다(2026-09-16, 사용자 요청 — 인스타그램 좌측 메뉴 참고).
      // position:fixed라 넓어져도 옆 콘텐츠를 밀어내지 않고 그 위에 겹쳐 뜬다 — 본문 오프셋
      // ((app)/layout.tsx의 md:pl-[72px])은 항상 접힌 폭 기준으로 고정.
      className={`group fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col gap-1 border-r px-3 py-4 transition-[width] duration-200 ease-in-out hover:w-60 md:flex ${
        isFeed
          ? "border-gray-200 bg-white dark:border-gray-800 dark:bg-[#1c1c1e]"
          : "border-box-gray bg-main-gray"
      }`}
    >
      <Link
        href="/feed"
        className="mb-3 flex items-center justify-center gap-0 px-3 py-2 group-hover:justify-start group-hover:gap-2"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-xs font-bold text-white dark:bg-white dark:text-black">
          Comp
        </span>
        <span className={`text-lg font-bold text-gray-900 dark:text-gray-100 ${navLabelClass}`}>Comp</span>
      </Link>

      <button type="button" onClick={search.open} className={navRowClass(search.isOpen, isFeed)}>
        <SearchIcon className="h-6 w-6 shrink-0" />
        <span className={navLabelClass}>검색</span>
      </button>
      <MessagesMenu isFeed={isFeed} />
      <NotificationsMenu userId={currentUserId} isFeed={isFeed} />
      <Link href="/upload" className={navRowClass(pathname === "/upload", isFeed)}>
        <PlusIcon className="h-6 w-6 shrink-0" />
        <span className={navLabelClass}>만들기</span>
      </Link>
      <Link href="/help" className={navRowClass(pathname === "/help", isFeed)}>
        <HelpIcon className="h-6 w-6 shrink-0" />
        <span className={navLabelClass}>Help</span>
      </Link>
      <ProfileMenu userId={currentUserId} userName={userName} isAdmin={isAdmin} isFeed={isFeed} />
    </aside>
  );
}

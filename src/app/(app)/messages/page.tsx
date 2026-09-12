import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, pageCard } from "@/components/ui/styles";
import { Avatar } from "@/components/Avatar";
import { timeAgo } from "@/lib/timeAgo";
import { EditIcon, MailIcon } from "@/components/icons";
import { SearchTriggerButton } from "@/components/SearchTriggerButton";
import { getConversationList } from "@/lib/conversationList";

// S12 DM 목록 (DM-02)
// "다정한 말풍선" 톤(인스타그램/메신저 참고)으로 개편 — RightSidebar와 같은 색상 아바타 +
// 온라인 상태 점을 여기서도 써서 앱 전체에서 "이 사람 지금 접속해있나"가 같은 방식으로 보이게 한다.
// 조립 자체는 getConversationList(TopNav 메시지 드롭다운과 공유)가 담당하고, 이 페이지는
// 전체 목록 렌더링만 맡는다.
export default async function MessagesPage() {
  const supabase = await createClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  if (!currentUser) redirect("/login");

  const conversations = await getConversationList(supabase, currentUser.id);

  return (
    <main className={pageCard}>
      <div className="flex items-center justify-between">
        <h1 className={`${pageTitle} !text-black`}>메시지</h1>
        <SearchTriggerButton
          title="새 대화 시작"
          aria-label="새 대화 시작"
          className="flex h-9 w-9 items-center justify-center rounded-full text-black transition hover:bg-box-gray"
        >
          <EditIcon className="h-5 w-5" />
        </SearchTriggerButton>
      </div>
      <ul className="mt-4 flex flex-col gap-1.5">
        {conversations.map((c) => {
          // 안읽음(중요) = 검정, 읽음(덜 중요) = 짙은 톤 글씨로 구분.
          const textColor = c.unread ? "text-black" : "text-active-gray";
          return (
            <li key={c.id}>
              <Link
                href={c.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 transition hover:opacity-90 ${
                  c.unread ? "bg-demo-bg" : "bg-box-gray"
                }`}
              >
                <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
                  <Avatar userId={c.otherUserId} name={c.otherName} className="h-12 w-12 text-base" />
                  {c.presence !== "offline" && (
                    <span
                      className={`absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-box-gray ${
                        c.presence === "online" ? "bg-emerald-500" : "bg-amber-400"
                      }`}
                    />
                  )}
                </span>
                <div className="flex flex-1 flex-col overflow-hidden">
                  <span className={`text-sm ${c.unread ? "font-semibold" : "font-medium"} ${textColor}`}>
                    {c.otherName}
                  </span>
                  <span className={`truncate text-xs ${textColor}`}>
                    {c.lastMessage?.content ?? "대화를 시작해보세요"}
                  </span>
                </div>
                {c.lastMessage && (
                  <span className={`shrink-0 text-[11px] ${textColor}`}>{timeAgo(c.lastMessage.createdAt)}</span>
                )}
              </Link>
            </li>
          );
        })}
        {conversations.length === 0 && (
          <li className="flex flex-col items-center gap-3 py-16 text-center">
            <MailIcon className="h-8 w-8 text-black" />
            <p className="text-sm text-black">아직 대화가 없어요</p>
            <SearchTriggerButton className="rounded-xl bg-demo-bg px-4 py-2 text-sm font-medium text-black transition hover:opacity-90">
              사람 찾아 대화 시작하기
            </SearchTriggerButton>
          </li>
        )}
      </ul>
    </main>
  );
}

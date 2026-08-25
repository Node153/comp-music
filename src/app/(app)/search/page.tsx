"use client";

// 유저 검색 — 지금까지 다른 사람을 찾을 방법이 "DEMO 피드에서 우연히 보기"뿐이었다.
// users_select_self_or_approved_peers RLS(0002)가 승인 사용자끼리는 서로 조회를 허용하므로
// 검색 자체는 막힘없이 된다. 다만 실명(name)은 절대 검색/노출 대상에 안 넣는다 — 실명은
// Companion에게만 보여야 하는 정보라(user_display 뷰의 존재 이유), 여기서는 항상 공개인
// nickname으로만 검색하고 nickname만 보여준다. InviteUserPicker(기존 Companion 안에서만
// 검색)와는 목적이 다른 화면이라 새로 만든다.
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { pageTitle, pageCard, field } from "@/components/ui/styles";

type SearchResult = { id: string; nickname: string };

const SEARCH_DEBOUNCE_MS = 300;
const RESULT_LIMIT = 20;

export default function SearchPage() {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, [supabase]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("users")
        .select("id, nickname")
        .eq("status", "approved")
        .ilike("nickname", `%${trimmed}%`)
        .limit(RESULT_LIMIT);
      if (!cancelled) setResults((data ?? []).filter((u) => u.id !== currentUserId));
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, supabase, currentUserId]);

  return (
    <main className={pageCard}>
      <h1 className={pageTitle}>검색</h1>
      <input
        type="text"
        placeholder="닉네임으로 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
        className={`mt-3 ${field}`}
      />
      <ul className="mt-4 flex flex-col">
        {results === null ? (
          <p className="py-10 text-center text-sm text-gray-400">닉네임을 입력해보세요</p>
        ) : results.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">일치하는 사용자가 없어요</p>
        ) : (
          results.map((u) => (
            <li key={u.id}>
              <Link
                href={`/profile/${u.id}`}
                className="flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-gray-50"
              >
                <Avatar userId={u.id} name={u.nickname} className="h-10 w-10 text-sm" />
                <span className="text-sm font-medium text-gray-900">{u.nickname}</span>
              </Link>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}

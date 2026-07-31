"use client";

// Complex 업로드에서 "초대한 사람만" 선택 시 쓰는 실제 사용자 검색+선택 UI.
// 이름 자유 입력(예전 inviteNames 텍스트박스)은 실제 user_id로 매핑이 안 돼서 post_access에
// 넣을 수 없었음 — users_select_self_or_approved_peers RLS가 이미 "승인된 사용자는 서로의
// id/name을 볼 수 있음"을 허용하므로 별도 API 없이 클라이언트에서 바로 검색 가능.
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type PickedUser = { id: string; name: string };

export function InviteUserPicker({
  currentUserId,
  value,
  onChange,
}: {
  currentUserId: string;
  value: PickedUser[];
  onChange: (next: PickedUser[]) => void;
}) {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    debounceRef.current = setTimeout(async () => {
      if (!trimmed) {
        setResults([]);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from("users")
        .select("id, name")
        .eq("status", "approved")
        .neq("id", currentUserId)
        .ilike("name", `%${trimmed}%`)
        .limit(8);
      setResults(data ?? []);
      setLoading(false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, currentUserId, supabase]);

  function addUser(user: PickedUser) {
    if (value.some((u) => u.id === user.id)) return;
    onChange([...value, user]);
    setQuery("");
    setResults([]);
  }

  function removeUser(id: string) {
    onChange(value.filter((u) => u.id !== id));
  }

  return (
    <div className="flex flex-col gap-1.5">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => removeUser(u.id)}
              className="flex items-center gap-1 rounded-full bg-black px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-black"
            >
              {u.name}
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="이름으로 검색해서 초대"
        className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-white dark:focus:ring-white"
      />
      {query.trim() && (
        <div className="flex flex-col gap-1 rounded-xl border border-gray-200 p-2 dark:border-gray-700">
          {loading && (
            <p className="px-2 py-1 text-xs text-gray-400 dark:text-gray-500">검색 중...</p>
          )}
          {!loading && results.length === 0 && (
            <p className="px-2 py-1 text-xs text-gray-400 dark:text-gray-500">
              일치하는 사용자가 없어요.
            </p>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => addUser(u)}
              className="rounded-lg px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {u.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

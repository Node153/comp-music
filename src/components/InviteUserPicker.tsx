"use client";

// Complex 업로드에서 "초대한 사람만" 선택 시 쓰는 초대 대상 선택 UI.
// 후보는 내 Companion으로 한정한다(전체 승인 사용자 검색이 아님) — memo 게시물은 방장과
// Companion인 사람에게만 피드에 뜨므로(0017/0020), Companion이 아닌 사람을 초대해봐야 그
// 사람 화면엔 게시물 자체가 안 보여 초대가 무의미하다. 입력창을 클릭하면 검색어 없이도 내
// Companion 전체 목록이 바로 펼쳐지고, 타이핑하면 그 안에서 필터링된다.
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
  // null = 아직 로딩 중, [] = 로딩 끝났는데 Companion이 없음.
  const [companions, setCompanions] = useState<PickedUser[] | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: companionRows } = await supabase
        .from("companions")
        .select("requester_id, addressee_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`);
      const companionIds = [
        ...new Set(
          (companionRows ?? []).map((r) =>
            r.requester_id === currentUserId ? r.addressee_id : r.requester_id,
          ),
        ),
      ];
      if (companionIds.length === 0) {
        if (!cancelled) setCompanions([]);
        return;
      }
      const { data: users } = await supabase
        .from("user_display")
        .select("id, display_name")
        .in("id", companionIds);
      if (!cancelled) {
        setCompanions(
          (users ?? [])
            .map((u) => ({ id: u.id, name: u.display_name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUserId, supabase]);

  const results = (companions ?? []).filter(
    (u) => !value.some((v) => v.id === u.id) && u.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function addUser(user: PickedUser) {
    onChange([...value, user]);
    setQuery("");
    inputRef.current?.focus();
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
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder="Companion 검색해서 초대"
        className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-white dark:focus:ring-white"
      />
      {open && (
        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-xl border border-gray-200 p-2 dark:border-gray-700">
          {companions === null && (
            <p className="px-2 py-1 text-xs text-gray-400 dark:text-gray-500">불러오는 중...</p>
          )}
          {companions !== null && companions.length === 0 && (
            <p className="px-2 py-1 text-xs text-gray-400 dark:text-gray-500">
              아직 Companion이 없어요. 먼저 Companion을 맺어보세요.
            </p>
          )}
          {companions !== null && companions.length > 0 && results.length === 0 && (
            <p className="px-2 py-1 text-xs text-gray-400 dark:text-gray-500">
              {query.trim() ? "일치하는 Companion이 없어요." : "초대 가능한 Companion이 없어요."}
            </p>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              // mousedown에서 preventDefault해야 클릭 시 input이 먼저 blur되며 목록이
              // 닫혀버리는 걸 막을 수 있다(포커스를 유지한 채로 onClick까지 도달).
              onMouseDown={(e) => e.preventDefault()}
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

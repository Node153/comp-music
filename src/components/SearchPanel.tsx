"use client";

// 유저 검색 — 지금까지 다른 사람을 찾을 방법이 "DEMO 피드에서 우연히 보기"뿐이었다.
// users_select_self_or_approved_peers RLS(0002)가 승인 사용자끼리는 서로 조회를 허용하므로
// 검색 자체는 막힘없이 된다. 다만 실명(name)은 절대 검색/노출 대상에 안 넣는다 — 실명은
// Companion에게만 보여야 하는 정보라(user_display 뷰의 존재 이유), 여기서는 항상 공개인
// nickname으로만 검색하고 nickname만 보여준다. InviteUserPicker(기존 Companion 안에서만
// 검색)와는 목적이 다른 화면이라 새로 만든다.
//
// nickname(문구)은 중복 허용이라 검색 결과에 같은 닉네임이 여러 명 나올 수 있다. 그래서
// 이 화면은 항상 nickname_tag(전체 유일 4자리, 0038)를 함께 보여주고, "닉네임#태그" 형식
// 입력을 지원한다 — 태그만 정확히 넣으면(전체 유일이라) 딱 한 명으로 좁혀진다.
//   입력 예)  명곡탐지견#7914  → 닉네임 부분일치 + 태그 정확일치
//            #7914            → 태그만으로 바로 지목
//            명곡탐지견        → 기존처럼 닉네임 부분일치 (결과에 태그가 같이 보임)
//
// SearchOverlay(오버레이)와 /search 페이지(직접 링크로 들어왔을 때 대비용)가 이 입력+결과
// UI를 그대로 공유한다 — 검색은 "잠깐 들렀다 가는" 가벼운 동작이라 페이지 이동보다 오버레이가
// 더 매끄럽다고 판단해 오버레이를 기본으로 삼았다(/goal 논의 참고).
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { field } from "@/components/ui/styles";
import { ComperBadge } from "@/components/ComperBadge";

type SearchResult = { id: string; nickname: string; nickname_tag: string; role: string };

const SEARCH_DEBOUNCE_MS = 300;
const RESULT_LIMIT = 20;
const TAG_LENGTH = 4;

// "명곡탐지견#7914" / "#7914" / "명곡탐지견" → 닉네임 부분과 태그 부분으로 분리.
// 태그는 숫자만, 최대 4자리로 정규화한다(입력 오타/공백 방어).
function parseQuery(raw: string): { namePart: string; tagPart: string } {
  const trimmed = raw.trim();
  const hashIdx = trimmed.indexOf("#");
  if (hashIdx === -1) return { namePart: trimmed, tagPart: "" };
  const namePart = trimmed.slice(0, hashIdx).trim();
  const tagPart = trimmed
    .slice(hashIdx + 1)
    .replace(/\D/g, "")
    .slice(0, TAG_LENGTH);
  return { namePart, tagPart };
}

type Me = { id: string; nickname: string; nickname_tag: string; role: string };

export function SearchPanel({ onNavigate }: { onNavigate?: () => void }) {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const currentUserId = me?.id ?? null;

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      const { data: row } = await supabase
        .from("users")
        .select("nickname, nickname_tag, role")
        .eq("id", uid)
        .single();
      if (row) setMe({ id: uid, ...row });
    });
  }, [supabase]);

  useEffect(() => {
    const { namePart, tagPart } = parseQuery(query);
    if (!namePart && !tagPart) {
      setResults(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      let request = supabase
        .from("users")
        .select("id, nickname, nickname_tag, role")
        .eq("status", "approved");
      if (tagPart) request = request.eq("nickname_tag", tagPart);
      if (namePart) request = request.ilike("nickname", `%${namePart}%`);
      const { data } = await request.limit(RESULT_LIMIT);
      if (!cancelled) setResults((data ?? []).filter((u) => u.id !== currentUserId));
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, supabase, currentUserId]);

  return (
    <>
      <input
        type="text"
        placeholder="닉네임#태그로 검색 (예: 명곡탐지견#7914)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
        className={`${field} dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-white dark:focus:ring-white`}
      />
      <p className="mt-1.5 px-1 text-xs text-gray-400 dark:text-gray-500">
        닉네임은 겹칠 수 있어요. 프로필의 <span className="font-medium">#태그</span>까지 입력하면 정확히 한 명을 찾을 수 있어요.
      </p>
      <ul className="mt-3 flex max-h-[60vh] flex-col overflow-y-auto">
        {results === null ? null : results.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">일치하는 사용자가 없어요</p>
        ) : (
          results.map((u) => (
            <li key={u.id}>
              <Link
                href={`/profile/${u.id}`}
                onClick={onNavigate}
                className="flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <Avatar userId={u.id} name={u.nickname} className="h-10 w-10 text-sm" />
                <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {u.nickname}
                  {u.role === "admin" ? (
                    <ComperBadge />
                  ) : (
                    <span className="font-normal text-gray-400 dark:text-gray-500">#{u.nickname_tag}</span>
                  )}
                </span>
              </Link>
            </li>
          ))
        )}
      </ul>

      {me && (
        <div className="mt-2 border-t border-gray-100 pt-2 dark:border-gray-800">
          <p className="px-2 pb-1 text-xs text-gray-400 dark:text-gray-500">내 계정</p>
          <Link
            href={`/profile/${me.id}`}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Avatar userId={me.id} name={me.nickname} className="h-10 w-10 text-sm" />
            <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-gray-100">
              {me.nickname}
              {me.role === "admin" ? (
                <ComperBadge />
              ) : (
                <span className="font-normal text-gray-400 dark:text-gray-500">#{me.nickname_tag}</span>
              )}
            </span>
          </Link>
        </div>
      )}
    </>
  );
}

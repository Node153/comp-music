"use client";

// 닉네임 추천 문구를 nickname_phrases 테이블에서 받아온다(관리자가 /admin/nickname-phrases에서 편집).
// - example: 입력칸 placeholder용 예시 하나(로드 후 DB 목록에서 다시 뽑아 갱신)
// - pick(): 주사위 버튼 등에서 부를 때마다 무작위 문구 하나
// DB를 못 읽었으면 NICKNAME_FALLBACK을 쓴다.
// - onReady(pick): 목록 로드가 끝난 뒤(실패 포함) 1회 호출 — 가입 화면이 닉네임 입력칸을 자동으로
//   채우는 용도. effect 본문에서 바로 setState하지 않고 여기서 채우게 해 불필요한 재렌더를 피한다.
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { NICKNAME_FALLBACK } from "@/lib/nicknameExamples";

function randomOf(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

export function useNicknamePhrases(onReady?: (pick: () => string) => void) {
  const listRef = useRef<string[]>(NICKNAME_FALLBACK);
  const [example, setExample] = useState(() => randomOf(NICKNAME_FALLBACK));

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("nickname_phrases")
      .select("phrase")
      .eq("active", true)
      .then(({ data }) => {
        const list = (data ?? []).map((r) => r.phrase);
        if (cancelled) return;
        if (list.length > 0) {
          listRef.current = list;
          setExample(randomOf(list));
        }
        onReady?.(() => randomOf(listRef.current));
      });
    return () => {
      cancelled = true;
    };
    // onReady는 매 렌더 새 함수지만 의미상 마운트 시 1회 — deps 비움.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    example,
    pick: () => randomOf(listRef.current),
  };
}

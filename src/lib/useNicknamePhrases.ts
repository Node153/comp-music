"use client";

// 닉네임 추천 문구를 nickname_phrases 테이블에서 받아온다(관리자가 /admin/nickname-phrases에서 편집).
// - example: 입력칸 placeholder용 예시 하나(로드 후 DB 목록에서 다시 뽑아 갱신)
// - pick(): 주사위 버튼 등에서 부를 때마다 무작위 문구 하나
// DB를 못 읽었으면 NICKNAME_FALLBACK을 쓴다.
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { NICKNAME_FALLBACK } from "@/lib/nicknameExamples";

function randomOf(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

export function useNicknamePhrases() {
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
        if (!cancelled && list.length > 0) {
          listRef.current = list;
          setExample(randomOf(list));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    example,
    pick: () => randomOf(listRef.current),
  };
}

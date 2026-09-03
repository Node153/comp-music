import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// 운영자(comper) 계정 id 집합. 회원에게 보이는 이름 옆에 comper 뱃지를 붙이고
// 태그번호를 숨기는 데 쓴다. 관리자는 극소수라 한 쿼리로 충분하고, React cache()로
// 요청당 1회만 조회한다.
export const getAdminIds = cache(async (): Promise<Set<string>> => {
  const supabase = await createClient();
  const { data } = await supabase.from("users").select("id").eq("role", "admin");
  return new Set((data ?? []).map((r) => r.id));
});

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// conversations.UNIQUE(user_a_id, user_b_id)는 순서에 의존하므로, 항상 사전순으로 정렬해
// (A,B)/(B,A)가 서로 다른 대화방으로 중복 생성되는 것을 막는다.
export async function findOrCreateConversation(
  supabase: SupabaseClient<Database>,
  userIdA: string,
  userIdB: string,
): Promise<string> {
  const [a, b] = [userIdA, userIdB].sort();

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_a_id", a)
    .eq("user_b_id", b)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ user_a_id: a, user_b_id: b })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(error?.message ?? "대화방을 생성할 수 없습니다.");
  }

  return created.id;
}

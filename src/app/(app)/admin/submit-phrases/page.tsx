import { createClient } from "@/lib/supabase/server";
import { pageTitle, mutedText } from "@/components/ui/styles";
import { PhraseListManager } from "@/components/admin/PhraseListManager";

// 관리자 - 업로드(게시하기) 버튼 문구 관리. role=admin만 접근(proxy.ts에서 가드).
// 업로드 화면을 열 때마다 '노출' 문구 중 하나가 랜덤으로 버튼에 뜬다.
export default async function AdminSubmitPhrasesPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("submit_phrases")
    .select("id, phrase, sort_order, active")
    .order("sort_order", { ascending: true });

  return (
    <main className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className={pageTitle}>게시하기 문구 관리</h1>
        <p className={mutedText}>
          업로드 화면의 &lsquo;게시하기&rsquo; 버튼에 &lsquo;노출&rsquo; 상태인 문구 중 하나가 랜덤으로 표시됩니다.
        </p>
      </div>

      <PhraseListManager table="submit_phrases" initial={rows ?? []} placeholder="게시하기 버튼 문구" />
    </main>
  );
}

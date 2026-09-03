import { createClient } from "@/lib/supabase/server";
import { pageTitle, mutedText } from "@/components/ui/styles";
import { PhraseListManager } from "@/components/admin/PhraseListManager";

// 관리자 - 닉네임 추천 문구 관리. role=admin만 접근(proxy.ts에서 가드).
// 가입·온보딩·프로필수정 화면의 닉네임 입력칸 예시 + '다시 뽑기'가 '노출' 문구 중 하나를 랜덤으로 쓴다.
export default async function AdminNicknamePhrasesPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("nickname_phrases")
    .select("id, phrase, sort_order, active")
    .order("sort_order", { ascending: true });

  return (
    <main className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className={pageTitle}>닉네임 추천 문구 관리</h1>
        <p className={mutedText}>
          가입·온보딩·프로필 수정 화면의 닉네임 입력칸 예시와 &lsquo;다시 뽑기&rsquo; 버튼이 &lsquo;노출&rsquo; 상태인 문구 중 하나를 랜덤으로 씁니다. 띄어쓰기는 쓸 수 없어요.
        </p>
      </div>

      <PhraseListManager table="nickname_phrases" initial={rows ?? []} placeholder="닉네임 추천 문구 (예: 명곡탐지견)" />
    </main>
  );
}

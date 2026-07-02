// S5 심사 상태 안내 (대기/반려 공용, Phase 0은 3단계만 사용 — 1.4)
// 미승인 사용자가 middleware에서 리다이렉트되는 유일한 접근 가능 화면
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function StatusPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("status")
    .eq("id", user.id)
    .single();

  const status = profile?.status ?? "pending";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6 text-center">
      {status === "pending" && (
        <>
          <h1 className="text-xl font-semibold">심사 대기 중이에요</h1>
          <p className="text-sm text-gray-500">평균 심사 기한은 48시간입니다 (0-5).</p>
        </>
      )}
      {status === "rejected" && (
        <>
          <h1 className="text-xl font-semibold">인증이 반려되었어요</h1>
          {/* Phase 0: 재심사 자동화 플로우 없음 — 이메일 문의 안내 (1.4) */}
          <p className="text-sm text-gray-500">
            문의사항은 이메일로 남겨주세요. 운영자가 직접 확인 후 안내드립니다.
          </p>
        </>
      )}
    </main>
  );
}

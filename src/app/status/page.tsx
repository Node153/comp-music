// S5 심사 상태 안내 (대기/반려 공용, Phase 0은 3단계만 사용 — 1.4)
// 미승인 사용자가 proxy.ts에서 리다이렉트되는 접근 가능 화면 중 하나
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/LogoutButton";
import { NotifyAdminOnSignup } from "@/components/NotifyAdminOnSignup";
import { pageTitle, mutedText } from "@/components/ui/styles";
import { DOCUMENT_VERIFICATION_ENABLED } from "@/lib/featureFlags";

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

  // 서류 심사가 꺼져있으면(featureFlags.ts) verifications 행 자체가 안 생기므로 그 존재 여부로
  // "서류 제출 전/후"를 가를 수 없다 — 이 경우 pending은 무조건 "심사 대기 중"으로 취급한다
  // (프로필 정보 입력이 곧 제출이라 더 낼 서류가 없음).
  const { data: latestVerification } = DOCUMENT_VERIFICATION_ENABLED
    ? await supabase
        .from("verifications")
        .select("reject_reason")
        .eq("user_id", user.id)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 p-6 text-center">
      {/* 심사 대기 상태로 이 화면에 처음 들어온 시점에 관리자에게 Discord 알림을 한 번
          보낸다(#8). 실제 발송/중복 방지는 서버가 판단 — 여기선 트리거만. */}
      {status === "pending" && <NotifyAdminOnSignup />}
      {status === "pending" && DOCUMENT_VERIFICATION_ENABLED && !latestVerification && (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-2xl">
            📄
          </div>
          <h1 className={pageTitle}>아직 인증 서류를 제출하지 않았어요</h1>
          <Link
            href="/verify/type"
            className="mt-2 rounded-xl bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            인증 서류 제출하기
          </Link>
        </>
      )}
      {status === "pending" && (!DOCUMENT_VERIFICATION_ENABLED || latestVerification) && (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-2xl">
            ⏳
          </div>
          <h1 className={pageTitle}>심사 대기 중이에요</h1>
          <p className={mutedText}>평균 심사 기한은 48시간입니다.</p>
        </>
      )}
      {status === "withdrawn" && (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-2xl">
            👋
          </div>
          <h1 className={pageTitle}>탈퇴 처리되었어요</h1>
          <p className={mutedText}>그동안 이용해주셔서 감사했어요.</p>
        </>
      )}
      {status === "rejected" && (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl">
            ❌
          </div>
          <h1 className={pageTitle}>인증이 반려되었어요</h1>
          {latestVerification?.reject_reason && (
            <p className="text-sm text-gray-700">사유: {latestVerification.reject_reason}</p>
          )}
          {/* Phase 0: 재심사 자동화 플로우 없음 — 이메일 문의 안내 (1.4) */}
          <p className={mutedText}>문의사항은 이메일로 남겨주세요. 운영자가 직접 확인 후 안내드립니다.</p>
        </>
      )}
      <div className="mt-4">
        <LogoutButton />
      </div>
    </main>
  );
}

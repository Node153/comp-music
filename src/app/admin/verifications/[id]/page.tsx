// S18 관리자 - 심사 상세 (AUTH-06, ADMIN-02)
// Phase 0: 서류는 인라인 뷰어 대신 새 창에서 열기(1.4 저비용안)
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, badge, card, mutedText } from "@/components/ui/styles";
import { AdminReviewForm } from "./AdminReviewForm";

const SIGNED_URL_EXPIRY_SECONDS = 60 * 10;

export default async function AdminVerificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: verification } = await supabase
    .from("verifications")
    .select("id, user_id, type, status, documents, reject_reason, submitted_at")
    .eq("id", id)
    .single();

  if (!verification) notFound();

  const { data: user } = await supabase
    .from("users")
    .select("name, email")
    .eq("id", verification.user_id)
    .single();

  const documentLinks = await Promise.all(
    verification.documents.map(async (doc) => {
      if (doc.doc_type === "music_link") {
        return { ...doc, href: doc.file_url };
      }
      const { data } = await supabase.storage
        .from("verification-documents")
        .createSignedUrl(doc.file_url, SIGNED_URL_EXPIRY_SECONDS);
      return { ...doc, href: data?.signedUrl ?? null };
    }),
  );

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className={pageTitle}>심사 상세</h1>

      <div className={`mt-4 flex flex-col gap-2 ${card}`}>
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-900">{user?.name ?? "-"}</span>
          <span className={badge}>{verification.type === "student" ? "전공생" : "활동자"}</span>
        </div>
        <p className={mutedText}>{user?.email ?? "-"}</p>
        <p className={mutedText}>
          제출일: {new Date(verification.submitted_at).toLocaleString("ko-KR")}
        </p>
        <p className={mutedText}>상태: {verification.status}</p>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {documentLinks.map((doc, i) =>
          doc.href ? (
            <a
              key={i}
              href={doc.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-medium text-blue-600 transition hover:bg-gray-50"
            >
              {doc.doc_type}
              <span className="text-xs text-gray-400">새 창에서 열기 ↗</span>
            </a>
          ) : (
            <p key={i} className="text-sm text-red-600">
              {doc.doc_type}: 파일을 불러올 수 없습니다
            </p>
          ),
        )}
      </div>

      {verification.status === "pending" ? (
        <AdminReviewForm verificationId={verification.id} userId={verification.user_id} />
      ) : (
        <p className={`mt-6 ${mutedText}`}>
          이미 처리된 심사입니다{verification.reject_reason ? ` (사유: ${verification.reject_reason})` : ""}.
        </p>
      )}
    </main>
  );
}

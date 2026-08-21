import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, pageCard } from "@/components/ui/styles";

// Companion 목록(0017_companions) — 팔로워/팔로잉 두 탭이던 follows 페이지를 대체.
// 맞팔 전용이라 목록이 하나뿐이고, accepted 관계만 보여준다(본인 프로필이면 받은 신청도 위에 표시
// — companions_select RLS가 pending 행을 당사자에게만 보여주므로 남의 프로필에선 자동으로 빈다).
export default async function CompanionsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const supabase = await createClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  const isOwnProfile = currentUser?.id === userId;

  const { data: rows } = await supabase
    .from("companions")
    .select("requester_id, addressee_id, status")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  const accepted = (rows ?? []).filter((r) => r.status === "accepted");
  // 받은 신청(수락 대기)은 본인 프로필에서만 노출 — 수락/거절은 상대 프로필에서.
  const incoming = isOwnProfile
    ? (rows ?? []).filter((r) => r.status === "pending" && r.addressee_id === userId)
    : [];

  const otherId = (r: { requester_id: string; addressee_id: string }) =>
    r.requester_id === userId ? r.addressee_id : r.requester_id;
  const otherUserIds = [...new Set([...accepted, ...incoming].map(otherId))];

  // 이름은 user_display 뷰(0018) — accepted Companion은 실명, 받은 신청(아직 비Companion)은 닉네임.
  const { data: users } =
    otherUserIds.length > 0
      ? await supabase.from("user_display").select("id, display_name").in("id", otherUserIds)
      : { data: [] };
  const { data: profiles } =
    otherUserIds.length > 0
      ? await supabase
          .from("profiles")
          .select("user_id, school, school_public, instruments")
          .in("user_id", otherUserIds)
      : { data: [] };
  const userMap = new Map((users ?? []).map((u) => [u.id, u]));
  const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  function renderRow(id: string) {
    const u = userMap.get(id);
    if (!u) return null;
    const profile = profileMap.get(id);
    return (
      <li key={id}>
        <Link
          href={`/profile/${id}`}
          className="flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-gray-50"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-500">
            {u.display_name.slice(0, 1)}
          </span>
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-medium text-gray-900">{u.display_name}</span>
            {(() => {
              const visibleSchool = profile?.school_public ? profile.school : null;
              return (visibleSchool || (profile?.instruments ?? []).length > 0) ? (
                <span className="text-xs text-gray-500">
                  {[visibleSchool, ...(profile?.instruments ?? [])].filter(Boolean).join(" · ")}
                </span>
              ) : null;
            })()}
          </div>
        </Link>
      </li>
    );
  }

  return (
    <main className={pageCard}>
      <h1 className={pageTitle}>
        {isOwnProfile ? "나의 Companion" : "Companion"}{" "}
        <span className="text-gray-400">{accepted.length}명</span>
      </h1>

      {incoming.length > 0 && (
        <section className="mt-4">
          <h2 className="text-sm font-semibold text-gray-500">받은 신청 {incoming.length}건</h2>
          <ul className="mt-1 flex flex-col">{incoming.map((r) => renderRow(otherId(r)))}</ul>
        </section>
      )}

      <ul className="mt-2 flex flex-col">
        {accepted.map((r) => renderRow(otherId(r)))}
        {accepted.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">아직 Companion이 없습니다</p>
        )}
      </ul>
    </main>
  );
}

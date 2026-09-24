import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { pageTitle, mutedText } from "@/components/ui/styles";

// 관리자 - 반응 대기(0076, 파일럿 운영용). 최근 7일 DEMO 중 다른 사람 반응(좋아요·댓글·Kick)이
// 적은 순으로 — 운영진이 "새 글은 2시간 안에 반드시 첫 반응"을 지키기 위한 목록이다. 새 DEMO가
// 올라오면 Discord로도 알림이 온다(lib/progressNotify.ts alertAdminsNewDrop).
// 접근 제어는 proxy.ts(/admin/*는 role=admin만). 집계는 service_role로 한 번에 읽는다.

const WINDOW_DAYS = 7;
const SLA_HOURS = 2;

function hoursSince(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

function windowStartISO() {
  return new Date(Date.now() - WINDOW_DAYS * 24 * 3_600_000).toISOString();
}

function formatAge(iso: string) {
  const h = hoursSince(iso);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}분`;
  if (h < 48) return `${Math.floor(h)}시간`;
  return `${Math.floor(h / 24)}일`;
}

export default async function AwaitingReactionsPage() {
  const admin = createAdminClient();
  const since = windowStartISO();

  const { data: posts } = await admin
    .from("posts")
    .select("id, user_id, title, caption, published_at, created_at")
    .eq("status", "published")
    .eq("visibility", "public")
    .gt("published_at", since)
    .order("published_at", { ascending: false })
    .limit(200);
  const rows = posts ?? [];
  const ids = rows.map((p) => p.id);
  const authorIds = [...new Set(rows.map((p) => p.user_id))];

  const [{ data: likes }, { data: comments }, { data: kicks }, { data: plays }, { data: authors }] =
    ids.length > 0
      ? await Promise.all([
          admin.from("likes").select("post_id, user_id").in("post_id", ids),
          admin.from("comments").select("post_id, user_id").in("post_id", ids),
          admin.from("kicks").select("post_id, user_id").in("post_id", ids),
          admin.from("post_plays").select("post_id, user_id").in("post_id", ids),
          admin.from("users").select("id, nickname").in("id", authorIds),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const authorOf = new Map(rows.map((p) => [p.id, p.user_id]));
  const nicknameOf = new Map((authors ?? []).map((a) => [a.id, a.nickname]));
  function countOthers(list: { post_id: string; user_id: string }[] | null) {
    const m = new Map<string, number>();
    for (const r of list ?? []) {
      if (authorOf.get(r.post_id) === r.user_id) continue;
      m.set(r.post_id, (m.get(r.post_id) ?? 0) + 1);
    }
    return m;
  }
  const likeCount = countOthers(likes);
  const commentCount = countOthers(comments);
  const kickCount = countOthers(kicks);
  const playCount = countOthers(plays);

  const items = rows
    .map((p) => {
      const reactions = (likeCount.get(p.id) ?? 0) + (commentCount.get(p.id) ?? 0) + (kickCount.get(p.id) ?? 0);
      const publishedAt = p.published_at ?? p.created_at;
      return { ...p, publishedAt, reactions, overdue: reactions === 0 && hoursSince(publishedAt) >= SLA_HOURS };
    })
    // 반응 적은 순 → 같은 수면 오래 기다린 순.
    .sort((a, b) => a.reactions - b.reactions || a.publishedAt.localeCompare(b.publishedAt));
  const zeroCount = items.filter((i) => i.reactions === 0).length;
  const overdueCount = items.filter((i) => i.overdue).length;

  return (
    <main>
      <h1 className={pageTitle}>반응 대기</h1>
      <p className={`${mutedText} mt-1`}>
        최근 {WINDOW_DAYS}일 DEMO를 반응 적은 순으로 보여줘요. 파일럿 동안은 새 글에 {SLA_HOURS}시간 안에 첫 반응을
        남겨주세요 — 첫 반응을 받은 사람이 다음 글을 올립니다.
      </p>
      <div className="mt-4 flex gap-2 text-sm">
        <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">반응 0개 {zeroCount}건</span>
        <span
          className={`rounded-full px-3 py-1 ${overdueCount > 0 ? "bg-red-100 font-semibold text-red-700" : "bg-gray-100 text-gray-700"}`}
        >
          {SLA_HOURS}시간 넘게 반응 없음 {overdueCount}건
        </span>
      </div>

      {items.length === 0 ? (
        <p className={`${mutedText} mt-8`}>최근 {WINDOW_DAYS}일 동안 올라온 DEMO가 없어요.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">경과</th>
                <th className="px-3 py-2 font-medium">작성자</th>
                <th className="px-3 py-2 font-medium">제목</th>
                <th className="px-3 py-2 text-right font-medium">좋아요</th>
                <th className="px-3 py-2 text-right font-medium">댓글</th>
                <th className="px-3 py-2 text-right font-medium">Kick</th>
                <th className="px-3 py-2 text-right font-medium">청취자</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((p) => (
                <tr key={p.id} className={p.overdue ? "bg-red-50" : ""}>
                  <td className={`whitespace-nowrap px-3 py-2 ${p.overdue ? "font-semibold text-red-700" : "text-gray-600"}`}>
                    {formatAge(p.publishedAt)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-800">{nicknameOf.get(p.user_id) ?? "-"}</td>
                  <td className="max-w-[240px] truncate px-3 py-2 text-gray-900">{p.title || p.caption || "(제목 없음)"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{likeCount.get(p.id) ?? 0}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{commentCount.get(p.id) ?? 0}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{kickCount.get(p.id) ?? 0}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{playCount.get(p.id) ?? 0}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <Link href={`/feed?feed=completion#${p.id}`} className="font-medium text-blue-600 hover:underline">
                      보러 가기
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

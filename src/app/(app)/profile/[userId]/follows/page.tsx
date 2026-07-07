import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, pageCard } from "@/components/ui/styles";

// S11 팔로워/팔로잉 목록 (PROFILE-03)
export default async function FollowsPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { userId } = await params;
  const { tab: tabParam } = await searchParams;
  const tab = tabParam === "following" ? "following" : "followers";
  const supabase = await createClient();

  const { data: followRows } = await supabase
    .from("follows")
    .select("follower_id, followee_id")
    .eq(tab === "followers" ? "followee_id" : "follower_id", userId);

  const otherUserIds = (followRows ?? []).map((row) =>
    tab === "followers" ? row.follower_id : row.followee_id,
  );

  const { data: users } =
    otherUserIds.length > 0
      ? await supabase.from("users").select("id, name").in("id", otherUserIds)
      : { data: [] };
  const { data: profiles } =
    otherUserIds.length > 0
      ? await supabase.from("profiles").select("user_id, school, major").in("user_id", otherUserIds)
      : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  return (
    <main className={pageCard}>
      <h1 className={pageTitle}>팔로워 / 팔로잉</h1>
      <div className="mt-4 flex gap-6 border-b border-gray-200 text-sm">
        <Link
          href={`/profile/${userId}/follows?tab=followers`}
          className={`-mb-px border-b-2 pb-2.5 font-medium ${tab === "followers" ? "border-black text-gray-900" : "border-transparent text-gray-400"}`}
        >
          팔로워
        </Link>
        <Link
          href={`/profile/${userId}/follows?tab=following`}
          className={`-mb-px border-b-2 pb-2.5 font-medium ${tab === "following" ? "border-black text-gray-900" : "border-transparent text-gray-400"}`}
        >
          팔로잉
        </Link>
      </div>

      <ul className="mt-2 flex flex-col">
        {(users ?? []).map((u) => {
          const profile = profileMap.get(u.id);
          return (
            <li key={u.id}>
              <Link
                href={`/profile/${u.id}`}
                className="flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-gray-50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-500">
                  {u.name.slice(0, 1)}
                </span>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-medium text-gray-900">{u.name}</span>
                  {(profile?.school || profile?.major) && (
                    <span className="text-xs text-gray-500">
                      {[profile?.school, profile?.major].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
        {(users ?? []).length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">
            {tab === "followers" ? "팔로워가 없습니다" : "팔로잉이 없습니다"}
          </p>
        )}
      </ul>
    </main>
  );
}

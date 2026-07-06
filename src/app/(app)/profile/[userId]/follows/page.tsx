import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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
    <main className="mx-auto max-w-sm p-6 pb-20">
      <h1 className="text-xl font-semibold">팔로워 / 팔로잉</h1>
      <div className="mt-4 flex gap-4 border-b text-sm">
        <Link
          href={`/profile/${userId}/follows?tab=followers`}
          className={`pb-2 ${tab === "followers" ? "border-b-2 border-black font-medium" : "text-gray-400"}`}
        >
          팔로워
        </Link>
        <Link
          href={`/profile/${userId}/follows?tab=following`}
          className={`pb-2 ${tab === "following" ? "border-b-2 border-black font-medium" : "text-gray-400"}`}
        >
          팔로잉
        </Link>
      </div>

      <ul className="mt-4 flex flex-col gap-3">
        {(users ?? []).map((u) => {
          const profile = profileMap.get(u.id);
          return (
            <li key={u.id}>
              <Link href={`/profile/${u.id}`} className="flex items-center justify-between">
                <span className="text-sm font-medium">{u.name}</span>
                {(profile?.school || profile?.major) && (
                  <span className="text-xs text-gray-500">
                    {[profile?.school, profile?.major].filter(Boolean).join(" · ")}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
        {(users ?? []).length === 0 && (
          <p className="py-6 text-center text-sm text-gray-400">
            {tab === "followers" ? "팔로워가 없습니다" : "팔로잉이 없습니다"}
          </p>
        )}
      </ul>
    </main>
  );
}

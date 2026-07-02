// S9 프로필 (본인/타인 분기, FEED-10 프로필 피드 = 본인 게시물 그리드)
// 타인이 볼 때는 visibility 조건 충족 게시물만 노출(현재 posts.visibility='public' 고정이라 Phase 0에선 전체 노출)
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  return (
    <main className="mx-auto max-w-lg p-6">
      {/* TODO: profiles + users 조회, 아바타/이름/학교·전공·악기 뱃지/소개글/팔로워·팔로잉 수 */}
      <h1 className="text-xl font-semibold">프로필</h1>
      <p className="text-sm text-gray-500">user_id: {userId}</p>
      {/* TODO: posts where user_id=userId and status in ('published','expired') 그리드 */}
      <div className="mt-6 grid grid-cols-3 gap-1">
        {/* thumbnail grid */}
      </div>
    </main>
  );
}

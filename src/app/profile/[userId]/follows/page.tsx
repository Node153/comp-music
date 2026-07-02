// S11 팔로워/팔로잉 목록 (PROFILE-03)
export default async function FollowsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-semibold">팔로워 / 팔로잉</h1>
      <p className="text-sm text-gray-500">user_id: {userId}</p>
      {/* TODO: follows where follower_id/followee_id=userId, 탭 전환 */}
    </main>
  );
}

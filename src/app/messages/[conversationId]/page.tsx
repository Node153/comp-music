// S13 DM 대화창 (DM-01, DM-03)
// 게시물에서 시작된 DM은 첫 메시지의 source_post_id를 대화 상단에 썸네일로 고정 노출
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;

  return (
    <main className="mx-auto flex h-screen max-w-sm flex-col p-6">
      <h1 className="text-lg font-semibold">대화</h1>
      <p className="text-sm text-gray-500">conversation_id: {conversationId}</p>
      {/* TODO: messages where conversation_id=conversationId, Supabase Realtime 구독 */}
      <div className="flex-1 overflow-y-auto" />
      <form className="mt-2 flex gap-2">
        <input type="text" placeholder="메시지 보내기" className="flex-1 rounded border px-3 py-2" />
        <button type="submit" className="rounded bg-black px-3 py-2 text-white">
          전송
        </button>
      </form>
    </main>
  );
}

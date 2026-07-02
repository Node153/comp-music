// S12 DM 목록 (DM-02)
export default function MessagesPage() {
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-semibold">메시지</h1>
      {/* TODO: conversations where user_a_id/user_b_id=me, order by last_message_at desc, 읽음/안읽음 표시 */}
      <ul className="mt-4 flex flex-col gap-2">
        {/* conversation rows */}
      </ul>
    </main>
  );
}

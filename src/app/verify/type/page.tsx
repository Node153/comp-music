// S3 인증유형 선택 (AUTH-02)
export default function VerifyTypePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">어떤 유형으로 인증할까요?</h1>
      {/* 선택 결과에 따라 /verify/documents 에서 동적 폼 분기 (AUTH-03) */}
      <div className="flex flex-col gap-3">
        <button className="rounded border px-3 py-2 text-left">전공생</button>
        <button className="rounded border px-3 py-2 text-left">활동자</button>
      </div>
    </main>
  );
}

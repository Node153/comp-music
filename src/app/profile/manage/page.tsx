// S16 마이 게시물 관리 (PROFILE-04, S9의 본인 전용 관리 모드)
// Phase 0: visibility가 public 고정이라 공개범위 변경 컨트롤은 없음(Phase 1에서 FEED-03 5단계와 함께 추가).
// 삭제(FEED-11)는 Phase 0에도 포함 — 하드 삭제, 복구 불가 확인 단계 필수.
export default function ManagePostsPage() {
  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="text-xl font-semibold">내 게시물 관리</h1>
      {/* TODO: posts where user_id=me, status in ('published','expired') 시간순 그리드 */}
      <div className="mt-6 grid grid-cols-3 gap-1">
        {/* 각 썸네일 롱프레스/케밥메뉴 → 삭제(FEED-11, 하드삭제 확인 모달) */}
      </div>
    </main>
  );
}

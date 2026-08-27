"use client";

// 직접 링크(/search)로 들어왔을 때를 대비한 폴백 페이지 — 평소엔 SearchOverlay(오버레이)가
// 기본 진입점이고(TopNav/BottomNav/메시지 작성 버튼), 실제 입력/결과 UI는 SearchPanel로
// 공유한다(/goal 검색 UX 논의 참고).
import { pageTitle, pageCard } from "@/components/ui/styles";
import { SearchPanel } from "@/components/SearchPanel";

export default function SearchPage() {
  return (
    <main className={pageCard}>
      <h1 className={pageTitle}>검색</h1>
      <div className="mt-3">
        <SearchPanel />
      </div>
    </main>
  );
}

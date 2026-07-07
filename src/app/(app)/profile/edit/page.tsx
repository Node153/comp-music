import { Button } from "@/components/ui/Button";
import { field, label, pageTitle, pageCard } from "@/components/ui/styles";

// S10 프로필 수정 (PROFILE-01, 본인만 접근)
export default function ProfileEditPage() {
  return (
    <main className={`${pageCard} flex flex-col gap-6`}>
      <h1 className={pageTitle}>프로필 수정</h1>
      {/* TODO: profiles upsert — school, major, instruments, region, collab_available, bio, portfolio_links */}
      <form className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className={label}>학교</span>
          <input type="text" placeholder="학교명" className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={label}>전공</span>
          <input type="text" placeholder="전공명" className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={label}>지역</span>
          <input type="text" placeholder="활동 지역" className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={label}>소개글</span>
          <textarea placeholder="나를 소개해주세요" rows={3} className={field} />
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-3 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-black" /> 협업 가능
        </label>
        <Button type="submit" className="mt-1 w-full">
          저장
        </Button>
      </form>
    </main>
  );
}

import Link from "next/link";
import { Avatar } from "@/components/Avatar";

// 프로필 "Companion" 탭(페이스북 친구 탭 참고) — 최대 9명 미리보기 그리드만 보여주고,
// 신청 수락/거절 등 실제 로직은 그대로 /profile/[userId]/companions 풀 페이지에 둔다.
// compact(2026-09) — 데스크톱 왼쪽 사이드바 전용. 사이드바가 세로로 너무 길어 보인다는
// 피드백으로, 이름까지 붙는 3열 그리드 대신 헤더 통계 줄과 같은 겹친 아바타 한 줄로 줄인다.
// 모바일 "Companion" 탭은 전용 공간이라 기존 그리드(compact=false, 기본값)를 그대로 쓴다.
export type CompanionPerson = { id: string; display_name: string };

export function CompanionPreview({
  userId,
  isOwnProfile,
  count,
  people,
  compact = false,
}: {
  userId: string;
  isOwnProfile: boolean;
  count: number;
  people: CompanionPerson[];
  compact?: boolean;
}) {
  if (compact) {
    return (
      <Link href={`/profile/${userId}/companions`} className="flex items-center gap-2 hover:underline">
        {people.length > 0 && (
          <span className="flex -space-x-2">
            {people.slice(0, 5).map((person) => (
              <Avatar
                key={person.id}
                userId={person.id}
                name={person.display_name}
                className="h-6 w-6 border-2 border-box-gray text-[10px]"
              />
            ))}
          </span>
        )}
        <span className="text-sm text-black">
          {isOwnProfile ? "나의 Companion" : "Companion"} <span className="font-semibold">{count}명</span>
        </span>
      </Link>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-black">
          {isOwnProfile ? "나의 Companion" : "Companion"} <span className="font-semibold">{count}명</span>
        </p>
        <Link href={`/profile/${userId}/companions`} className="text-xs text-active-gray hover:underline">
          전체보기
        </Link>
      </div>

      {people.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {people.map((person) => (
            <Link
              key={person.id}
              href={`/profile/${person.id}`}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-box-gray px-2 py-3 text-center transition hover:opacity-90"
            >
              <Avatar userId={person.id} name={person.display_name} className="h-12 w-12 text-lg" />
              <span className="line-clamp-1 text-xs text-black">{person.display_name}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-active-gray">아직 Companion이 없습니다</p>
      )}
    </div>
  );
}

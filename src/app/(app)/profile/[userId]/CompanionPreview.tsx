import Link from "next/link";
import { Avatar } from "@/components/Avatar";

// 프로필 "Companion" 탭(페이스북 친구 탭 참고) — 최대 9명 미리보기 그리드만 보여주고,
// 신청 수락/거절 등 실제 로직은 그대로 /profile/[userId]/companions 풀 페이지에 둔다.
// card(0075, 페이스북 프로필 "친구" 카드 참고) — 데스크톱 왼쪽 컬럼 전용. 예전 compact(겹친
// 아바타 한 줄)는 사이드바가 길어 보인다는 피드백으로 줄였던 것인데, 페이스북 프로필 레이아웃을
// 그대로 따르기로 하면서(사용자 요청) 제목+"모두 보기"+3열 사진 그리드 카드로 바꿨다.
// 모바일 "Companion" 탭은 전용 공간이라 기존 그리드(card=false, 기본값)를 그대로 쓴다.
export type CompanionPerson = { id: string; display_name: string };

export function CompanionPreview({
  userId,
  isOwnProfile,
  count,
  people,
  card = false,
}: {
  userId: string;
  isOwnProfile: boolean;
  count: number;
  people: CompanionPerson[];
  card?: boolean;
}) {
  if (card) {
    return (
      <section className="rounded-xl border border-box-gray p-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-black">Companion</h2>
            <p className="text-sm text-active-gray">
              {isOwnProfile ? "나의 Companion" : "Companion"} {count}명
            </p>
          </div>
          <Link href={`/profile/${userId}/companions`} className="text-sm text-black hover:underline">
            모두 보기
          </Link>
        </div>
        {people.length > 0 ? (
          <div className="mt-3 grid grid-cols-3 gap-x-2 gap-y-3">
            {people.map((person) => (
              <Link key={person.id} href={`/profile/${person.id}`} className="group flex min-w-0 flex-col gap-1">
                <Avatar
                  userId={person.id}
                  name={person.display_name}
                  className="aspect-square h-auto w-full !rounded-lg text-2xl transition group-hover:opacity-90"
                />
                <span className="truncate text-xs font-semibold text-black">{person.display_name}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-active-gray">아직 Companion이 없습니다</p>
        )}
      </section>
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

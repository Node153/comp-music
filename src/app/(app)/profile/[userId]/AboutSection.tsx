// 프로필 "소개" 탭(페이스북 About 참고) — 헤더의 짧은 소개 요약 줄보다 더 자세한 정보를 보여준다.
// 공개범위 게이트는 헤더와 동일한 패턴: `필드_public || isOwnProfile`. 토글이 없는 필드
// (포지션/좋아하는 장르/포트폴리오 링크/소개글)는 항상 노출한다 — 헤더의 포지션 칩과 동일 취급.
// major(전공) 컬럼은 어떤 화면도 더 이상 쓰지 않는 죽은 필드라 여기서도 노출하지 않는다
// (instruments/포지션이 이미 그 역할을 대체함, ProfileDetailsForm.tsx 주석 참고).
// 활동유형/학교/지역은 라벨+값을 줄마다 쌓지 않고 아이콘+한 줄로 압축한다(2026-09, 데스크톱
// 사이드바가 세로로 너무 길어 보인다는 사용자 피드백) — 애플 이모지(🎓🎤🏫📍)도 작은 크기에서
// 깨져 보여서(포트폴리오 링크 🎧가 "..'로 렌더된 버그 발견) 전부 icons.tsx의 선(stroke)
// 아이콘으로 교체.
import { GraduationCapIcon, MicIcon, SchoolIcon, MapPinIcon } from "@/components/icons";
import { ProfileLinks, profileLinkEntries } from "./ProfileLinks";

const USER_TYPE_LABEL: Record<string, string> = {
  student: "전공생",
  activist: "활동자",
};
const USER_TYPE_ICON: Record<string, typeof GraduationCapIcon> = {
  student: GraduationCapIcon,
  activist: MicIcon,
};

export type AboutProfile = {
  user_type: string | null;
  user_type_public: boolean;
  school: string | null;
  school_public: boolean;
  instruments: string[] | null;
  region: string | null;
  region_public: boolean;
  bio: string | null;
  favorite_genres: string[] | null;
  portfolio_links: Record<string, string> | null;
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-box-gray py-3 last:border-b-0">
      <span className="text-xs font-medium text-active-gray">{label}</span>
      <div className="text-sm text-black">{children}</div>
    </div>
  );
}

function Fact({ icon: Icon, children }: { icon: typeof GraduationCapIcon; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm text-black">
      <Icon className="h-4 w-4 shrink-0 text-active-gray" />
      <span>{children}</span>
    </div>
  );
}

export function AboutSection({
  profile,
  isOwnProfile,
  hideLinks = false,
}: {
  profile: AboutProfile | null;
  isOwnProfile: boolean;
  // 데스크톱 왼쪽 컬럼은 링크를 페이스북처럼 별도 "링크" 카드로 빼서(0075) 여기선 숨긴다.
  hideLinks?: boolean;
}) {
  const instruments = profile?.instruments ?? [];
  const favoriteGenres = profile?.favorite_genres ?? [];
  const hasLinks = !hideLinks && profileLinkEntries(profile?.portfolio_links).length > 0;

  const hasAnything =
    (profile?.user_type && (profile.user_type_public || isOwnProfile)) ||
    (profile?.school && (profile.school_public || isOwnProfile)) ||
    (profile?.region && (profile.region_public || isOwnProfile)) ||
    instruments.length > 0 ||
    favoriteGenres.length > 0 ||
    hasLinks ||
    profile?.bio;

  if (!hasAnything) {
    return hideLinks ? (
      <p className="mt-2 text-xs text-active-gray">아직 등록된 소개 정보가 없습니다</p>
    ) : (
      <p className="mt-4 py-10 text-center text-sm text-active-gray">아직 등록된 소개 정보가 없습니다</p>
    );
  }

  const UserTypeIcon = profile?.user_type ? USER_TYPE_ICON[profile.user_type] : null;

  return (
    <div className="mt-2 flex flex-col">
      {(profile?.user_type && (profile.user_type_public || isOwnProfile)) ||
      (profile?.school && (profile.school_public || isOwnProfile)) ||
      (profile?.region && (profile.region_public || isOwnProfile)) ? (
        <div className="flex flex-col gap-1.5 border-b border-box-gray pb-3">
          {profile?.user_type && (profile.user_type_public || isOwnProfile) && UserTypeIcon && (
            <Fact icon={UserTypeIcon}>{USER_TYPE_LABEL[profile.user_type] ?? profile.user_type}</Fact>
          )}
          {profile?.school && (profile.school_public || isOwnProfile) && (
            <Fact icon={SchoolIcon}>{profile.school}</Fact>
          )}
          {profile?.region && (profile.region_public || isOwnProfile) && (
            <Fact icon={MapPinIcon}>{profile.region}</Fact>
          )}
        </div>
      ) : null}
      {instruments.length > 0 && (
        <Row label="포지션">
          <div className="flex flex-wrap gap-1.5">
            {instruments.map((inst) => (
              <span key={inst} className="rounded-full border border-box-gray px-2.5 py-1 text-xs text-black">
                {inst}
              </span>
            ))}
          </div>
        </Row>
      )}
      {favoriteGenres.length > 0 && (
        <Row label="좋아하는 장르">
          <div className="flex flex-wrap gap-1.5">
            {favoriteGenres.map((genre) => (
              <span key={genre} className="rounded-full border border-box-gray px-2.5 py-1 text-xs text-black">
                #{genre}
              </span>
            ))}
          </div>
        </Row>
      )}
      {hasLinks && (
        <Row label="링크">
          <ProfileLinks links={profile?.portfolio_links} />
        </Row>
      )}
      {profile?.bio && <Row label="소개글">{profile.bio}</Row>}
    </div>
  );
}

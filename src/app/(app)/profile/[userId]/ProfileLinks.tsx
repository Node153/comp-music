// 프로필 "링크"(0075, 페이스북 링크 카드 참고) — profiles.portfolio_links(jsonb)의
// soundcloud/youtube/instagram을 도메인 텍스트로 보여준다. 인스타그램은 프로필 수정에서
// @아이디만 넣어도 저장 시점에 URL로 바꿔서 넣으니(ProfileDetailsForm) 여기선 URL만 다룬다.
import { HeadphonesIcon, PlayIcon, InstagramIcon, LinkIcon } from "@/components/icons";

const LINK_META: { key: string; label: string; Icon: typeof LinkIcon }[] = [
  { key: "instagram", label: "Instagram", Icon: InstagramIcon },
  { key: "soundcloud", label: "SoundCloud", Icon: HeadphonesIcon },
  { key: "youtube", label: "YouTube", Icon: PlayIcon },
];

// "https://www.instagram.com/foo/" → "instagram.com/foo" — 페이스북처럼 주소 자체를 보여준다.
function shortUrl(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
}

// http(s)만 링크로 — jsonb라 API로 직접 넣으면 "javascript:" 같은 값도 들어갈 수 있다.
export function profileLinkEntries(links: Record<string, string> | null | undefined) {
  return LINK_META.filter((m) => /^https?:\/\//i.test(links?.[m.key] ?? "")).map((m) => ({
    ...m,
    url: links![m.key],
  }));
}

export function ProfileLinks({ links }: { links: Record<string, string> | null | undefined }) {
  const entries = profileLinkEntries(links);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      {entries.map(({ key, label, Icon, url }) => (
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={label}
          className="flex min-w-0 items-center gap-2.5 text-sm font-medium text-black hover:underline"
        >
          <Icon className="h-5 w-5 shrink-0 text-active-gray" />
          <span className="truncate">{shortUrl(url)}</span>
        </a>
      ))}
    </div>
  );
}

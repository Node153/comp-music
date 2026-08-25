"use client";

// 프로필 사진 — 색깔 이니셜 원은 사진이 없을 때만 쓰는 대체 표시로 남겨두고(avatarColorFor,
// 무채색 하나로 통일됨), 사진이 있으면 무조건 사진이 뜬다. /api/avatar/[userId]가 사진
// 유무를 몰라도 되게 만들어주므로(있으면 리다이렉트, 없으면 404) 호출하는 쪽은 다들 그냥
// <img src={`/api/avatar/${userId}`}>를 시도하고 onError로 실패하면 이니셜 원으로
// 넘어간다 — 서버/클라이언트 컴포넌트 어디서든 똑같이 쓸 수 있다.
import { useState } from "react";
import { avatarColorFor } from "@/lib/presence";

export function Avatar({
  userId,
  name,
  className = "h-9 w-9 text-sm",
}: {
  userId: string;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${avatarColorFor(userId)} ${className}`}
      >
        {name.slice(0, 1)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/avatar/${userId}`}
      alt={name}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full object-cover ${className}`}
    />
  );
}

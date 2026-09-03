"use client";

// 프로필 사진 — 색깔 이니셜 원은 사진이 없을 때만 쓰는 대체 표시로 남겨두고(avatarColorFor,
// 무채색 하나로 통일됨), 사진이 있으면 무조건 사진이 뜬다. /api/avatar/[userId]가 사진
// 유무를 몰라도 되게 만들어주므로(있으면 리다이렉트, 없으면 404) 호출하는 쪽은 다들 그냥
// <img src={`/api/avatar/${userId}`}>를 시도하고 onError로 실패하면 이니셜 원으로
// 넘어간다 — 서버/클라이언트 컴포넌트 어디서든 똑같이 쓸 수 있다.
import { useEffect, useRef, useState } from "react";
import { avatarColorFor } from "@/lib/presence";

export function Avatar({
  userId,
  name,
  className = "h-9 w-9 text-sm",
  version,
}: {
  userId: string;
  name: string;
  className?: string;
  // 사진을 방금 바꾼 화면(ProfilePhotoForm)에서 값을 올려주면 <img> URL이 바뀌어
  // 캐시를 확실히 우회한다. 안 주면 예전과 동일.
  version?: number;
}) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // 서버에서 그려진 <img>가 하이드레이션 전에 이미 404로 실패해버리면(리액트가 onError
  // 리스너를 붙이기 전에 브라우저가 에러 이벤트를 먼저 쏴버림) onError가 다시는 안 불려서
  // 깨진 이미지 아이콘으로 영원히 남는다 — mount 시 이미 실패한 상태인지 한 번 더 확인한다.
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth === 0) {
      setFailed(true);
    }
  }, []);

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
      ref={imgRef}
      src={version ? `/api/avatar/${userId}?v=${version}` : `/api/avatar/${userId}`}
      alt={name}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full object-cover ${className}`}
    />
  );
}

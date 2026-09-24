import { NextResponse } from "next/server";
import { loadStoryPost, renderStoryCard } from "@/lib/storyCard";

export const dynamic = "force-dynamic";

// 인스타그램 스토리 공유용 1080×1920 이미지(ShareButton) — 소리가 없는 이미지 게시물이거나
// /api/story-video가 실패했을 때 쓰는 폴백. 웹에서는 인스타 스토리 편집기를 직접 열 방법이
// 없어서(네이티브 앱의 instagram-stories:// + 전용 pasteboard는 웹이 못 씀) 파일로 OS 공유
// 시트(navigator.share files)에 넘긴다. 레이아웃은 lib/storyCard.tsx.
export async function GET(_request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const post = await loadStoryPost(postId);
  if (!post) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }
  const image = await renderStoryCard(post);
  return new NextResponse(image.body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
    },
  });
}

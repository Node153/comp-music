"use client";

// 재생 화면(GlobalPlayerBar·SoundbarPlayer)이 파형을 얻는 단일 통로(0090, 2026-09-26).
// 1) 게시물이면 post_waveforms(업로드 때 미리 계산해 둔 값)를 Supabase에서 바로 읽는다 — Vercel을 안 거친다.
// 2) 없으면(업로드 때 디코딩 실패·옛 글) 로그인한 회원의 브라우저가 예전 방식(waveform-proxy로 원본을
//    받아 디코딩)으로 딱 한 번 계산해 save_post_waveform으로 채운다. 음원만 — 영상은 파일이 커서 안 한다.
// 3) 게시물이 아닌 파일(합작 채팅 첨부 등)은 저장할 곳이 없어 예전처럼 매번 프록시로 분석한다.
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  STORED_WAVEFORM_BARS,
  computeWaveformBars,
  fromStoredWaveform,
  toStoredWaveform,
} from "@/lib/waveform";

// 전역 바와 카드가 같은 글을 동시에 물어도 조회·분석은 한 번만(페이지를 옮겨도 유지되는 모듈 캐시).
const storedCache = new Map<string, Promise<number[] | null>>();
const healCache = new Map<string, Promise<number[] | null>>();

function loadStoredWaveform(postId: string): Promise<number[] | null> {
  let p = storedCache.get(postId);
  if (!p) {
    p = Promise.resolve(
      createClient().from("post_waveforms").select("bars").eq("post_id", postId).maybeSingle(),
    ).then(({ data, error }) => {
      if (error) {
        storedCache.delete(postId);
        return null;
      }
      return data?.bars ?? null;
    });
    storedCache.set(postId, p);
  }
  return p;
}

async function analyzeSource(src: string, barCount: number): Promise<number[]> {
  // 같은 출처(/... 로컬 파일, blob:)는 바로 fetch, R2 signed URL은 CORS 때문에 서버 프록시 경유.
  const url =
    src.startsWith("/") || src.startsWith("blob:")
      ? src
      : `/api/media/waveform-proxy?url=${encodeURIComponent(src)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("waveform source unavailable");
  return computeWaveformBars(await res.arrayBuffer(), barCount);
}

function healWaveform(postId: string, src: string): Promise<number[] | null> {
  let p = healCache.get(postId);
  if (!p) {
    p = (async () => {
      const supabase = createClient();
      // 게스트는 저장 권한이 없어 매번 원본을 받게 되므로 아예 시도하지 않는다.
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return null;
      const { data: post } = await supabase.from("posts").select("media_type").eq("id", postId).maybeSingle();
      if (post?.media_type !== "audio") return null;
      const stored = toStoredWaveform(await analyzeSource(src, STORED_WAVEFORM_BARS));
      await supabase.rpc("save_post_waveform", { p_post_id: postId, p_bars: stored });
      storedCache.set(postId, Promise.resolve(stored));
      return stored;
    })().catch(() => null);
    healCache.set(postId, p);
  }
  return p;
}

export function usePostWaveform({
  postId,
  src,
  barCount,
  enabled = true,
}: {
  postId?: string | null;
  src?: string | null;
  barCount: number;
  enabled?: boolean;
}): { bars: number[] | null; failed: boolean } {
  // signed URL은 갱신될 때마다 바뀌므로 게시물이면 postId만 결과의 기준으로 삼는다 — URL이 바뀌어도
  // 같은 key라 이미 그린 파형이 사라지지 않고, 조회는 캐시에서 바로 끝난다.
  const key = enabled && src ? `${postId ?? src}:${barCount}` : null;
  const [result, setResult] = useState<{ key: string; bars: number[] | null } | null>(null);

  useEffect(() => {
    if (!key || !src) return;
    let cancelled = false;
    const run = async (): Promise<number[] | null> => {
      if (!postId) return analyzeSource(src, barCount);
      const stored = (await loadStoredWaveform(postId)) ?? (await healWaveform(postId, src));
      return stored ? fromStoredWaveform(stored, barCount) : null;
    };
    run()
      .catch(() => null)
      .then((bars) => {
        if (!cancelled) setResult({ key, bars });
      });
    return () => {
      cancelled = true;
    };
  }, [key, postId, src, barCount]);

  if (!key || result?.key !== key) return { bars: null, failed: false };
  return { bars: result.bars, failed: result.bars === null };
}

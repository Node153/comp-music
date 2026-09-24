"use client";

// "이 기기에서 푸시 알림 받기" 카드(0074) — 알림 설정 화면 맨 위. 상태별로 안내가 다르다:
// iPhone 사파리 탭이면 홈 화면 추가 방법, 권한 차단이면 브라우저 설정 안내, 그 외엔 켜기/끄기.
import { usePushStatus, type PushStatus } from "@/lib/pushClient";
import { openIosInstallGuide } from "@/components/IosInstallGuide";

export function PushSettingsCard() {
  const { status, busy, enable, disable } = usePushStatus();
  return (
    <div className="rounded-2xl bg-box-gray p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-black">이 기기에서 푸시 알림 받기</span>
          <span className="text-xs text-active-gray">{STATUS_TEXT[status]}</span>
        </div>
        {status === "available" && (
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="shrink-0 rounded-full bg-black px-4 py-2 text-xs font-semibold text-white transition hover:opacity-80 disabled:opacity-50"
          >
            켜기
          </button>
        )}
        {status === "subscribed" && (
          <button
            type="button"
            onClick={disable}
            disabled={busy}
            className="shrink-0 rounded-full bg-active-gray/20 px-4 py-2 text-xs font-semibold text-black transition hover:opacity-80 disabled:opacity-50"
          >
            끄기
          </button>
        )}
      </div>

      {status === "ios-needs-install" && (
        <>
          <IosInstallGuide />
          <button
            type="button"
            onClick={openIosInstallGuide}
            className="mt-3 rounded-full bg-black px-4 py-2 text-xs font-semibold text-white transition hover:opacity-80"
          >
            화면으로 따라하기
          </button>
        </>
      )}
      {status === "denied" && (
        <p className="mt-3 text-xs leading-relaxed text-black">
          브라우저에서 알림이 차단돼 있어요. 주소창 왼쪽의 사이트 설정(자물쇠 아이콘)에서 <b>알림</b>을
          &lsquo;허용&rsquo;으로 바꾼 뒤 이 화면을 새로고침해주세요.
        </p>
      )}
    </div>
  );
}

const STATUS_TEXT: Record<PushStatus, string> = {
  loading: "확인하는 중…",
  unsupported: "이 브라우저는 푸시 알림을 지원하지 않아요. 켜둔 알림은 이메일로 보내드려요.",
  "ios-needs-install": "iPhone은 홈 화면에 추가한 Compmusic에서만 푸시를 받을 수 있어요.",
  denied: "알림 권한이 차단돼 있어요.",
  subscribed: "좋아요·댓글·Kick을 받는 즉시 이 기기로 알려드려요.",
  available: "앱을 닫아둬도 반응이 오면 바로 알려드려요.",
};

export function IosInstallGuide() {
  return (
    <ol className="mt-3 flex list-decimal flex-col gap-1 pl-5 text-xs leading-relaxed text-black">
      <li>
        Safari 맨 아래 <b>···</b> 버튼을 누르고 <b>공유</b>를 눌러요(공유 버튼이 바로 보이면 그걸 눌러도 돼요).
      </li>
      <li>
        아래로 내려 <b>홈 화면에 추가</b>를 누르고, &lsquo;웹 앱으로 열기&rsquo;가 켜진 채로 &lsquo;추가&rsquo;를 눌러요.
      </li>
      <li>홈 화면에 생긴 Compmusic 아이콘으로 열고 한 번 더 로그인해요.</li>
      <li>
        <b>알림 설정</b>에서 &lsquo;켜기&rsquo;를 누르면 끝! (iOS 16.4 이상)
      </li>
    </ol>
  );
}

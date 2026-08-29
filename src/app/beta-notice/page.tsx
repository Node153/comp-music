// 베타 서비스 이용 안내 — 사용자가 준 문안을 그대로 반영. terms/privacy/community-guidelines와
// 같은 이유로 로그인 여부와 무관하게 항상 열람 가능해야 하는 법적 고지 문서라 서버 컴포넌트로
// 두고 proxy.ts PUBLIC_PATHS 및 needs_onboarding 예외 목록에도 등록한다(온보딩 화면의 동의
// 체크박스가 새 탭으로 이 페이지를 여는데, 그 새 탭도 같은 로그인 세션을 공유하므로 예외
// 목록에서 빠지면 곧장 /onboarding으로 되튕겨버린다 — 0041 즈음 겪었던 것과 같은 함정).
import { pageTitle, sectionTitle, mutedText } from "@/components/ui/styles";

const EFFECTIVE_DATE = "2026-08-20";
const CONTACT_EMAIL = "jtaein0723@gmail.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className={sectionTitle}>{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}

export default function BetaNoticePage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className={pageTitle}>베타 서비스 이용 안내</h1>
        <p className={mutedText}>시행일: {EFFECTIVE_DATE}</p>
      </div>

      <p className="text-sm leading-relaxed text-gray-700">
        Comp는 현재 정식 출시 전 기능과 안정성을 개선하기 위한 베타 서비스로 운영되고 있습니다.
        베타 기간에는 이용자 피드백과 운영상 필요에 따라 서비스의 기능, 화면 구성, 운영 방식 및
        정책이 수시로 변경될 수 있습니다.
      </p>

      <Section title="베타 서비스 이용 중 발생할 수 있는 사항">
        <ul className="list-disc pl-5">
          <li>기능이 추가·변경·중단되거나 이용 방법이 달라질 수 있습니다.</li>
          <li>시스템 점검, 오류 수정 또는 서버 장애로 서비스 이용이 일시적으로 제한될 수 있습니다.</li>
          <li>
            기능 개선이나 데이터 구조 변경 과정에서 게시물의 표시 방식, 공개 범위, 화질 또는
            형식이 변경될 수 있습니다.
          </li>
          <li>
            오류, 보안 문제, 법령·정책 위반 또는 서비스 운영상 불가피한 사유가 있는 경우
            게시물이 수정·이동·비공개·삭제될 수 있습니다.
          </li>
          <li>
            베타 기간에 저장된 게시물, memo, 채팅 및 첨부파일이 정식 출시 이후 그대로 유지되지
            않을 수 있습니다.
          </li>
        </ul>
      </Section>

      <p className="text-sm font-medium leading-relaxed text-gray-900">
        중요한 작업물과 협업 자료는 반드시 개인 저장 공간에 별도로 백업해 주세요. Comp를
        음원·영상·악보 등 작업물의 유일한 보관 수단으로 이용하지 않기를 권장합니다.
      </p>

      <p className="text-sm leading-relaxed text-gray-700">
        운영자는 중요한 변경이나 데이터 삭제가 예정된 경우 가능한 범위에서 사전에 안내합니다.
        다만 보안 사고, 긴급 장애, 법령 위반 콘텐츠 대응 등 즉시 조치가 필요한 경우에는 사후에
        안내할 수 있습니다.
      </p>

      <Section title="문의 및 피드백">
        <p>베타 서비스 이용 중 발견한 오류나 개선 의견은 아래 이메일로 보내주세요.</p>
        <ul className="list-disc pl-5">
          <li>
            문의 및 피드백:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 underline">
              {CONTACT_EMAIL}
            </a>
          </li>
          <li>시행일: {EFFECTIVE_DATE}</li>
        </ul>
      </Section>

      <p className="text-xs text-gray-400">
        ※ 이 안내는 베타 서비스의 특성을 설명하기 위한 것입니다. 운영자의 고의 또는 과실로
        발생한 책임이나 관계 법령상 이용자에게 보장되는 권리를 배제하지 않습니다.
      </p>
    </main>
  );
}

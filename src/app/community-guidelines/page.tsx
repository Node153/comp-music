// 커뮤니티 운영정책 — 이용약관(/terms)의 제7~8조(회원 의무·이용제한)를 실제 운영 관점에서
// 더 구체적으로 풀어쓴 문서. 법적 계약 문서인 이용약관과 역할을 나눠서, 이건 "실제로 뭘 하면
// 안 되고 어떻게 처리되는지"를 회원이 읽기 쉽게 설명하는 쪽에 가깝다.
// ⚠️ 신고/차단 기능은 스펙(spec.md 0-6)에서 Phase 2로 의도적으로 보류한 상태라 아직
// 앱 안에 신고 버튼이 없다 — 정직하게 "이메일 문의 → 운영자 수동 처리"라고 적었다
// (privacy/terms와 같은 원칙, 아직 없는 기능을 있는 것처럼 적지 않음).
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

export default function CommunityGuidelinesPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className={pageTitle}>커뮤니티 운영정책</h1>
        <p className={mutedText}>시행일자: {EFFECTIVE_DATE}</p>
      </div>

      <p className="text-sm leading-relaxed text-gray-700">
        이 문서는 Comp를 안전하고 즐겁게 쓰기 위한 실제 운영 기준을 안내합니다. 법적인 권리·의무는{" "}
        <a href="/terms" className="text-blue-600 underline">
          이용약관
        </a>
        을 따르고, 여기서는 "구체적으로 뭘 하면 안 되고 어떻게 처리되는지"를 설명합니다.
      </p>

      <Section title="1. 게시물 작성 및 이용 규칙">
        <ul className="list-disc pl-5">
          <li>DEMO(전체공개)는 본인이 실제로 만든 음악 작업물(연주·작곡·합주 등)을 위한 공간입니다.</li>
          <li>memo(Companion 전용/특정인 초대)는 완성 전 스케치·공동창작 과정을 나누는 공간입니다.</li>
          <li>캡션·태그는 게시물 내용과 실제로 관련 있는 내용으로 작성해주세요.</li>
          <li>업로드하는 음원·영상·이미지에 대한 권리 확인은 가입 시 동의한 저작권 서약을 따릅니다.</li>
        </ul>
      </Section>

      <Section title="2. 금지 행위와 제재 기준">
        <p className="font-medium text-gray-900">다음 행위는 금지됩니다.</p>
        <ul className="list-disc pl-5">
          <li>타인의 저작물을 정당한 권리 없이 업로드하는 행위</li>
          <li>인증서류 위조·변조 또는 타인 정보 도용으로 가입하는 행위</li>
          <li>다른 회원을 대상으로 한 욕설·비하·혐오 표현, 성희롱, 지속적인 괴롭힘</li>
          <li>스팸성 홍보, 무단 영리 활동, 서비스 취지와 무관한 콘텐츠 반복 게시</li>
          <li>서비스 취약점 악용, 비정상적인 방법으로 계정을 다수 생성하는 행위</li>
        </ul>
        <p>
          위반 정도에 따라 <span className="font-medium text-gray-900">경고 → 콘텐츠 삭제 → 계정 정지</span>{" "}
          순으로 조치하며, 위조·도용처럼 심각한 경우 즉시 계정을 정지할 수 있습니다.
        </p>
      </Section>

      <Section title="3. 신고·차단·계정 정지 기준">
        <p>
          ⚠️ 현재 서비스 화면 안에 신고/차단 버튼은 아직 없습니다(추후 추가 예정). 지금은 위 금지
          행위를 목격하시면 아래 이메일로 알려주시면 운영자가 직접 확인 후 조치합니다.
        </p>
        <ul className="list-disc pl-5">
          <li>
            문의·신고: <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 underline">{CONTACT_EMAIL}</a>
          </li>
          <li>가능하면 문제가 된 게시물 링크 또는 상대방 닉네임을 같이 알려주시면 처리가 빨라져요.</li>
          <li>계정 정지 여부는 운영자가 내용을 확인한 뒤 판단하며, 정지 시 사유를 이메일로 안내합니다.</li>
        </ul>
      </Section>

      <Section title="4. 이용 연령">
        <p>
          Comp는 만 14세 이상만 가입할 수 있습니다. 가입 시 입력한 생년월일 기준으로 확인하며, 만
          14세 미만은 현재 가입이 제한됩니다(법정대리인 동의를 통한 가입은 아직 지원하지 않습니다).
        </p>
      </Section>

      <p className={mutedText}>부칙 — 시행일자: {EFFECTIVE_DATE}</p>
    </main>
  );
}

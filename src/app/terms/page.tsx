// 이용약관 — /privacy와 같은 이유로 로그인 없이 항상 열람 가능해야 함(PUBLIC_PATHS 등록).
// 제6조(게시물의 저작권 및 이용)는 signup/onboarding의 기존 3개 체크박스 문구
// (docs/copyright_agreement_draft.md)를 조항 형태로 재구성한 것 — 문구 자체는 그대로 두고
// "약관"의 격식에 맞게 조사만 다듬었다. 그 체크박스들은 앞으로도 별도로 남아있다(더 구체적인
// 개별 동의라 약관 전체 동의 하나로 뭉치지 않음).
// ⚠️ AI가 표준 이용약관 구조를 참고해 작성한 초안 — 정식 서비스 오픈 전 실제 법률 검토가
// 필요하다.
import { pageTitle, sectionTitle, mutedText } from "@/components/ui/styles";

const EFFECTIVE_DATE = "2026-08-19";

function Article({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className={sectionTitle}>{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className={pageTitle}>이용약관</h1>
        <p className={mutedText}>시행일자: {EFFECTIVE_DATE}</p>
      </div>

      <Article title="제1조 (목적)">
        <p>
          이 약관은 Comp(이하 &quot;서비스&quot;)가 제공하는 음악 전공생·활동자 네트워킹
          서비스의 이용조건 및 절차, 회원과 운영자의 권리·의무 및 책임사항을 규정함을
          목적으로 합니다.
        </p>
      </Article>

      <Article title="제2조 (정의)">
        <ol className="list-decimal pl-5">
          <li>&quot;회원&quot;이란 이 약관에 동의하고 서비스에 가입하여 이용하는 자를 말합니다.</li>
          <li>&quot;게시물&quot;이란 회원이 서비스에 업로드하는 영상, 이미지, 음원, 텍스트 등을 말합니다.</li>
          <li>&quot;DEMO&quot;란 전체공개 게시물을, &quot;memo&quot;란 Companion 간 비공개 협업 공간을 말합니다.</li>
          <li>&quot;Companion&quot;이란 서비스 내 맞팔(상호 수락) 관계를 맺은 회원을 말합니다.</li>
        </ol>
      </Article>

      <Article title="제3조 (약관의 효력 및 변경)">
        <ol className="list-decimal pl-5">
          <li>이 약관은 서비스 화면에 게시하거나 기타 방법으로 공지함으로써 효력을 발생합니다.</li>
          <li>
            운영자는 필요한 경우 약관을 변경할 수 있으며, 변경 시 적용일자 및 변경사유를 명시하여
            최소 7일 전(회원에게 불리한 변경은 30일 전) 공지합니다.
          </li>
        </ol>
      </Article>

      <Article title="제4조 (서비스의 폐쇄형 운영 및 인증심사)">
        <ol className="list-decimal pl-5">
          <li>서비스는 음악 전공 재학/졸업생 및 음악 활동 증빙이 있는 자만 이용 가능한 폐쇄형 서비스입니다.</li>
          <li>회원가입 시 인증서류를 제출해야 하며, 운영자의 심사를 거쳐 승인된 경우에만 서비스를 정상 이용할 수 있습니다.</li>
          <li>운영자는 제출된 서류가 허위이거나 심사기준에 부합하지 않는 경우 승인을 거부할 수 있습니다.</li>
        </ol>
      </Article>

      <Article title="제5조 (회원가입)">
        <ol className="list-decimal pl-5">
          <li>이용자는 운영자가 정한 절차에 따라 이메일 또는 소셜로그인(Google/Kakao/Spotify)으로 가입 신청을 합니다.</li>
          <li>만 14세 미만인 자는 회원으로 가입할 수 없으며, 가입 시 입력한 생년월일을 기준으로 확인합니다.</li>
          <li>
            운영자는 다음 각 호에 해당하는 경우 회원가입을 거부하거나 사후에 이용계약을 해지할 수
            있습니다.
            <ul className="list-disc pl-5">
              <li>타인의 정보를 도용한 경우</li>
              <li>허위 정보를 기재하거나 인증서류를 위·변조한 경우</li>
              <li>만 14세 미만임에도 나이를 허위로 기재하여 가입한 경우</li>
              <li>기타 회원으로 등록하는 것이 서비스 운영상 현저히 지장이 있다고 판단되는 경우</li>
            </ul>
          </li>
        </ol>
      </Article>

      <Article title="제6조 (게시물의 저작권 및 이용)">
        <ol className="list-decimal pl-5">
          <li>회원이 업로드하는 게시물의 저작권은 해당 게시물을 창작한 회원에게 있습니다.</li>
          <li>
            회원은 자신이 정당한 권리를 가진 콘텐츠만 업로드해야 하며, 타인의 저작권을 침해하는
            게시물로 인해 발생하는 모든 책임은 해당 회원에게 있습니다.
          </li>
          <li>
            운영자는 서비스 제공 및 운영에 필요한 범위 내에서만 회원의 게시물을 이용하며, 이는
            게시물의 소유권이 운영자에게 이전됨을 의미하지 않습니다.
          </li>
          <li>
            memo(비공개 협업 공간)에서 여러 회원이 공동으로 창작한 결과물의 소유권·지분·크레딧
            배분은 참여 회원 간 별도로 협의할 사항이며, 운영자는 이에 관여하거나 분쟁을
            중재하지 않습니다.
          </li>
        </ol>
        <p className="text-xs text-gray-400">
          위 4개 항목에 대한 개별 동의는 회원가입 시 체크박스로 별도로 받습니다.
        </p>
      </Article>

      <Article title="제7조 (회원의 의무)">
        <p>회원은 다음 행위를 하여서는 안 됩니다.</p>
        <ol className="list-decimal pl-5">
          <li>타인의 개인정보·저작권 등 권리를 침해하는 행위</li>
          <li>서비스를 이용하여 법령 또는 공서양속에 반하는 정보를 게시하는 행위</li>
          <li>운영자의 사전 동의 없이 서비스를 영리 목적으로 이용하는 행위</li>
          <li>인증서류를 위조·변조하는 행위</li>
        </ol>
      </Article>

      <Article title="제8조 (서비스 이용제한)">
        <p>
          운영자는 회원이 이 약관을 위반하거나 서비스의 정상적 운영을 방해한 경우, 사전 통지 후
          (긴급한 경우 사후 통지) 이용을 제한하거나 회원자격을 정지·상실시킬 수 있습니다.
        </p>
      </Article>

      <Article title="제9조 (서비스 제공의 중지)">
        <p>운영자는 시스템 점검, 서버 장애, 기타 불가항력적 사유가 있는 경우 서비스 제공을 일시 중단할 수 있습니다.</p>
      </Article>

      <Article title="제10조 (면책조항)">
        <ol className="list-decimal pl-5">
          <li>운영자는 천재지변, 불가항력적 사유로 서비스를 제공할 수 없는 경우 책임이 면제됩니다.</li>
          <li>
            운영자는 회원 간 또는 회원과 제3자 간에 서비스를 매개로 발생한 분쟁에 대해 개입할
            의무가 없으며, 이로 인한 손해를 배상할 책임이 없습니다.
          </li>
          <li>운영자는 회원이 게시한 정보의 신뢰성, 정확성에 대해 책임을 지지 않습니다.</li>
        </ol>
      </Article>

      <Article title="제11조 (분쟁해결)">
        <p>
          이 약관과 관련하여 발생한 분쟁에 대해서는 대한민국 법을 준거법으로 하며, 관련 법령이
          정하는 관할법원에 따릅니다.
        </p>
      </Article>

      <p className={mutedText}>부칙 — 시행일자: {EFFECTIVE_DATE}</p>
    </main>
  );
}

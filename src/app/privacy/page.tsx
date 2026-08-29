// 개인정보처리방침 — 로그인 여부와 무관하게 항상 열람 가능해야 하는 법적 고지 문서라 서버
// 컴포넌트로 두고 proxy.ts PUBLIC_PATHS에도 등록한다. 실제 데이터 흐름(어떤 값이 어느
// 테이블/스토리지에 저장되는지, 몇 개 크론이 뭘 자동 삭제하는지)을 기준으로 작성 — 스펙
// 문서(docs/spec.md)의 "예정" 문구를 그대로 베끼지 않고 현재 실제로 구현된 것과 아닌 것을
// 구분해서 적었다(예: 인증서류 90일 자동 파기는 아직 크론이 없어서 "구축 중"이라고 명시).
// ⚠️ AI가 표준 개인정보보호법 고지 구조를 참고해 작성한 초안 — 정식 서비스 오픈 전
// 실제 법률 검토가 필요하다(docs/copyright_agreement_draft.md와 동일한 원칙).
import { pageTitle, sectionTitle, mutedText } from "@/components/ui/styles";

const EFFECTIVE_DATE = "2026-08-19";
const CONTACT_EMAIL = "jtaein0723@gmail.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className={sectionTitle}>{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className={pageTitle}>개인정보처리방침</h1>
        <p className={mutedText}>시행일자: {EFFECTIVE_DATE}</p>
      </div>

      <p className="text-sm leading-relaxed text-gray-700">
        Comp(이하 &quot;서비스&quot;)를 운영하는 개인 운영자(이하 &quot;운영자&quot;)는 이용자의
        개인정보를 소중히 다루며, 「개인정보보호법」 등 관련 법령을 준수하기 위해 다음과 같이
        개인정보처리방침을 수립·공개합니다.
      </p>

      <Section title="1. 수집하는 개인정보 항목">
        <p className="font-medium text-gray-900">필수 항목</p>
        <ul className="list-disc pl-5">
          <li>이메일 가입 시: 이메일, 실명, 생년월일, 닉네임, 비밀번호</li>
          <li>
            소셜로그인(Google/Kakao/Spotify) 가입 시: 각 서비스가 제공하는 이메일·이름·닉네임
            (이용자가 로그인 시 동의한 항목에 한함), 그리고 생년월일은 각 서비스가 제공하지
            않아 가입 화면에서 이용자가 직접 입력
          </li>
          <li>
            인증심사 시: 인증유형(전공생/활동자), 학교명, 인증서류(재학증명서·학생증·졸업증명서
            또는 음반발매증빙·음원링크·공연포스터·크레딧 등)
          </li>
          <li>
            서비스 이용 중: 프로필 정보(포지션, 좋아하는 장르, 소개글), 게시물(영상·이미지·음원,
            캡션, 태그), 댓글·좋아요·채팅 등 상호작용 기록, Companion(협업) 관계 정보
          </li>
        </ul>
        <p className="mt-1 font-medium text-gray-900">자동 수집 항목</p>
        <ul className="list-disc pl-5">
          <li>마지막 접속 시각(온라인 상태 표시 용도)</li>
          <li>호스팅사(Vercel)가 보안·장애 대응 목적으로 표준적으로 남기는 접속 로그</li>
        </ul>
      </Section>

      <Section title="2. 개인정보의 수집 및 이용 목적">
        <ul className="list-disc pl-5">
          <li>회원 식별 및 로그인 처리</li>
          <li>
            중복 가입 방지(동일인의 다중 계정 생성 여부 확인) — 특히 생년월일은 이 목적으로만
            사용하며, 실명과 함께 대조해 관리자가 중복 가입 의심 계정을 판별하는 데 씁니다
          </li>
          <li>전공생/활동자 인증 심사(부정 가입 방지, 폐쇄형 서비스 품질 유지)</li>
          <li>게시물 업로드·노출·상호작용 등 핵심 서비스 제공</li>
          <li>Companion(협업) 매칭 및 DM 기능 제공</li>
          <li>공지사항 전달, 이용자 피드백 접수 및 처리</li>
        </ul>
      </Section>

      <Section title="3. 개인정보의 보유 및 이용기간">
        <ul className="list-disc pl-5">
          <li>회원 탈퇴 시 또는 법령이 정한 보관기간 경과 시까지 보유 후 지체 없이 파기합니다.</li>
          <li>
            <span className="font-medium text-gray-900">인증서류(학생증 등 민감정보):</span>{" "}
            심사(승인/반려) 완료 후 삭제를 원칙으로 합니다. 다만 자동 파기 스케줄은 현재
            구축 중이며, 완료 전까지는 운영자가 심사 완료 건에 한해 수동으로 삭제 처리합니다.
            즉시 삭제를 원하시면 아래 문의처로 요청해주세요.
          </li>
          <li>
            <span className="font-medium text-gray-900">게시물(영상/이미지/음원):</span> 작성자가
            직접 삭제하기 전까지 보관합니다. 메인 피드 노출 기간이 끝나도 본인 프로필 피드에는
            계속 남는 서비스 특성이 있습니다(가입 시 안내).
          </li>
          <li>
            <span className="font-medium text-gray-900">memo(비공개 협업 공간) 채팅 첨부파일:</span>{" "}
            업로드 후 3일 뒤 자동 삭제됩니다.
          </li>
        </ul>
      </Section>

      <Section title="4. 개인정보의 제3자 제공">
        <p>
          운영자는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 이용자가 사전에
          동의하였거나, 법령의 규정에 의거하거나 수사기관이 적법한 절차에 따라 요청하는 경우는
          예외로 합니다.
        </p>
      </Section>

      <Section title="5. 개인정보처리 위탁 및 국외 이전">
        <p>서비스 운영을 위해 아래와 같이 개인정보 처리 업무를 위탁하고 있습니다.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-1.5 pr-3 font-medium">수탁업체</th>
                <th className="py-1.5 pr-3 font-medium">위탁업무</th>
                <th className="py-1.5 font-medium">보관 위치</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              <tr className="border-b border-gray-100">
                <td className="py-1.5 pr-3">Supabase, Inc.</td>
                <td className="py-1.5 pr-3">회원 DB, 로그인 인증, 인증서류 저장</td>
                <td className="py-1.5">서울 리전</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 pr-3">Cloudflare, Inc.</td>
                <td className="py-1.5 pr-3">게시물·채팅 미디어 파일 저장</td>
                <td className="py-1.5">해외</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 pr-3">Vercel Inc.</td>
                <td className="py-1.5 pr-3">웹 서비스 호스팅</td>
                <td className="py-1.5">해외</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3">Google LLC / Kakao Corp. / Spotify AB</td>
                <td className="py-1.5 pr-3">소셜로그인(이용자가 선택한 경우에 한함)</td>
                <td className="py-1.5">각 사 정책에 따름</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          위 업체는 이용자의 개인정보를 자체 목적으로 이용하지 않으며, 서비스 제공에 필요한
          범위로 한정해 처리합니다. 처리 과정 일부가 국외에서 이뤄질 수 있습니다.
        </p>
      </Section>

      <Section title="6. 이용자의 권리와 행사방법">
        <ul className="list-disc pl-5">
          <li>프로필 정보는 서비스 내 [프로필 수정] 화면에서 언제든 직접 열람·수정할 수 있습니다.</li>
          <li>본인이 올린 게시물은 언제든 직접 영구 삭제할 수 있습니다.</li>
          <li>회원 탈퇴 및 그 외 열람·정정·삭제 요청은 아래 문의처로 이메일로 요청해주세요.</li>
        </ul>
      </Section>

      <Section title="7. 개인정보의 파기절차 및 방법">
        <p>전자적 파일 형태로 저장된 개인정보는 복구가 불가능한 방법으로 영구 삭제합니다.</p>
      </Section>

      <Section title="8. 개인정보 보호책임자">
        <p>현재 Comp는 개인 운영자가 개발·운영하는 서비스입니다.</p>
        <ul className="list-disc pl-5">
          <li>담당자: 정태인</li>
          <li>
            이메일:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">
              {CONTACT_EMAIL}
            </a>
          </li>
        </ul>
        <p>개인정보 관련 문의·불만처리·피해구제 등은 위 이메일로 연락해주시면 신속히 답변드립니다.</p>
      </Section>

      <Section title="9. 고지의 의무">
        <p>
          이 개인정보처리방침의 내용이 추가·삭제·수정되는 경우 시행 최소 7일 전 서비스 내
          공지사항을 통해 고지합니다.
        </p>
      </Section>
    </main>
  );
}

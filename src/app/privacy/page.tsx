// 개인정보처리방침 — 로그인 여부와 무관하게 항상 열람 가능해야 하는 법적 고지 문서라 서버
// 컴포넌트로 두고 proxy.ts PUBLIC_PATHS에도 등록한다. 실제 데이터 흐름(어떤 값이 어느
// 테이블/스토리지에 저장되는지, 어느 크론이 뭘 자동 삭제하는지)을 기준으로 작성한다 —
// "예정"인 것과 "지금 실제로 되는 것"을 구분해서 적는다.
// ⚠️ AI가 표준 개인정보보호법 고지 구조를 참고해 작성한 초안 — 정식 서비스 오픈 전
// 실제 법률 검토가 필요하다(terms/page.tsx와 동일한 원칙).
//
// 2026-08-29 대폭 개정(사용자가 공유한 법적 리스크 검토 반영). 이 개정 작업 중 코드를 직접
// 확인해서 알아낸 사실들 — 문구를 쓰기 전에 반드시 실제 구현과 대조했다:
// - Supabase 프로젝트 리전은 실제로 ap-northeast-2(서울) — get_project로 확인.
// - Cloudflare R2는 클라이언트 코드에 region: "auto"로 돼있어(src/lib/r2/client.ts) 특정
//   국가로 못 박을 수 없다 — Cloudflare 글로벌 네트워크에 자동 분산.
// - Vercel은 이전 세션에서 실제 배포 로그에 "Washington, D.C., USA (East) – iad1"로 찍힌 걸
//   확인함 — vercel.json에 별도 리전 지정 없음(기본 리전 그대로 사용 중).
// - Resend(src/lib/email.ts)가 알림 이메일(좋아요/댓글/노크/Companion신청/메시지) 발송에
//   이미 쓰이고 있음 — 커스텀 도메인 연결 전이라 발신 주소는 resend.dev 공유 도메인.
// - ⚠️ 가장 중요한 발견: DOCUMENT_VERIFICATION_ENABLED=false(src/lib/featureFlags.ts) —
//   지금은 인증서류를 아예 받지 않는다. 프로필 정보(인증유형/학교명 등)만으로 관리자가
//   서류 없이 승인/반려한다. 그래서 "인증서류" 관련 조항은 지금 실제로 작동 중인 처리가
//   아니라 "기능이 다시 켜지면 이렇게 처리하겠다"는 사전 고지로 적었다 — 켜기 전에 반드시
//   이 페이지의 관련 항목이 실제 구현(자동 파기 등)과 일치하는지 다시 확인할 것.
// - verifications.documents는 Cloudflare R2가 아니라 Supabase Storage
//   "verification-documents" 버킷에 저장되는 구조(verify/documents/page.tsx) — 서울 리전.
// - messages(1:1 DM)와 post_chat_messages(memo)의 텍스트 내용은 현재 자동 삭제/만료
//   크론이 전혀 없다(cleanup-complex-files는 memo의 "첨부파일"만 3일 후 삭제, 텍스트는
//   안 건드림) — 이 사실을 숨기지 않고 그대로 고지했다.
import { pageTitle, sectionTitle, mutedText } from "@/components/ui/styles";

const EFFECTIVE_DATE = "2026-08-29";
const CONTACT_EMAIL = "jtaein0723@gmail.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className={sectionTitle}>{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            {head.map((h) => (
              <th key={h} className="py-1.5 pr-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-gray-700">
          {rows.map((row, i) => (
            <tr key={i} className={i < rows.length - 1 ? "border-b border-gray-100" : undefined}>
              {row.map((cell, j) => (
                <td key={j} className="py-1.5 pr-3 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
        개인정보처리방침을 수립·공개합니다. 이 방침은 이상적인 운영 계획이 아니라, 이 문서의
        시행일자 기준으로 서비스가 실제로 처리하는 데이터 흐름을 설명합니다.
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
            인증심사 시: 인증유형(전공생/활동자), 학교명, 전공, 악기 등 프로필 정보.{" "}
            <span className="font-medium text-gray-900">
              현재는 서류 기반 인증 기능을 일시적으로 사용하지 않고 있어, 재학증명서·학생증
              등의 인증서류 원본은 수집하지 않습니다.
            </span>{" "}
            서류 기반 인증을 다시 시작하면 이 항목과 아래 보유기간을 갱신하여 고지합니다.
          </li>
          <li>
            서비스 이용 중: 프로필 정보(포지션, 좋아하는 장르, 소개글, 지역), 게시물(영상·이미지·음원,
            캡션, 태그), 댓글·좋아요·1:1 메시지·memo 채팅 등 상호작용 기록, Companion(협업) 관계
            정보
          </li>
        </ul>
        <p className="mt-1 font-medium text-gray-900">자동 수집 항목</p>
        <ul className="list-disc pl-5">
          <li>마지막 접속 시각(다른 회원에게는 정확한 시각이 아니라 &quot;온라인&quot;·&quot;자리 비움&quot; 상태로만 표시)</li>
          <li>
            IP 주소, 접속일시, 요청 URL, 브라우저·기기 정보 등 호스팅사(Vercel)·CDN(Cloudflare)·
            데이터베이스(Supabase)가 보안 대응·장애 분석 목적으로 표준적으로 남기는 접속·보안 로그
          </li>
          <li>로그인 세션 유지를 위한 쿠키(세션 토큰) — 자세한 내용은 &quot;10. 자동 수집 장치 및 거부 방법&quot;에서 안내합니다.</li>
        </ul>
      </Section>

      <Section title="2. 개인정보의 수집 및 이용 목적">
        <ul className="list-disc pl-5">
          <li>회원 식별 및 로그인 처리</li>
          <li>
            생년월일은 (1) 만 14세 이상 여부 확인, (2) 실명과 함께 대조하여 동일인의 중복 계정
            생성이 의심되는 경우를 관리자가 보조적으로 판별하는 데 이용합니다. 실명·생년월일
            일치만으로 자동으로 가입을 거절하거나 계정을 정지하지 않으며, 필요한 경우 이용자에게
            소명 기회를 드립니다.
          </li>
          <li>전공생/활동자 인증 심사(부정 가입 방지, 폐쇄형 서비스 품질 유지)</li>
          <li>게시물 업로드·노출·상호작용 등 핵심 서비스 제공</li>
          <li>Companion(협업) 매칭 및 1:1 메시지·memo 기능 제공</li>
          <li>알림 이메일(좋아요·댓글·노크·Companion 신청·메시지 등) 발송</li>
          <li>공지사항 전달, 이용자 피드백 접수 및 처리</li>
          <li>부정 이용 방지, 서비스 보안 유지 및 장애 대응</li>
        </ul>
      </Section>

      <Section title="3. 개인정보의 보유 및 이용기간">
        <p>회원 탈퇴 시 또는 아래 기간 중 먼저 도래하는 시점까지 보유 후 지체 없이 파기합니다.</p>
        <Table
          head={["정보", "보유기간"]}
          rows={[
            ["계정·프로필 정보(이메일, 실명, 생년월일, 닉네임, 프로필 항목)", "회원 탈퇴 시까지"],
            [
              "인증서류 원본(서류 기반 인증 재개 시)",
              "심사(승인/반려) 완료일로부터 7일 이내 파기. 심사 결과에 이의신청이 제기된 경우 그 절차 종료 후 7일 이내 파기",
            ],
            ["인증 결과·인증유형·심사일자", "회원 탈퇴 시까지"],
            ["게시물·댓글·좋아요", "작성자가 직접 삭제하거나 회원 탈퇴 시까지"],
            [
              "1:1 메시지(DM), memo 채팅 텍스트",
              "현재 별도의 자동 삭제 기능이 없어 대화 상대방 또는 본인이 삭제하거나 회원 탈퇴 시까지 보관됩니다. 자동 삭제·보유기간 정책은 준비 중이며, 마련되는 대로 이 방침에 반영합니다.",
            ],
            ["memo 채팅 첨부파일(이미지·음원·영상)", "업로드일로부터 3일 후 자동 삭제"],
            ["접속·보안 로그", "각 호스팅·인프라 공급자의 표준 로그 보존기간에 따름(운영자가 별도로 장기 보관하지 않음)"],
            ["고객문의(피드백) 내용", "처리 완료 후 문의 이력 확인 등 합리적인 목적에 필요한 기간 동안 보관"],
          ]}
        />
        <p>
          게시물은 메인 피드 노출 기간(회원이 정한 최대 노출시간)이 끝나도 삭제되지 않고 본인
          프로필 피드에는 계속 남는 서비스 특성이 있습니다(가입 시 안내).
        </p>
      </Section>

      <Section title="4. 개인정보의 제3자 제공">
        <p>
          운영자는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 이용자가 사전에
          동의하였거나, 법령의 규정에 의거하거나 수사기관이 적법한 절차에 따라 요청하는 경우는
          예외로 합니다.
        </p>
      </Section>

      <Section title="5. 개인정보 처리위탁 및 국외 이전">
        <p>서비스 운영을 위해 아래 업체에 개인정보 처리 업무를 위탁하고 있으며, 이 과정에서 개인정보가 국외로 이전됩니다.</p>
        <Table
          head={["수탁업체", "위탁업무 / 이전 항목", "이전 국가", "보유기간"]}
          rows={[
            [
              "Supabase, Inc.",
              "회원 DB, 로그인 인증, (서류 기반 인증 재개 시) 인증서류 저장 — 계정 정보 전반, 인증서류 파일",
              "대한민국(서울 리전)",
              "회원 탈퇴 또는 위탁계약 종료 시까지",
            ],
            [
              "Cloudflare, Inc.",
              "게시물·memo 채팅 미디어 파일(영상·이미지·음원) 저장 및 전송 — 파일 자체와 업로드 시 접속 정보",
              "특정 국가로 한정되지 않음(Cloudflare 글로벌 네트워크에 자동 분산 저장)",
              "회원 탈퇴 또는 게시물 삭제 시까지(제6조 백업 삭제기간 포함)",
            ],
            [
              "Vercel Inc.",
              "웹 서비스 호스팅 및 서버 실행 — 접속 IP, 요청 로그 등",
              "미국(버지니아, 기본 리전)",
              "각 서비스의 표준 로그 보존기간에 따름",
            ],
            [
              "Resend",
              "알림·인증 이메일 발송 대행 — 수신 이메일 주소, 이메일 제목·본문",
              "미국",
              "발송 처리 완료 후 각 서비스의 표준 보존기간에 따름",
            ],
          ]}
        />
        <p>
          위 업체는 이용자의 개인정보를 자체 목적으로 이용하지 않으며, 위탁받은 업무 범위로
          한정해 처리합니다. 이전 시기와 방법은 이용자가 서비스를 이용(업로드·접속·메시지
          발송 등)하는 시점에 암호화된 네트워크 통신으로 이루어집니다. 위탁 계약 및 국외 이전에
          동의하지 않으실 경우 서비스 이용(회원가입)이 제한될 수 있습니다 — 위 처리위탁은
          서비스 제공에 필수적인 인프라(DB·저장소·호스팅·이메일 발송)이기 때문입니다. 자세한
          연락처는 각 업체가 공개한 개인정보처리방침을 통해 확인하실 수 있습니다.
        </p>
        <p>
          Google, Kakao, Spotify는 운영자의 지시에 따라 개인정보를 처리하는 수탁업체가 아니라,
          이용자가 소셜로그인을 선택했을 때 이용자의 동의 범위 내에서 운영자에게 이메일·이름·
          닉네임 등 일부 정보를 제공하는 각자 독립적인 서비스 제공자입니다. 각 서비스에서
          실제로 어떤 정보가 제공되는지는 로그인 시 해당 서비스가 보여주는 동의 화면을 통해
          확인할 수 있습니다.
        </p>
      </Section>

      <Section title="6. 이용자의 권리와 행사방법">
        <ul className="list-disc pl-5">
          <li>프로필 정보는 서비스 내 [프로필 수정] 화면에서 언제든 직접 열람·수정할 수 있습니다.</li>
          <li>본인이 올린 게시물은 언제든 직접 영구 삭제할 수 있습니다.</li>
          <li>
            그 외 개인정보의 열람, 정정·삭제, 처리정지 및 동의 철회, 회원 탈퇴는 아래 문의처로
            이메일 요청해주시면 됩니다. 프로필 화면에서 직접 수정할 수 없는 항목(실명, 생년월일,
            인증 결과 등)의 정정도 같은 방법으로 요청할 수 있습니다.
          </li>
          <li>
            운영자는 요청자 본인 확인 후 관련 법령이 정한 기간 내에 처리하며, 처리 결과를 요청하신
            이메일로 통지합니다. 이용자를 대신하여 법정대리인 또는 위임받은 자가 요청하는 경우
            위임 관계를 확인할 수 있는 자료를 요청할 수 있습니다.
          </li>
          <li>
            다른 법령에서 개인정보의 삭제를 제한하고 있는 경우, 진행 중인 신고·분쟁·수사 절차와
            관련된 자료인 경우에는 열람·삭제 요청이 제한되거나 지연될 수 있으며, 이 경우 사유를
            함께 안내합니다.
          </li>
          <li>처리 결과에 이의가 있는 경우 &quot;11. 권리 구제 방법&quot;에 안내된 기관에 조정을 신청할 수 있습니다.</li>
        </ul>
      </Section>

      <Section title="7. 개인정보의 파기절차 및 방법">
        <p>
          전자적 파일 형태로 저장된 개인정보는 복구할 수 없는 방법으로 영구 삭제합니다. 종이
          문서로 보관하는 개인정보는 없습니다.
        </p>
      </Section>

      <Section title="8. 안전성 확보조치">
        <p>운영자는 개인정보 보호를 위해 다음과 같은 조치를 취하고 있습니다.</p>
        <ul className="list-disc pl-5">
          <li>비밀번호는 인증 서비스(Supabase Auth)에서 일방향 암호화되어 저장되며, 운영자를 포함한 누구도 원문을 확인할 수 없습니다.</li>
          <li>이용자와 서비스 간 통신은 HTTPS로 암호화됩니다.</li>
          <li>개인정보 및 관리자 기능에 대한 접근은 필요한 최소 인원(운영자 본인)으로 제한합니다.</li>
          <li>데이터베이스 접근 시 행 단위 접근 제어(RLS)를 적용해 본인 또는 권한이 있는 범위의 정보만 조회되도록 합니다.</li>
          <li>서류 기반 인증을 다시 시작하는 경우, 인증서류는 일반 공개 콘텐츠와 분리된 비공개 저장소에 보관하고 접근 권한을 심사 담당자로 제한합니다.</li>
        </ul>
        <p className="text-xs text-gray-400">
          운영 인력이 아직 소수(개인 운영자)라 관리자 계정 다중인증, 정기적인 접근권한 점검 등은
          팀 규모가 커지는 시점에 맞춰 순차적으로 도입할 예정입니다.
        </p>
      </Section>

      <Section title="9. 자동 수집 장치 및 거부 방법">
        <p>
          서비스는 로그인 상태 유지를 위해 쿠키(세션 토큰)를 사용합니다. 이용자는 브라우저
          설정에서 쿠키 저장을 거부할 수 있으나, 이 경우 로그인이 유지되지 않아 서비스 이용에
          제한이 있을 수 있습니다.
        </p>
      </Section>

      <Section title="10. 개인정보 보호책임자">
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

      <Section title="11. 권리 구제 방법">
        <p>
          개인정보 관련 문의는 우선 위 담당자에게 연락해주시되, 아래 기관을 통해서도 상담·신고·
          조정 신청을 하실 수 있습니다.
        </p>
        <ul className="list-disc pl-5">
          <li>개인정보침해 신고센터: (국번없이) 118 · privacy.kisa.or.kr</li>
          <li>개인정보 분쟁조정위원회: 1833-6972 · kopico.go.kr</li>
          <li>대검찰청 사이버수사과: 국번없이 1301 · spo.go.kr</li>
          <li>경찰청 사이버수사국: 국번없이 182 · ecrm.police.go.kr</li>
        </ul>
      </Section>

      <Section title="12. 개인정보 유출 등 통지">
        <p>
          개인정보 유출 등 사고가 발생한 경우, 관련 법령에 따라 이용자에게 유출 항목, 발생 시점,
          이용자가 취할 수 있는 조치, 운영자의 대응 조치 및 문의처를 지체 없이 이메일 또는
          서비스 내 공지사항으로 통지하고, 필요한 경우 관계 기관에 신고합니다.
        </p>
      </Section>

      <Section title="13. 고지의 의무 및 변경 이력">
        <p>
          이 개인정보처리방침의 내용이 추가·삭제·수정되는 경우 시행 최소 7일 전(중요한 변경은
          30일 전) 서비스 내 공지사항을 통해 고지합니다.
        </p>
        <p className="text-xs text-gray-400">시행일자 2026-08-19 버전 → 2026-08-29 개정(전면 개정)</p>
      </Section>
    </main>
  );
}

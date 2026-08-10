import { pageTitle, pageCard } from "@/components/ui/styles";
import { NicknameForm } from "./NicknameForm";
import { ProfileDetailsForm } from "./ProfileDetailsForm";

// S10 프로필 수정 (PROFILE-01, 본인만 접근)
export default function ProfileEditPage() {
  return (
    <main className={`${pageCard} flex flex-col gap-6`}>
      <h1 className={pageTitle}>프로필 수정</h1>
      <NicknameForm />
      <ProfileDetailsForm />
    </main>
  );
}

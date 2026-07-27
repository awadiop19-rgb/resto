import { auth } from "@/auth";
import { PageContainer } from "@/components/page-container";
import { ProfileForm } from "./profile-form";

export default async function ProfilPage() {
  const session = await auth();
  const user = session!.user;

  return (
    <PageContainer>
      <div className="mx-auto max-w-lg space-y-6">
        <h1 className="text-2xl font-semibold">Mon profil</h1>
        <ProfileForm name={user.name ?? ""} email={user.email ?? ""} role={user.role} />
      </div>
    </PageContainer>
  );
}

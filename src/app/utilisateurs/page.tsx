import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserManager } from "./user-manager";
import { PageContainer } from "@/components/page-container";

export const dynamic = "force-dynamic";

export default async function UtilisateursPage() {
  const session = await auth();
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <PageContainer>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Utilisateurs</h1>
        <UserManager
          users={users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            active: u.active,
          }))}
          currentUserId={session!.user.id}
        />
      </div>
    </PageContainer>
  );
}

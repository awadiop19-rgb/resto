import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MenuManager } from "./menu-manager";
import { PageContainer } from "@/components/page-container";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const session = await auth();

  const categories = await prisma.menuCategory.findMany({
    include: { items: { orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });

  return (
    <PageContainer>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Menu</h1>
        <MenuManager categories={categories} isAdmin={session!.user.role === "ADMIN"} />
      </div>
    </PageContainer>
  );
}

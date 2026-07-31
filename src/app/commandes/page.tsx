import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OrderBoard } from "./order-board";
import { PageContainer } from "@/components/page-container";
import { AutoRefresh } from "@/components/auto-refresh";
import { getCaissesNonFermees, messageBlocage } from "@/lib/journee-caisse";

export const dynamic = "force-dynamic";

export default async function CommandesPage() {
  const session = await auth();
  const { id: userId, role } = session!.user;

  const [orders, categories, caissesEnRetard] = await Promise.all([
    prisma.order.findMany({
      include: {
        items: { include: { menuItem: true } },
        user: true,
        payment: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.menuCategory.findMany({
      include: { items: { where: { available: true } } },
      orderBy: { name: "asc" },
    }),
    // Une caisse d'une journée antérieure restée ouverte suspend le service.
    role === "CAISSIER" || role === "ADMIN" ? getCaissesNonFermees(userId) : Promise.resolve([]),
  ]);

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">Commandes</h1>
          <AutoRefresh intervalMs={10000} />
        </div>
        <OrderBoard
          orders={orders}
          categories={categories}
          role={role}
          currentUserId={userId}
          blocage={caissesEnRetard.length > 0 ? messageBlocage(caissesEnRetard) : null}
        />
      </div>
    </PageContainer>
  );
}

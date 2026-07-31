import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OrderBoard } from "./order-board";
import { PageContainer } from "@/components/page-container";
import { AutoRefresh } from "@/components/auto-refresh";
import { getCaissesNonFermees, messageBlocage } from "@/lib/journee-caisse";
import { getQuartiersLivrables } from "@/lib/zones-livraison";

export const dynamic = "force-dynamic";

export default async function CommandesPage() {
  const session = await auth();
  const { id: userId, role } = session!.user;

  const [orders, categories, quartiers, caissesEnRetard] = await Promise.all([
    prisma.order.findMany({
      include: {
        items: { include: { menuItem: true } },
        user: true,
        livreur: { select: { name: true } },
        quartier: { select: { name: true } },
        payment: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.menuCategory.findMany({
      include: { items: { where: { available: true } } },
      orderBy: { name: "asc" },
    }),
    getQuartiersLivrables(),
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
          orders={orders.map((order) => ({
            ...order,
            quartierName: order.quartier?.name ?? null,
          }))}
          categories={categories}
          quartiers={quartiers}
          role={role}
          currentUserId={userId}
          blocage={caissesEnRetard.length > 0 ? messageBlocage(caissesEnRetard) : null}
        />
      </div>
    </PageContainer>
  );
}

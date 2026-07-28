import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OrderBoard } from "./order-board";
import { PageContainer } from "@/components/page-container";

export const dynamic = "force-dynamic";

export default async function CommandesPage() {
  const session = await auth();

  const [orders, categories] = await Promise.all([
    prisma.order.findMany({
      include: { items: { include: { menuItem: true } }, user: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.menuCategory.findMany({
      include: { items: { where: { available: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <PageContainer>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Commandes</h1>
        <OrderBoard
          orders={orders}
          categories={categories}
          role={session!.user.role}
          currentUserId={session!.user.id}
        />
      </div>
    </PageContainer>
  );
}

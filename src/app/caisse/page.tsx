import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/page-container";
import { CashRegisterManager } from "./cash-register-manager";

export const dynamic = "force-dynamic";

export default async function CaissePage() {
  const session = await auth();
  const userId = session!.user.id;

  const [cashRegister, unpaidOrders] = await Promise.all([
    prisma.cashRegister.findFirst({
      where: { cashierId: userId, status: "OUVERTE" },
      include: { payments: true },
    }),
    prisma.order.findMany({
      where: { status: { not: "ANNULEE" }, payment: null },
      include: { items: { include: { menuItem: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <PageContainer>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Caisse</h1>
        <CashRegisterManager cashRegister={cashRegister} unpaidOrders={unpaidOrders} />
      </div>
    </PageContainer>
  );
}

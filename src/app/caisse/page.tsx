import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/page-container";
import { CashRegisterManager } from "./cash-register-manager";
import { CaisseDashboard } from "./caisse-dashboard";
import { AutoRefresh } from "@/components/auto-refresh";

export const dynamic = "force-dynamic";

export default async function CaissePage() {
  const session = await auth();
  const userId = session!.user.id;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [cashRegistersToday, unpaidOrders] = await Promise.all([
    prisma.cashRegister.findMany({
      where: { cashierId: userId, openedAt: { gte: todayStart } },
      include: {
        payments: {
          include: { order: { include: { items: { include: { menuItem: true } } } } },
        },
      },
      orderBy: { openedAt: "desc" },
    }),
    prisma.order.findMany({
      where: { status: { not: "ANNULEE" }, payment: null },
      include: { items: { include: { menuItem: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const cashRegister = cashRegistersToday.find((cr) => cr.status === "OUVERTE") ?? null;

  const payments = cashRegistersToday.flatMap((cr) => cr.payments);
  const totalCash = payments.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amount, 0);
  const totalWave = payments.filter((p) => p.method === "WAVE").reduce((s, p) => s + p.amount, 0);

  const dishCounts = new Map<string, number>();
  for (const payment of payments) {
    for (const item of payment.order.items) {
      dishCounts.set(item.menuItem.name, (dishCounts.get(item.menuItem.name) ?? 0) + item.quantity);
    }
  }
  const dishesSold = Array.from(dishCounts.entries())
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity);

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">Caisse</h1>
          <AutoRefresh intervalMs={15000} />
        </div>
        <CaisseDashboard
          ordersCount={payments.length}
          totalRevenue={totalCash + totalWave}
          totalCash={totalCash}
          totalWave={totalWave}
          dishesSold={dishesSold}
        />
        <CashRegisterManager cashRegister={cashRegister} unpaidOrders={unpaidOrders} />
      </div>
    </PageContainer>
  );
}

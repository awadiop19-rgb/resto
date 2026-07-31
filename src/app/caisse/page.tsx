import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/page-container";
import { CashRegisterManager } from "./cash-register-manager";
import { CaisseDashboard } from "./caisse-dashboard";
import { CaissesEnRetard } from "./caisse-en-retard";
import { AutoRefresh } from "@/components/auto-refresh";
import { getCaissesNonFermees } from "@/lib/journee-caisse";

export const dynamic = "force-dynamic";

export default async function CaissePage() {
  const session = await auth();
  const userId = session!.user.id;

  // Une caisse laissée ouverte sur une journée antérieure bloque tout le reste :
  // on n'affiche que l'écran de rattrapage tant qu'elle n'est pas clôturée.
  const caissesEnRetard = await getCaissesNonFermees(userId);
  if (caissesEnRetard.length > 0) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold">Caisse</h1>
          <CaissesEnRetard caisses={caissesEnRetard} />
        </div>
      </PageContainer>
    );
  }

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

  // Commandes déjà encaissées par ce caissier aujourd'hui, la plus récente d'abord.
  const paidOrders = payments
    .map((payment) => ({
      paymentId: payment.id,
      paidAt: payment.createdAt,
      method: payment.method,
      amount: payment.amount,
      tableNumber: payment.order.tableNumber,
      customerName: payment.order.customerName,
      items: payment.order.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        name: item.menuItem.name,
      })),
    }))
    .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());

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
        <CashRegisterManager
          cashRegister={cashRegister}
          unpaidOrders={unpaidOrders}
          paidOrders={paidOrders}
        />
      </div>
    </PageContainer>
  );
}

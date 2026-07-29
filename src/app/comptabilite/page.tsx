import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/page-container";
import { ComptabiliteDashboard } from "./comptabilite-dashboard";

export const dynamic = "force-dynamic";

export default async function ComptabilitePage() {
  const [expenses, closedCashRegisters, payments] = await Promise.all([
    prisma.expense.findMany({
      include: { user: true },
      orderBy: { date: "desc" },
    }),
    prisma.cashRegister.findMany({
      where: { status: "FERMEE" },
      include: { cashier: true },
      orderBy: { closedAt: "desc" },
    }),
    prisma.payment.findMany({
      include: { cashier: true },
    }),
  ]);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const versementAmount = (cr: (typeof closedCashRegisters)[number]) =>
    cr.correctedAmount ?? cr.declaredAmount ?? 0;

  const totalVersements = closedCashRegisters.reduce((sum, cr) => sum + versementAmount(cr), 0);
  const solde = totalVersements - totalExpenses;

  const expensesByCategoryMap = new Map<string, number>();
  for (const expense of expenses) {
    expensesByCategoryMap.set(expense.category, (expensesByCategoryMap.get(expense.category) ?? 0) + expense.amount);
  }
  const expensesByCategory = Array.from(expensesByCategoryMap.entries()).map(([category, total]) => ({
    category,
    total,
  }));

  const versementsByDayMap = new Map<string, number>();
  for (const cr of closedCashRegisters) {
    if (!cr.closedAt) continue;
    const day = cr.closedAt.toISOString().slice(0, 10);
    versementsByDayMap.set(day, (versementsByDayMap.get(day) ?? 0) + versementAmount(cr));
  }
  const versementsByDay = Array.from(versementsByDayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, total]) => ({ date, total }));

  const recentVersements = closedCashRegisters.slice(0, 8).map((cr) => ({
    id: cr.id,
    cashierName: cr.cashier.name,
    closedAt: cr.closedAt,
    amount: versementAmount(cr),
    corrected: cr.correctedAmount != null,
  }));

  const recentExpenses = expenses.slice(0, 8).map((e) => ({
    id: e.id,
    label: e.label,
    category: e.category,
    date: e.date,
    amount: e.amount,
    userName: e.user.name,
  }));

  const salesByCashierMap = new Map<
    string,
    { cashierName: string; ordersCount: number; totalCash: number; totalWave: number }
  >();
  for (const payment of payments) {
    const entry = salesByCashierMap.get(payment.cashierId) ?? {
      cashierName: payment.cashier.name,
      ordersCount: 0,
      totalCash: 0,
      totalWave: 0,
    };
    entry.ordersCount += 1;
    if (payment.method === "CASH") entry.totalCash += payment.amount;
    else entry.totalWave += payment.amount;
    salesByCashierMap.set(payment.cashierId, entry);
  }

  const versementsByCashierMap = new Map<string, { versementsCount: number; totalVersed: number }>();
  for (const cr of closedCashRegisters) {
    const entry = versementsByCashierMap.get(cr.cashierId) ?? { versementsCount: 0, totalVersed: 0 };
    entry.versementsCount += 1;
    entry.totalVersed += versementAmount(cr);
    versementsByCashierMap.set(cr.cashierId, entry);
  }

  const salesByCashier = Array.from(salesByCashierMap.entries())
    .map(([cashierId, sales]) => {
      const versements = versementsByCashierMap.get(cashierId) ?? { versementsCount: 0, totalVersed: 0 };
      return {
        cashierId,
        cashierName: sales.cashierName,
        ordersCount: sales.ordersCount,
        totalCash: sales.totalCash,
        totalWave: sales.totalWave,
        totalSales: sales.totalCash + sales.totalWave,
        versementsCount: versements.versementsCount,
        totalVersed: versements.totalVersed,
      };
    })
    .sort((a, b) => b.totalSales - a.totalSales);

  return (
    <PageContainer>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Comptabilité</h1>
        <ComptabiliteDashboard
          totalExpenses={totalExpenses}
          totalVersements={totalVersements}
          versementsCount={closedCashRegisters.length}
          solde={solde}
          expensesByCategory={expensesByCategory}
          versementsByDay={versementsByDay}
          recentVersements={recentVersements}
          recentExpenses={recentExpenses}
          salesByCashier={salesByCashier}
        />
      </div>
    </PageContainer>
  );
}

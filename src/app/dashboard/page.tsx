import { prisma } from "@/lib/prisma";
import { DashboardCharts } from "./dashboard-charts";
import { PageContainer } from "@/components/page-container";

export default async function DashboardPage() {
  const [orders, expenses] = await Promise.all([
    prisma.order.findMany({
      where: { status: "SERVIE" },
      include: { items: { include: { menuItem: true } } },
    }),
    prisma.expense.findMany(),
  ]);

  const totalRevenue = orders.reduce(
    (sum, order) => sum + order.items.reduce((s, item) => s + item.unitPrice * item.quantity, 0),
    0,
  );
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const profit = totalRevenue - totalExpenses;

  const salesByDayMap = new Map<string, number>();
  for (const order of orders) {
    const day = order.createdAt.toISOString().slice(0, 10);
    const revenue = order.items.reduce((s, item) => s + item.unitPrice * item.quantity, 0);
    salesByDayMap.set(day, (salesByDayMap.get(day) ?? 0) + revenue);
  }
  const salesByDay = Array.from(salesByDayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, total]) => ({ date, total }));

  const expensesByCategoryMap = new Map<string, number>();
  for (const expense of expenses) {
    expensesByCategoryMap.set(expense.category, (expensesByCategoryMap.get(expense.category) ?? 0) + expense.amount);
  }
  const expensesByCategory = Array.from(expensesByCategoryMap.entries()).map(([category, total]) => ({
    category,
    total,
  }));

  const itemMap = new Map<string, number>();
  for (const order of orders) {
    for (const item of order.items) {
      itemMap.set(item.menuItem.name, (itemMap.get(item.menuItem.name) ?? 0) + item.quantity);
    }
  }
  const topItems = Array.from(itemMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, quantity]) => ({ name, quantity }));

  return (
    <PageContainer>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Tableau de bord</h1>
        <DashboardCharts
          totalRevenue={totalRevenue}
          totalExpenses={totalExpenses}
          profit={profit}
          salesByDay={salesByDay}
          expensesByCategory={expensesByCategory}
          topItems={topItems}
        />
      </div>
    </PageContainer>
  );
}

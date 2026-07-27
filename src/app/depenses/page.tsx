import { prisma } from "@/lib/prisma";
import { ExpenseManager } from "./expense-manager";
import { PageContainer } from "@/components/page-container";

export default async function DepensesPage() {
  const expenses = await prisma.expense.findMany({
    include: { user: true },
    orderBy: { date: "desc" },
  });

  return (
    <PageContainer>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Dépenses</h1>
        <ExpenseManager expenses={expenses} />
      </div>
    </PageContainer>
  );
}

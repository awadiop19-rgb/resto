import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/page-container";
import { ComptabiliteDepenses } from "./comptabilite-depenses";

export default async function ComptabiliteDepensesPage({
  searchParams,
}: {
  searchParams: Promise<{ debut?: string; fin?: string }>;
}) {
  const { debut, fin } = await searchParams;

  const date: { gte?: Date; lte?: Date } = {};
  if (debut) date.gte = new Date(`${debut}T00:00:00`);
  if (fin) date.lte = new Date(`${fin}T23:59:59.999`);

  const expenses = await prisma.expense.findMany({
    where: Object.keys(date).length > 0 ? { date } : undefined,
    include: { user: true },
    orderBy: { date: "desc" },
  });

  return (
    <PageContainer>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Comptabilité - Dépenses</h1>
        <ComptabiliteDepenses expenses={expenses} debut={debut ?? ""} fin={fin ?? ""} />
      </div>
    </PageContainer>
  );
}

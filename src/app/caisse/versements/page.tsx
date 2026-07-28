import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/page-container";
import { VersementsManager } from "./versements-manager";

export const dynamic = "force-dynamic";

export default async function VersementsPage() {
  const cashRegisters = await prisma.cashRegister.findMany({
    include: { cashier: true, correctedBy: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <PageContainer>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Historique des versements</h1>
        <VersementsManager cashRegisters={cashRegisters} />
      </div>
    </PageContainer>
  );
}

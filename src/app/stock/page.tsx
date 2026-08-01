import { PageContainer } from "@/components/page-container";
import { PeriodFilter } from "@/components/period-filter";
import { resolvePeriode } from "@/lib/periode";
import { getStock } from "@/lib/stock-data";
import { StockDashboard } from "./stock-dashboard";

export const dynamic = "force-dynamic";

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; debut?: string; fin?: string }>;
}) {
  const periode = resolvePeriode(await searchParams);
  const data = await getStock(periode);

  return (
    <PageContainer>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold">Stock</h1>
          <p className="mt-1 text-sm text-slate-500">
            Achats de la comptabilité, sorties vers la cuisine et niveau restant par produit.
          </p>
        </div>

        {/* Le filtre cadre les flux de la période ; le stock restant, lui, est
            toujours le solde du jour, quelle que soit la tranche affichée. */}
        <PeriodFilter
          preset={periode.preset}
          debut={periode.debutInput}
          fin={periode.finInput}
          label={periode.label}
        />

        <StockDashboard data={data} />
      </div>
    </PageContainer>
  );
}

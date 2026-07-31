import { PageContainer } from "@/components/page-container";
import { PeriodFilter } from "@/components/period-filter";
import { getComptabilite } from "@/lib/comptabilite";
import { resolvePeriode } from "@/lib/periode";
import { ComptabiliteDashboard } from "./comptabilite-dashboard";

export const dynamic = "force-dynamic";

export default async function ComptabilitePage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; debut?: string; fin?: string }>;
}) {
  const periode = resolvePeriode(await searchParams);
  const data = await getComptabilite(periode);

  return (
    <PageContainer>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold">Comptabilité</h1>
          <p className="mt-1 text-sm text-slate-500">
            Recettes versées par les caisses, ventes encaissées et dépenses engagées.
          </p>
        </div>

        <PeriodFilter
          preset={periode.preset}
          debut={periode.debutInput}
          fin={periode.finInput}
          label={periode.label}
        />

        <ComptabiliteDashboard data={data} />
      </div>
    </PageContainer>
  );
}

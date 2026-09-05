import Link from "next/link";
import { PageContainer } from "@/components/page-container";
import { getHistoriqueMois } from "@/lib/mois-historique";
import { HistoriqueDashboard } from "./historique-dashboard";

export const dynamic = "force-dynamic";

export default async function HistoriqueMoisPage() {
  const data = await getHistoriqueMois();

  return (
    <PageContainer>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">Les mois passés</h1>
            <p className="mt-1 text-sm text-slate-500">
              Les mois révolus, du plus récent au plus ancien. Seuls des mois complets figurent ici :
              c&apos;est ce qui les rend comparables entre eux.
            </p>
          </div>
          <Link href="/comptabilite/mois" className="text-xs text-orange-600 hover:underline">
            Le mois en cours
          </Link>
        </div>

        <HistoriqueDashboard data={data} />

        <p className="text-xs text-slate-400">
          Les recettes retenues ici sont les encaissements, comme sur la page du mois. La recette
          comptable officielle — celle des caisses clôturées — figure sur le{" "}
          <Link href="/comptabilite" className="underline">
            tableau de bord
          </Link>
          .
        </p>
      </div>
    </PageContainer>
  );
}

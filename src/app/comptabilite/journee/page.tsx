import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageContainer } from "@/components/page-container";
import { HEURE_DEBUT_JOURNEE } from "@/lib/journee-caisse";
import { getJourneeComptable } from "@/lib/journee-comptable";
import { JourneeCaissiers } from "./journee-caissiers";

export const dynamic = "force-dynamic";

export default async function JourneeComptablePage() {
  const data = await getJourneeComptable();

  return (
    <PageContainer>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">Journée en cours</h1>
            <p className="mt-1 text-sm text-slate-500">
              Ce que chaque caissier a encaissé aujourd&apos;hui, versé ou non.{" "}
              <span className="capitalize">{data.jourLabel}</span>, service de{" "}
              {HEURE_DEBUT_JOURNEE}h à {HEURE_DEBUT_JOURNEE}h le lendemain.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/comptabilite" className="text-xs text-orange-600 hover:underline">
              Tableau de bord
            </Link>
            <AutoRefresh intervalMs={15000} />
          </div>
        </div>

        <JourneeCaissiers data={data} />
      </div>
    </PageContainer>
  );
}

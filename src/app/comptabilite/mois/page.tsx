import Link from "next/link";
import { PageContainer } from "@/components/page-container";
import { getMoisComptable } from "@/lib/mois-comptable";
import { MoisDashboard } from "./mois-dashboard";

export const dynamic = "force-dynamic";

export default async function MoisComptablePage() {
  const data = await getMoisComptable();

  return (
    <PageContainer>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">
              Le mois en cours <span className="capitalize text-slate-400">· {data.moisLabel}</span>
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Recettes encaissées face aux dépenses engagées, et ce qu&apos;il reste à dépenser pour tenir
              le mois.
            </p>
          </div>
          <Link href="/comptabilite" className="text-xs text-orange-600 hover:underline">
            Tableau de bord
          </Link>
        </div>

        <MoisDashboard data={data} />

        <p className="text-xs text-slate-400">
          Les recettes retenues ici sont les encaissements, pour rester lisibles en cours de journée. La
          recette comptable officielle — celle des caisses clôturées — figure sur le{" "}
          <Link href="/comptabilite" className="underline">
            tableau de bord
          </Link>
          .
        </p>
      </div>
    </PageContainer>
  );
}

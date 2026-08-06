import Link from "next/link";
import { PageContainer } from "@/components/page-container";
import { getCaisseComptable } from "@/lib/caisse-comptable";
import { CaisseDashboard } from "./caisse-dashboard";

export const dynamic = "force-dynamic";

export default async function CaisseComptablePage() {
  const data = await getCaisseComptable();

  return (
    <PageContainer>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">Caisse de la comptabilité</h1>
            <p className="mt-1 text-sm text-slate-500">
              Les espèces gardées au coffre : ce que les caisses y versent, ce que les dépenses en
              sortent, et ce qu&apos;il reste.
            </p>
          </div>
          <Link href="/comptabilite" className="text-xs text-orange-600 hover:underline">
            Tableau de bord
          </Link>
        </div>

        {/* Le serveur est à GMT, celui du restaurant : le jour proposé au comptage
            est le sien, pas celui du navigateur qui regarde. */}
        <CaisseDashboard data={data} aujourdhui={new Date().toISOString().slice(0, 10)} />

        <p className="text-xs text-slate-400">
          Ce disponible ne mesure pas le résultat : une dépense reste une charge du mois où elle est
          engagée, quelle que soit l&apos;origine des espèces qui l&apos;ont payée. Le résultat se lit sur
          le{" "}
          <Link href="/comptabilite" className="underline">
            tableau de bord
          </Link>
          .
        </p>
      </div>
    </PageContainer>
  );
}

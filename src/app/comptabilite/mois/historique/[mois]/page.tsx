import Link from "next/link";
import { notFound } from "next/navigation";
import { startOfMonth } from "date-fns";
import { PageContainer } from "@/components/page-container";
import { getMoisClos } from "@/lib/mois-comptable";
import { MoisDashboard } from "../../mois-dashboard";

export const dynamic = "force-dynamic";

/**
 * Le mois désigné par une clé « 2026-08 », ou `null` si elle ne désigne pas un
 * mois révolu.
 *
 * L'adresse est saisissable à la main : la clé est donc vérifiée plutôt que
 * crue. Le mois en cours et tout ce qui vient après sont refusés ici, et pas
 * seulement absents du tableau — un mois entamé lu comme un mois clos afficherait
 * un taux de cinq jours au palier d'un mois entier.
 *
 * Le mois est construit en UTC, fuseau du serveur (`instrumentation.ts`) et du
 * restaurant : c'est celui dans lequel les dépenses saisies au jour sont
 * enregistrées.
 */
function moisRevolu(cle: string) {
  const trouve = /^(\d{4})-(\d{2})$/.exec(cle);
  if (!trouve) return null;

  const annee = Number(trouve[1]);
  const rang = Number(trouve[2]);
  if (rang < 1 || rang > 12) return null;

  const debut = new Date(Date.UTC(annee, rang - 1, 1));
  if (debut >= startOfMonth(new Date())) return null;
  return debut;
}

export default async function MoisClosPage({ params }: { params: Promise<{ mois: string }> }) {
  const { mois } = await params;

  const debut = moisRevolu(mois);
  if (!debut) notFound();

  const data = await getMoisClos(debut);

  // Un mois sans le moindre mouvement n'a pas existé pour la maison : mieux vaut
  // une page introuvable qu'un tableau de bord entièrement à zéro, qui se lirait
  // comme un mois catastrophique.
  if (data.nombreEncaissements === 0 && data.nombreDepenses === 0) notFound();

  return (
    <PageContainer>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="flex flex-wrap items-baseline gap-2 text-2xl font-semibold">
              <span className="capitalize">{data.moisLabel}</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
                Mois clos
              </span>
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Le mois tel qu&apos;il s&apos;est terminé, sur ses {data.joursDansLeMois} jours. Rien
              n&apos;y est projeté : il n&apos;y a plus de fin de mois à prévoir.
            </p>
          </div>
          <Link
            href="/comptabilite/mois/historique"
            className="text-xs text-orange-600 hover:underline"
          >
            Tous les mois passés
          </Link>
        </div>

        <MoisDashboard data={data} />

        <p className="text-xs text-slate-400">
          Les recettes retenues ici sont les encaissements, comme sur la page du mois en cours. La
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

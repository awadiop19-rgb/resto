import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/page-container";
import { prisma } from "@/lib/prisma";
import { CHART } from "@/lib/chart-theme";
import { formatFCFA, formatSignedFCFA } from "@/lib/format";
import { ExportVersementButton, type LigneEncaissement } from "./export-button";

export const dynamic = "force-dynamic";

function Ligne({
  label,
  value,
  hint,
  fort,
}: {
  label: string;
  value: string;
  hint?: string;
  fort?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <div>
        <span className={`text-sm ${fort ? "font-medium text-slate-900" : "text-slate-500"}`}>{label}</span>
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
      <span className={`tabular-nums ${fort ? "text-base font-semibold" : "text-sm"}`}>{value}</span>
    </div>
  );
}

export default async function VersementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const versement = await prisma.cashRegister.findUnique({
    where: { id },
    include: {
      cashier: { select: { name: true, email: true } },
      correctedBy: { select: { name: true } },
      payments: {
        include: {
          order: { include: { items: { include: { menuItem: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!versement) notFound();

  const totalCash = versement.payments
    .filter((p) => p.method === "CASH")
    .reduce((s, p) => s + p.amount, 0);
  const totalWave = versement.payments
    .filter((p) => p.method === "WAVE")
    .reduce((s, p) => s + p.amount, 0);
  const totalEncaisse = totalCash + totalWave;

  const cloturee = versement.status === "FERMEE";
  const attendu = versement.expectedCash ?? versement.openingFloat + totalCash;
  const declare = versement.declaredAmount;
  const ecart = versement.difference;
  const retenu = versement.correctedAmount ?? declare;
  const recetteNette = retenu != null ? retenu - versement.openingFloat : null;

  const partEspeces = totalEncaisse > 0 ? (totalCash / totalEncaisse) * 100 : 0;
  const partWave = totalEncaisse > 0 ? (totalWave / totalEncaisse) * 100 : 0;

  const lignes: LigneEncaissement[] = versement.payments.map((p) => ({
    heure: new Date(p.createdAt).toLocaleString("fr-FR"),
    commande: p.order.tableNumber
      ? `Table ${p.order.tableNumber}`
      : (p.order.customerName ?? "Commande en ligne"),
    articles: p.order.items.map((i) => `${i.quantity}x ${i.menuItem.name}`).join(", "),
    mode: p.method === "CASH" ? "Espèces" : "Wave",
    montant: p.amount,
  }));

  const enteteCsv: (string | number)[][] = [
    ["Versement", versement.id],
    ["Caissier", versement.cashier.name],
    ["Ouverture", new Date(versement.openedAt).toLocaleString("fr-FR")],
    ["Fermeture", versement.closedAt ? new Date(versement.closedAt).toLocaleString("fr-FR") : "En cours"],
    ["Fond de caisse", versement.openingFloat],
    ["Encaissé espèces", totalCash],
    ["Encaissé Wave", totalWave],
    ["Espèces attendues", attendu],
    ["Espèces déclarées", declare ?? ""],
    ["Écart", ecart ?? ""],
    ["Montant retenu", retenu ?? ""],
    ["Recette nette", recetteNette ?? ""],
  ];

  return (
    <PageContainer>
      <div className="space-y-5">
        <div>
          <Link href="/caisse/versements" className="text-sm text-orange-600 hover:underline">
            ← Retour aux versements
          </Link>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Versement de {versement.cashier.name}</h1>
              <p className="mt-1 text-sm text-slate-500">
                Caisse ouverte le {new Date(versement.openedAt).toLocaleString("fr-FR")}
                {versement.closedAt && ` · clôturée le ${new Date(versement.closedAt).toLocaleString("fr-FR")}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  cloturee ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                }`}
              >
                {cloturee ? "Clôturée" : "En cours"}
              </span>
              <ExportVersementButton
                filename={`versement_${versement.cashier.name.replace(/\s+/g, "_")}_${versement.id.slice(0, 6)}.csv`}
                entete={enteteCsv}
                lignes={lignes}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 font-semibold">Contrôle de caisse</h2>
            <div className="divide-y divide-slate-100">
              <Ligne label="Fond de caisse à l'ouverture" value={formatFCFA(versement.openingFloat)} />
              <Ligne label="Encaissé en espèces" value={formatFCFA(totalCash)} />
              <Ligne
                label="Espèces attendues"
                hint="Fond de caisse + encaissements espèces"
                value={formatFCFA(attendu)}
                fort
              />
              <Ligne
                label="Espèces déclarées"
                hint="Comptées dans le tiroir à la fermeture"
                value={declare != null ? formatFCFA(declare) : "—"}
                fort
              />
            </div>

            {cloturee && ecart != null && (
              <div
                className={`mt-3 rounded-md px-3 py-2 text-sm ${
                  ecart === 0
                    ? "bg-emerald-50 text-emerald-700"
                    : ecart < 0
                      ? "bg-red-50 text-red-700"
                      : "bg-amber-50 text-amber-800"
                }`}
              >
                <p className="font-semibold">
                  {ecart === 0 ? "Caisse juste" : `Écart de ${formatSignedFCFA(ecart)}`}
                  {ecart !== 0 && (ecart < 0 ? " (manquant)" : " (excédent)")}
                </p>
                {versement.note && <p className="mt-1">Motif : {versement.note}</p>}
              </div>
            )}
            {!cloturee && (
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Cette caisse n&apos;est pas encore clôturée : le versement n&apos;a pas eu lieu.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 font-semibold">Encaissements par mode</h2>
            {totalEncaisse > 0 ? (
              <>
                <div className="mt-3 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-slate-100">
                  <div style={{ width: `${partEspeces}%`, backgroundColor: CHART.especes }} />
                  <div style={{ width: `${partWave}%`, backgroundColor: CHART.wave }} />
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: CHART.especes }}
                    />
                    <span className="text-sm text-slate-600">Espèces</span>
                    <span className="ml-auto text-sm font-semibold tabular-nums">
                      {formatFCFA(totalCash)}
                    </span>
                    <span className="w-12 text-right text-xs text-slate-400 tabular-nums">
                      {partEspeces.toFixed(0)} %
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: CHART.wave }} />
                    <span className="text-sm text-slate-600">Wave</span>
                    <span className="ml-auto text-sm font-semibold tabular-nums">{formatFCFA(totalWave)}</span>
                    <span className="w-12 text-right text-xs text-slate-400 tabular-nums">
                      {partWave.toFixed(0)} %
                    </span>
                  </div>
                </div>
                <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
                  <Ligne label="Total encaissé" value={formatFCFA(totalEncaisse)} fort />
                  <Ligne label="Commandes encaissées" value={String(versement.payments.length)} />
                </div>
              </>
            ) : (
              <p className="py-10 text-center text-sm text-slate-400">Aucun encaissement sur cette caisse.</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 font-semibold">Ce que reçoit la comptabilité</h2>
            <div className="divide-y divide-slate-100">
              <Ligne
                label="Espèces remises"
                hint="Tiroir complet, fond de caisse inclus"
                value={retenu != null ? formatFCFA(retenu) : "—"}
              />
              <Ligne label="Dont fond de caisse" value={`− ${formatFCFA(versement.openingFloat)}`} />
              <Ligne
                label="Recette espèces"
                hint="Ce qui compte réellement comme recette"
                value={recetteNette != null ? formatFCFA(recetteNette) : "—"}
                fort
              />
              <Ligne label="Encaissements Wave" hint="Reçus directement sur Wave" value={formatFCFA(totalWave)} />
              <Ligne
                label="Total recettes"
                value={recetteNette != null ? formatFCFA(recetteNette + totalWave) : "—"}
                fort
              />
            </div>

            {versement.correctedAmount != null && (
              <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <p className="font-semibold">
                  Montant corrigé : {formatFCFA(versement.correctedAmount)} (déclaré :{" "}
                  {declare != null ? formatFCFA(declare) : "—"})
                </p>
                <p className="mt-1">{versement.correctionNote}</p>
                <p className="mt-1 text-xs text-amber-700">
                  par {versement.correctedBy?.name} le{" "}
                  {versement.correctedAt ? new Date(versement.correctedAt).toLocaleString("fr-FR") : ""}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold">
            Commandes encaissées <span className="text-sm font-normal text-slate-400">({lignes.length})</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="pb-2 pr-3 font-medium">Heure</th>
                  <th className="pb-2 pr-3 font-medium">Commande</th>
                  <th className="pb-2 pr-3 font-medium">Articles</th>
                  <th className="pb-2 pr-3 font-medium">Mode</th>
                  <th className="pb-2 pr-3 text-right font-medium">Montant</th>
                </tr>
              </thead>
              <tbody>
                {versement.payments.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 align-top">
                    <td className="whitespace-nowrap py-2 pr-3 text-slate-500">
                      {new Date(p.createdAt).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2 pr-3 font-medium">
                      {p.order.tableNumber
                        ? `Table ${p.order.tableNumber}`
                        : (p.order.customerName ?? "Commande en ligne")}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">
                      {p.order.items.map((i) => `${i.quantity}× ${i.menuItem.name}`).join(", ")}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-sm"
                          style={{
                            backgroundColor: p.method === "CASH" ? CHART.especes : CHART.wave,
                          }}
                        />
                        {p.method === "CASH" ? "Espèces" : "Wave"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold">{formatFCFA(p.amount)}</td>
                  </tr>
                ))}
                {versement.payments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      Aucune commande encaissée sur cette caisse.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

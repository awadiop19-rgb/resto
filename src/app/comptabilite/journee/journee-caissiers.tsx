"use client";

import Link from "next/link";
import { StatTile } from "@/components/stat-tile";
import { downloadCsv } from "@/lib/csv";
import { formatFCFA, formatSignedFCFA } from "@/lib/format";
import { TYPE_CLASSES, TYPE_LABELS } from "@/lib/libelles-commande";
import type { CaisseJournee, CaissierJournee, JourneeComptable } from "@/lib/journee-comptable";

const heure = (date: Date) =>
  new Date(date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** Comment désigner une commande en une colonne : ce que le caissier reconnaît. */
function libelleCommande(commande: {
  reference: string | null;
  tableNumber: number | null;
  customerName: string | null;
}) {
  if (commande.reference) return commande.reference;
  if (commande.tableNumber != null) return `Table ${commande.tableNumber}`;
  return commande.customerName ?? "Commande";
}

function Badge({ tone, children }: { tone: "ouverte" | "retard" | "fermee"; children: React.ReactNode }) {
  const classes = {
    ouverte: "bg-emerald-100 text-emerald-800",
    retard: "bg-red-100 text-red-700",
    fermee: "bg-slate-100 text-slate-600",
  }[tone];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${classes}`}>{children}</span>
  );
}

function Caisse({ caisse }: { caisse: CaisseJournee }) {
  return (
    <div className="rounded-lg border border-slate-200">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 px-3 py-2">
        {caisse.enRetard ? (
          <Badge tone="retard">
            Non clôturée · {caisse.jourLabel}
            {caisse.joursEcoules > 0 && ` (${caisse.joursEcoules} j)`}
          </Badge>
        ) : caisse.ouverte ? (
          <Badge tone="ouverte">Ouverte depuis {heure(caisse.openedAt)}</Badge>
        ) : (
          <Badge tone="fermee">
            Versée à {caisse.closedAt ? heure(caisse.closedAt) : "-"}
            {/* Un service qui déborde sur le lendemain : sans le jour d'ouverture,
                le versement paraîtrait porter sur la seule journée en cours. */}
            {caisse.ouverteAvantLaJournee && ` · ouverte ${caisse.jourLabel}`}
          </Badge>
        )}
        <span className="text-xs text-slate-400">
          Fond de caisse {formatFCFA(caisse.openingFloat)}
        </span>
        {/* Une caisse ouverte lors d'un service antérieur mêle deux journées :
            sans ce rappel, son total paraîtrait avoir été encaissé aujourd'hui. */}
        {caisse.ouverteAvantLaJournee && caisse.totalDuJour > 0 && caisse.totalDuJour !== caisse.total && (
          <span className="text-xs text-slate-400">
            dont {formatFCFA(caisse.totalDuJour)} aujourd&apos;hui
          </span>
        )}
        <span className="ml-auto text-sm font-semibold tabular-nums">
          {formatFCFA(caisse.total)}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-3 py-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-slate-400">Encaissements</dt>
          <dd className="font-medium tabular-nums">{caisse.nombreEncaissements}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Espèces</dt>
          <dd className="font-medium tabular-nums">{formatFCFA(caisse.totalCash)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Wave</dt>
          <dd className="font-medium tabular-nums">{formatFCFA(caisse.totalWave)}</dd>
        </div>
        {caisse.ouverte ? (
          <div>
            <dt className="text-xs text-slate-400">Attendu en tiroir</dt>
            <dd className="font-semibold tabular-nums">{formatFCFA(caisse.especesEnTiroir)}</dd>
          </div>
        ) : (
          <div>
            <dt className="text-xs text-slate-400">Écart constaté</dt>
            <dd className="font-semibold tabular-nums">
              {caisse.difference == null ? (
                <span className="text-slate-400">-</span>
              ) : caisse.difference === 0 ? (
                <span className="text-xs font-normal text-slate-400">Juste</span>
              ) : (
                <span className={caisse.difference < 0 ? "text-[#d03b3b]" : "text-[#b47400]"}>
                  {formatSignedFCFA(caisse.difference)}
                </span>
              )}
            </dd>
          </div>
        )}
      </dl>

      {!caisse.ouverte && (
        <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
          Déclaré {formatFCFA(caisse.declaredAmount ?? 0)} pour{" "}
          {formatFCFA(caisse.expectedCash ?? 0)} attendus
          {caisse.corrected && (
            <span className="ml-1 font-medium text-[#b47400]">
              · corrigé à {formatFCFA(caisse.retenu ?? 0)}
            </span>
          )}
          {caisse.note && <span className="ml-1 text-slate-400">· {caisse.note}</span>}
        </p>
      )}

      {caisse.encaissements.length > 0 && (
        <details className="border-t border-slate-100">
          <summary className="cursor-pointer px-3 py-2 text-xs text-orange-600 hover:underline">
            Détail des {caisse.encaissements.length} encaissement(s)
          </summary>
          <div className="overflow-x-auto px-3 pb-3">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="pb-1 pr-3 font-medium">Heure</th>
                  <th className="pb-1 pr-3 font-medium">Commande</th>
                  <th className="pb-1 pr-3 font-medium">Type</th>
                  <th className="pb-1 pr-3 font-medium">Mode</th>
                  <th className="pb-1 pr-3 text-right font-medium">Montant</th>
                </tr>
              </thead>
              <tbody>
                {caisse.encaissements.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="whitespace-nowrap py-1.5 pr-3 text-slate-500">{heure(e.paidAt)}</td>
                    <td className="py-1.5 pr-3 font-medium">{libelleCommande(e)}</td>
                    <td className="py-1.5 pr-3">
                      <span className={`rounded px-1.5 py-0.5 text-xs ${TYPE_CLASSES[e.type]}`}>
                        {TYPE_LABELS[e.type]}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-slate-600">
                      {e.method === "CASH" ? "Espèces" : "Wave"}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-medium">{formatFCFA(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

function Caissier({ caissier }: { caissier: CaissierJournee }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h3 className="font-semibold">{caissier.cashierName}</h3>
          <span className="text-xs text-slate-400">
            {caissier.nombreEncaissements} encaissement(s) · {caissier.caisses.length} caisse(s)
          </span>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums">{formatFCFA(caissier.total)}</p>
          {caissier.especesEnAttente > 0 && (
            <p className="text-xs text-[#b47400]">
              dont {formatFCFA(caissier.especesEnAttente)} en espèces non versées
            </p>
          )}
        </div>
      </div>
      <div className="space-y-3">
        {caissier.caisses.map((caisse) => (
          <Caisse key={caisse.id} caisse={caisse} />
        ))}
      </div>
    </div>
  );
}

export function JourneeCaissiers({ data }: { data: JourneeComptable }) {
  const {
    caissiers,
    commandesAEncaisser,
    totalAEncaisser,
    nombreWaveAVerifier,
    montantWaveAVerifier,
    impayeesAnterieures,
    totalEncaisse,
    nombreEncaissements,
    dejaVerse,
    especesEnAttente,
    especesEnTiroir,
    waveEnAttente,
    nombreCaissesOuvertes,
    caissesEnRetard,
  } = data;

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Caissier", "Caisse", "État", "Heure", "Commande", "Type", "Mode", "Montant"],
      ...caissiers.flatMap((caissier) =>
        caissier.caisses.flatMap((caisse) =>
          caisse.encaissements.map((e) => [
            caissier.cashierName,
            new Date(caisse.openedAt).toLocaleString("fr-FR"),
            caisse.enRetard ? "Non clôturée" : caisse.ouverte ? "Ouverte" : "Versée",
            new Date(e.paidAt).toLocaleString("fr-FR"),
            libelleCommande(e),
            TYPE_LABELS[e.type],
            e.method === "CASH" ? "Espèces" : "Wave",
            e.amount,
          ])
        )
      ),
    ];
    downloadCsv(`journee_caissiers_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Encaissé aujourd'hui"
          value={formatFCFA(totalEncaisse)}
          hint={`${nombreEncaissements} encaissement(s) du jour · ${caissiers.length} caissier(s) suivi(s)`}
        />
        <StatTile
          label="Déjà versé"
          value={formatFCFA(dejaVerse)}
          tone="bon"
          hint="Caisses clôturées, hors fond de caisse"
        />
        <StatTile
          label="En attente de versement"
          value={formatFCFA(especesEnAttente)}
          tone={especesEnAttente > 0 ? "alerte" : "neutre"}
          hint={
            nombreCaissesOuvertes === 0
              ? "Toutes les caisses sont versées"
              : `${nombreCaissesOuvertes} caisse(s) ouverte(s) · ${formatFCFA(especesEnTiroir)} attendus en tiroir`
          }
        />
        <StatTile
          label="Reste à encaisser"
          value={formatFCFA(totalAEncaisser)}
          tone={totalAEncaisser > 0 ? "critique" : "neutre"}
          hint={`${commandesAEncaisser.length} commande(s) non réglée(s)`}
        />
      </div>

      {caissesEnRetard.length > 0 && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {caissesEnRetard.length} caisse(s) laissée(s) ouverte(s) sur une journée antérieure
          {" ("}
          {caissesEnRetard.map((c) => c.jourLabel).join(", ")}
          {"). "}
          Chaque caissier concerné reste bloqué tant que sa caisse n&apos;est pas clôturée.
        </p>
      )}

      {impayeesAnterieures.nombre > 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {impayeesAnterieures.nombre} commande(s) des services précédents ne sont toujours pas
          encaissées.{" "}
          {impayeesAnterieures.jour && (
            <Link href={`/caisse?jour=${impayeesAnterieures.jour}`} className="underline">
              Voir la plus ancienne
            </Link>
          )}
        </p>
      )}

      <p className="text-xs text-slate-400">
        Les montants en attente ne sont pas des recettes : seule la clôture d&apos;une caisse fait
        entrer un versement en comptabilité. Wave encaissé mais non clôturé :{" "}
        {formatFCFA(waveEnAttente)}.
      </p>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Par caissier</h2>
          {nombreEncaissements > 0 && (
            <button type="button" onClick={exportCsv} className="text-xs text-slate-600 hover:underline">
              Exporter CSV
            </button>
          )}
        </div>
        {caissiers.length > 0 ? (
          <div className="space-y-4">
            {caissiers.map((caissier) => (
              <Caissier key={caissier.cashierId} caissier={caissier} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-slate-200 bg-white py-10 text-center text-sm text-slate-400">
            Aucune caisse ouverte sur cette journée.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">En attente d&apos;encaissement</h2>
          {nombreWaveAVerifier > 0 && (
            <span className="text-xs text-[#b47400]">
              {nombreWaveAVerifier} paiement(s) Wave déclaré(s) par le client à vérifier ·{" "}
              {formatFCFA(montantWaveAVerifier)}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-400">
                <th className="pb-2 pr-3 font-medium">Heure</th>
                <th className="pb-2 pr-3 font-medium">Commande</th>
                <th className="pb-2 pr-3 font-medium">Type</th>
                <th className="pb-2 pr-3 font-medium">Origine</th>
                <th className="pb-2 pr-3 font-medium">Wave</th>
                <th className="pb-2 pr-3 text-right font-medium">Montant</th>
              </tr>
            </thead>
            <tbody>
              {commandesAEncaisser.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap py-2 pr-3 text-slate-500">{heure(c.createdAt)}</td>
                  <td className="py-2 pr-3 font-medium">{libelleCommande(c)}</td>
                  <td className="py-2 pr-3">
                    <span className={`rounded px-1.5 py-0.5 text-xs ${TYPE_CLASSES[c.type]}`}>
                      {TYPE_LABELS[c.type]}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-slate-600">
                    {c.source === "EN_LIGNE" ? "En ligne" : "Comptoir"}
                  </td>
                  <td className="py-2 pr-3">
                    {c.waveDeclaredAt ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        Déclaré {heure(c.waveDeclaredAt)}
                        {c.waveReference && ` · ${c.waveReference}`}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right font-medium">{formatFCFA(c.montant)}</td>
                </tr>
              ))}
              {commandesAEncaisser.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    Toutes les commandes de la journée sont encaissées.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnnulerEncaissement } from "@/components/annuler-encaissement";
import { StatTile } from "@/components/stat-tile";
import { corrigerModePaiement } from "@/lib/actions/caisse";
import { annulerCommandeImpayee } from "@/lib/actions/orders";
import { assurerSucces } from "@/lib/actions/resultat";
import { downloadCsv } from "@/lib/csv";
import { formatDateHeure, formatFCFA, formatHeure, formatSignedFCFA } from "@/lib/format";
import { TYPE_CLASSES, TYPE_LABELS, libelleCourtCommande } from "@/lib/libelles-commande";
import type {
  CaisseJournee,
  CaissierJournee,
  CommandeAEncaisser,
  EncaissementLigne,
  JourneeComptable,
} from "@/lib/journee-comptable";

const MODE_LABELS = { CASH: "Espèces", WAVE: "Wave" } as const;

/**
 * Rectification du mode d'un encaissement par la comptabilité.
 *
 * Le montant n'est jamais touché : seule la touche pressée par le caissier est
 * en cause. Le motif est exigé ici comme il l'est côté serveur — une recette qui
 * bascule d'espèces à Wave doit rester explicable.
 */
function CorrigerMode({ encaissement }: { encaissement: EncaissementLigne }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const cible = encaissement.method === "CASH" ? "WAVE" : "CASH";

  function soumettre() {
    setErreur(null);
    demarrer(async () => {
      try {
        assurerSucces(
          await corrigerModePaiement({ paymentId: encaissement.id, method: cible, note: motif })
        );
        setOuvert(false);
        setMotif("");
        router.refresh();
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "La correction a échoué");
      }
    });
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="text-xs text-orange-600 hover:underline"
      >
        Corriger
      </button>
    );
  }

  return (
    <div className="mt-1 space-y-1.5 rounded-md border border-orange-200 bg-orange-50/60 p-2">
      <p className="text-xs text-slate-600">
        Requalifier en <span className="font-semibold">{MODE_LABELS[cible]}</span>
      </p>
      <input
        type="text"
        value={motif}
        onChange={(e) => setMotif(e.target.value)}
        placeholder="Raison de la correction"
        maxLength={200}
        autoFocus
        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
      />
      {erreur && <p className="text-xs text-red-700">{erreur}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={soumettre}
          disabled={enCours || motif.trim().length === 0}
          className="rounded bg-orange-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOuvert(false);
            setErreur(null);
          }}
          disabled={enCours}
          className="rounded px-2 py-1 text-xs text-slate-600 hover:underline"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

/**
 * Annulation d'une commande restée impayée, qu'elle vienne du site ou du
 * comptoir.
 *
 * Le motif est exigé ici comme il l'est côté serveur : ce qui quitte la journée
 * doit rester explicable. La confirmation tient dans le fait d'écrire la raison
 * — demander « êtes-vous sûr ? » par-dessus n'ajouterait qu'un clic machinal.
 */
function AnnulerCommande({ commande }: { commande: CommandeAEncaisser }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function soumettre() {
    setErreur(null);
    demarrer(async () => {
      try {
        assurerSucces(await annulerCommandeImpayee({ orderId: commande.id, motif }));
        setOuvert(false);
        setMotif("");
        router.refresh();
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "L'annulation a échoué");
      }
    });
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="text-xs text-red-700 hover:underline"
      >
        Annuler
      </button>
    );
  }

  return (
    <div className="mt-1 space-y-1.5 rounded-md border border-red-200 bg-red-50/60 p-2 text-left">
      <p className="text-xs text-slate-600">
        Retirer <span className="font-semibold">{libelleCommande(commande)}</span> de la journée
      </p>
      <input
        type="text"
        value={motif}
        onChange={(e) => setMotif(e.target.value)}
        placeholder="Motif (client parti sans payer, injoignable, doublon…)"
        maxLength={300}
        autoFocus
        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
      />
      {erreur && <p className="text-xs text-red-700">{erreur}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={soumettre}
          disabled={enCours || motif.trim().length < 5}
          className="rounded bg-red-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {enCours ? "Annulation…" : "Confirmer l'annulation"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOuvert(false);
            setErreur(null);
          }}
          disabled={enCours}
          className="rounded px-2 py-1 text-xs text-slate-600 hover:underline"
        >
          Renoncer
        </button>
      </div>
    </div>
  );
}

/**
 * Le même libellé que celui porté par le remboursement d'une commande annulée :
 * les deux doivent se reconnaître l'un l'autre dans la liste des dépenses.
 */
const libelleCommande = libelleCourtCommande;

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
          <Badge tone="ouverte">Ouverte depuis {formatHeure(caisse.openedAt)}</Badge>
        ) : (
          <Badge tone="fermee">
            Versée à {caisse.closedAt ? formatHeure(caisse.closedAt) : "-"}
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

      {/* Sans ce détail, l'écart entre l'encaissé et le versé resterait
          inexpliqué : la différence est sortie du tiroir pendant le service. */}
      {caisse.sortiesCaisse > 0 && (
        <details className="border-t border-slate-100">
          <summary className="cursor-pointer px-3 py-2 text-xs text-[#b47400] hover:underline">
            {formatFCFA(caisse.sortiesCaisse)} sortis du tiroir ·{" "}
            {caisse.depensesCaisse.length} dépense(s) de caisse
          </summary>
          <ul className="px-3 pb-3 text-sm">
            {caisse.depensesCaisse.map((d) => (
              <li key={d.id} className="flex items-baseline gap-2 border-t border-slate-100 py-1.5">
                <span className="text-xs text-slate-500 tabular-nums">{formatHeure(d.date)}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{d.category}</span>
                <span className="text-slate-600">{d.label}</span>
                <span className="ml-auto font-medium tabular-nums">{formatFCFA(d.amount)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

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
                    <td className="whitespace-nowrap py-1.5 pr-3 text-slate-500">{formatHeure(e.paidAt)}</td>
                    <td className="py-1.5 pr-3">
                      {/* Barrée plutôt que retirée : l'encaissement a bien eu
                          lieu, et la journée doit continuer de le montrer. */}
                      <span className={`font-medium ${e.annulation ? "line-through text-slate-400" : ""}`}>
                        {libelleCommande(e)}
                      </span>
                      <AnnulerEncaissement
                        orderId={e.orderId}
                        libelle={libelleCommande(e)}
                        montant={e.amount}
                        poche={e.poche}
                        annulation={e.annulation}
                      />
                    </td>
                    <td className="py-1.5 pr-3">
                      <span className={`rounded px-1.5 py-0.5 text-xs ${TYPE_CLASSES[e.type]}`}>
                        {TYPE_LABELS[e.type]}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-slate-600">
                      <div className="flex items-center gap-2">
                        <span>{MODE_LABELS[e.method]}</span>
                        {/* Corriger n'a de sens que tant que rien n'est versé :
                            après clôture, les totaux de la caisse sont figés. */}
                        {caisse.ouverte && <CorrigerMode encaissement={e} />}
                      </div>
                      {e.correction && (
                        <p className="mt-0.5 text-xs text-[#b47400]">
                          corrigé depuis {MODE_LABELS[e.correction.modeOrigine]}
                          {e.correction.motif && ` · ${e.correction.motif}`}
                          {e.correction.auteur && ` · ${e.correction.auteur}`} ·{" "}
                          {formatHeure(e.correction.date)}
                        </p>
                      )}
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
    commandesAnnulees,
    totalAnnule,
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
      [
        "Caissier",
        "Caisse",
        "État",
        "Heure",
        "Commande",
        "Type",
        "Mode",
        "Montant",
        "Mode saisi à l'origine",
        "Motif de la correction",
        "Corrigé par",
      ],
      ...caissiers.flatMap((caissier) =>
        caissier.caisses.flatMap((caisse) =>
          caisse.encaissements.map((e) => [
            caissier.cashierName,
            formatDateHeure(caisse.openedAt),
            caisse.enRetard ? "Non clôturée" : caisse.ouverte ? "Ouverte" : "Versée",
            formatDateHeure(e.paidAt),
            libelleCommande(e),
            TYPE_LABELS[e.type],
            MODE_LABELS[e.method],
            e.amount,
            e.correction ? MODE_LABELS[e.correction.modeOrigine] : "",
            e.correction?.motif ?? "",
            e.correction?.auteur ?? "",
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
                <th className="pb-2 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {commandesAEncaisser.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap py-2 pr-3 text-slate-500">{formatHeure(c.createdAt)}</td>
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
                        Déclaré {formatHeure(c.waveDeclaredAt)}
                        {c.waveReference && ` · ${c.waveReference}`}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right font-medium">{formatFCFA(c.montant)}</td>
                  <td className="py-2 text-right align-top">
                    {/* Comptoir ou site, une commande jamais réglée doit pouvoir
                        quitter la journée : sans cela, elle gonfle le reste à
                        encaisser indéfiniment. Le motif écrit est ce qui rend le
                        retrait vérifiable. */}
                    <AnnulerCommande commande={c} />
                  </td>
                </tr>
              ))}
              {commandesAEncaisser.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    Toutes les commandes de la journée sont encaissées.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------- Annulations */}
      {/* Affichées seulement s'il y en a : une section vide chaque jour finirait
          par ne plus être lue, et c'est justement celle qu'il faut relire. */}
      {commandesAnnulees.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">Commandes annulées aujourd&apos;hui</h2>
            <span className="text-xs text-slate-500">
              {commandesAnnulees.length} commande(s) · {formatFCFA(totalAnnule)} retirés de
              l&apos;attente d&apos;encaissement
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="pb-2 pr-3 font-medium">Annulée à</th>
                  <th className="pb-2 pr-3 font-medium">Commande</th>
                  <th className="pb-2 pr-3 font-medium">Motif</th>
                  <th className="pb-2 pr-3 font-medium">Par</th>
                  <th className="pb-2 text-right font-medium">Montant</th>
                </tr>
              </thead>
              <tbody>
                {commandesAnnulees.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="whitespace-nowrap py-2 pr-3 text-slate-500">
                      {formatHeure(c.cancelledAt)}
                    </td>
                    <td className="py-2 pr-3 font-medium">{libelleCommande(c)}</td>
                    <td className="py-2 pr-3 text-slate-600">{c.motif ?? "—"}</td>
                    <td className="py-2 pr-3 text-slate-500">{c.auteur ?? "—"}</td>
                    <td className="py-2 text-right text-slate-500 line-through">
                      {formatFCFA(c.montant)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

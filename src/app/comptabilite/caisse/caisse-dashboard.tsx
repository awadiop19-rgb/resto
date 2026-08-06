"use client";

import { useState, useTransition } from "react";
import { StatTile } from "@/components/stat-tile";
import { enregistrerComptageCaisse } from "@/lib/actions/caisse-comptable";
import { assurerSucces } from "@/lib/actions/resultat";
import { downloadCsv } from "@/lib/csv";
import { formatDate, formatDateHeure, formatFCFA, formatSignedFCFA } from "@/lib/format";
import type { CaisseComptable } from "@/lib/caisse-comptable";

/** Une ligne du rapprochement : intitulé à gauche, montant aligné à droite. */
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
        <span className={`text-sm ${fort ? "font-medium text-slate-900" : "text-slate-500"}`}>
          {label}
        </span>
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
      <span className={`tabular-nums ${fort ? "text-base font-semibold" : "text-sm"}`}>{value}</span>
    </div>
  );
}

function FormulaireComptage({
  aujourdhui,
  amorcee,
}: {
  aujourdhui: string;
  /** Le premier comptage amorce la caisse ; les suivants la recalent. */
  amorcee: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ date: aujourdhui, amount: "", note: "" });

  function submit() {
    setError(null);
    if (form.amount === "" || Number.isNaN(Number(form.amount))) {
      setError("Indiquez le montant compté dans le coffre");
      return;
    }
    startTransition(async () => {
      try {
        assurerSucces(
          await enregistrerComptageCaisse({
            date: form.date,
            amount: Number(form.amount),
            note: form.note.trim() || undefined,
          })
        );
        setForm({ date: aujourdhui, amount: "", note: "" });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="font-semibold">{amorcee ? "Recompter le coffre" : "Amorcer la caisse"}</h2>
      <p className="mt-0.5 mb-3 text-xs text-slate-400">
        Les espèces réellement présentes au matin de ce jour. Tout ce qui entre ou sort à partir de là
        s&apos;y ajoute.
      </p>
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-4">
        <input
          type="date"
          aria-label="Date du comptage"
          value={form.date}
          max={aujourdhui}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <input
          type="number"
          min={0}
          placeholder="Montant compté"
          aria-label="Montant compté"
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <input
          placeholder="Motif (facultatif)"
          aria-label="Motif du comptage"
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          disabled={isPending}
          onClick={submit}
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
}

export function CaisseDashboard({
  data,
  aujourdhui,
}: {
  data: CaisseComptable;
  aujourdhui: string;
}) {
  if (!data.amorcee) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">La caisse n&apos;a pas encore été comptée.</p>
          <p className="mt-1">
            Tant qu&apos;aucun comptage ne dit ce que contenait le coffre au départ, le disponible ne
            peut pas être calculé : les versements enregistrés ne suffisent pas à expliquer ce qui s&apos;y
            trouvait déjà.
          </p>
        </div>
        <FormulaireComptage aujourdhui={aujourdhui} amorcee={false} />
      </div>
    );
  }

  const {
    dernier,
    versementsRecus,
    nombreVersements,
    fondsConfies,
    depensesReglees,
    nombreDepenses,
    disponible,
    mouvements,
    comptages,
  } = data;

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Date", "Mouvement", "Détail", "Montant (F)", "Solde (F)"],
      [formatDate(dernier.countedAt), "Comptage du coffre", dernier.note ?? "", dernier.amount, dernier.amount],
      ...mouvements.map((m) => [
        formatDate(m.date),
        m.libelle,
        m.detail ?? "",
        m.montant,
        m.solde,
      ]),
    ];
    downloadCsv(`caisse_comptable_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Comptage de départ"
          value={formatFCFA(dernier.amount)}
          hint={`Coffre compté le ${formatDate(dernier.countedAt)}`}
        />
        <StatTile
          label="Versements reçus"
          value={formatFCFA(versementsRecus)}
          tone="bon"
          hint={`${nombreVersements} caisse(s) clôturée(s) depuis`}
        />
        <StatTile
          label="Dépenses réglées"
          value={formatFCFA(depensesReglees)}
          tone="critique"
          hint={`${nombreDepenses} dépense(s) payée(s) au coffre`}
        />
        <StatTile
          label="Disponible au coffre"
          value={formatFCFA(disponible)}
          tone={disponible < 0 ? "critique" : "bon"}
          hint="À l'instant"
        />
      </div>

      {/* Un disponible négatif n'est pas une caisse dans le rouge : c'est un
          comptage qui ne colle plus, ou de l'argent entré sans être enregistré.
          Le dire évite de chercher un vol là où il y a une saisie manquante. */}
      {disponible < 0 && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Le coffre est calculé à découvert : il a payé {formatFCFA(-disponible)} de plus qu&apos;il
          n&apos;a reçu depuis le dernier comptage. Un versement non enregistré, un apport extérieur ou
          un comptage trop ancien l&apos;expliquent le plus souvent — recomptez le coffre pour le
          recaler.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 font-semibold">Rapprochement</h2>
          <div className="divide-y divide-slate-100">
            <Ligne
              label="Compté au coffre"
              hint={`Au matin du ${formatDate(dernier.countedAt)}`}
              value={formatFCFA(dernier.amount)}
            />
            <Ligne
              label="Versements reçus"
              hint="Tiroirs remis, fond de caisse compris"
              value={`+ ${formatFCFA(versementsRecus)}`}
            />
            <Ligne
              label="Fonds de caisse confiés"
              hint="Sortis le matin, ils rentrent dans le versement du soir"
              value={`− ${formatFCFA(fondsConfies)}`}
            />
            <Ligne
              label="Dépenses réglées au coffre"
              hint="Hors dépenses payées depuis un tiroir de caissier"
              value={`− ${formatFCFA(depensesReglees)}`}
            />
            <Ligne label="Disponible" value={formatFCFA(disponible)} fort />
          </div>
          {dernier.note && (
            <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Comptage : {dernier.note}
            </p>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">Livre de caisse</h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Chaque entrée et chaque sortie depuis le comptage du {formatDate(dernier.countedAt)}
                </p>
              </div>
              {mouvements.length > 0 && (
                <button type="button" onClick={exportCsv} className="text-xs text-slate-600 hover:underline">
                  Exporter CSV
                </button>
              )}
            </div>
            <div className="max-h-112 overflow-auto">
              <table className="w-full text-sm tabular-nums">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-xs uppercase text-slate-400">
                    <th className="pb-2 pr-3 font-medium">Date</th>
                    <th className="pb-2 pr-3 font-medium">Mouvement</th>
                    <th className="pb-2 pr-3 text-right font-medium">Montant</th>
                    <th className="pb-2 text-right font-medium">Solde</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-100 bg-slate-50/60">
                    <td className="whitespace-nowrap py-2 pr-3 text-slate-500">
                      {formatDate(dernier.countedAt)}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="font-medium">Comptage du coffre</span>
                      <p className="text-xs text-slate-400">Point de départ</p>
                    </td>
                    <td className="py-2 pr-3 text-right text-slate-400">—</td>
                    <td className="py-2 text-right font-semibold">{formatFCFA(dernier.amount)}</td>
                  </tr>
                  {mouvements.map((m) => (
                    <tr key={m.id} className="border-t border-slate-100 align-top">
                      <td className="whitespace-nowrap py-2 pr-3 text-slate-500">{formatDate(m.date)}</td>
                      <td className="py-2 pr-3">
                        <span className="font-medium">{m.libelle}</span>
                        {m.detail && <p className="text-xs text-slate-400">{m.detail}</p>}
                      </td>
                      <td
                        className={`whitespace-nowrap py-2 pr-3 text-right font-medium ${
                          m.montant < 0 ? "text-[#d03b3b]" : "text-[#0ca30c]"
                        }`}
                      >
                        {formatSignedFCFA(m.montant)}
                      </td>
                      <td className="whitespace-nowrap py-2 text-right">{formatFCFA(m.solde)}</td>
                    </tr>
                  ))}
                  {mouvements.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        Aucun mouvement depuis le comptage.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Une dépense est datée au jour, un versement à l'heure de clôture :
                dans l'ordre chronologique, les achats du matin passent donc tous
                avant la remise du soir, et le solde peut plonger sans que le
                coffre ait jamais été vide. Seule la dernière ligne se compare au
                disponible. */}
            <p className="mt-3 text-xs text-slate-400">
              Les dépenses sont datées au jour et les versements à l&apos;heure de clôture : en cours de
              journée, le solde passe donc par les achats avant d&apos;encaisser la remise du soir. Un
              creux passager n&apos;est pas un découvert — seule la dernière ligne fait foi.
            </p>
          </div>
        </div>
      </div>

      <FormulaireComptage aujourdhui={aujourdhui} amorcee />

      {comptages.length > 1 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Comptages précédents</h2>
          <p className="mt-0.5 mb-3 text-xs text-slate-400">
            Seul le plus récent sert de point de départ ; les autres restent pour que chaque recalage
            puisse être vérifié.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="pb-2 pr-3 font-medium">Date comptée</th>
                  <th className="pb-2 pr-3 font-medium">Montant</th>
                  <th className="pb-2 pr-3 font-medium">Motif</th>
                  <th className="pb-2 pr-3 font-medium">Saisi par</th>
                </tr>
              </thead>
              <tbody>
                {comptages.slice(1).map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="whitespace-nowrap py-2 pr-3">{formatDate(c.countedAt)}</td>
                    <td className="py-2 pr-3 font-medium">{formatFCFA(c.amount)}</td>
                    <td className="py-2 pr-3 text-slate-500">{c.note ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs text-slate-400">
                      {c.auteur} · {formatDateHeure(c.createdAt)}
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

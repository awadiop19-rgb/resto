"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createExpense, deleteExpense, type DoublonPresume } from "@/lib/actions/expenses";
import { assurerSucces } from "@/lib/actions/resultat";
import { downloadCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";

type Expense = {
  id: string;
  label: string;
  amount: number;
  category: string;
  date: Date;
  user: { name: string };
};

const CATEGORIES = ["Ingrédients", "Boissons", "Équipement", "Salaires", "Loyer", "Autre"];

export function ExpenseManager({
  expenses,
  debut,
  fin,
  aujourdhui,
}: {
  expenses: Expense[];
  debut: string;
  fin: string;
  /** Jour courant calculé côté serveur, donc à GMT comme le reste de l'application. */
  aujourdhui: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [doublon, setDoublon] = useState<DoublonPresume | null>(null);
  const [periode, setPeriode] = useState({ debut, fin });
  const [form, setForm] = useState({
    label: "",
    amount: "",
    category: CATEGORIES[0],
    date: aujourdhui,
  });

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const surUnJour = debut === fin;
  // Le Z n'est pas decoratif : sans lui, "2026-08-03T00:00:00" serait lu dans le
  // fuseau du navigateur, et le libelle annoncerait la veille depuis l'est de GMT.
  const jour = (iso: string) => formatDate(`${iso}T00:00:00Z`);
  const libellePeriode = surUnJour
    ? `${debut === aujourdhui ? "Aujourd'hui · " : ""}${jour(debut)}`
    : `Du ${jour(debut)} au ${jour(fin)}`;

  function voir(d: string, f: string) {
    setPeriode({ debut: d, fin: f });
    router.push(`/depenses?debut=${d}&fin=${f}`);
  }

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Date", "Libellé", "Catégorie", "Montant (F)", "Ajouté par"],
      ...expenses.map((e) => [
        formatDate(e.date),
        e.label,
        e.category,
        e.amount,
        e.user.name,
      ]),
    ];
    downloadCsv(`depenses_${debut}_${fin}.csv`, rows);
  }

  // Une dépense adossée à un achat de stock refuse d'être supprimée seule :
  // l'erreur doit remonter à l'écran, pas mourir dans la transition.
  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        assurerSucces(await deleteExpense(id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Suppression impossible");
      }
    });
  }

  // `confirme` n'est vrai qu'au second envoi, celui qui répond à l'avertissement
  // de doublon : la saisie n'est jamais bloquée, seulement questionnée une fois.
  function submit(confirme = false) {
    setError(null);
    setDoublon(null);
    if (!form.label || !form.amount) {
      setError("Libellé et montant requis");
      return;
    }
    startTransition(async () => {
      try {
        const resultat = assurerSucces(
          await createExpense({
            label: form.label,
            amount: Number(form.amount),
            category: form.category,
            date: form.date,
            confirme,
          })
        );
        if (resultat) {
          setDoublon(resultat);
          return;
        }
        const enregistree = form.date;
        setForm({ label: "", amount: "", category: CATEGORIES[0], date: aujourdhui });
        // Une dépense datée hors de la période affichée n'apparaîtrait nulle part :
        // enregistrée pour de bon, mais invisible. On va la montrer où elle est.
        if (enregistree < debut || enregistree > fin) voir(enregistree, enregistree);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de l'ajout");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">Ajouter une dépense</h2>
        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {/* Ambre et non rouge : rien n'est refusé, on demande seulement si le
            marché n'a pas déjà été saisi par la page Stock. */}
        {doublon && (
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p>
              {doublon.motif === "produit"
                ? "Le même produit a déjà été acheté en stock ce jour-là : "
                : "Un achat de stock du même montant a déjà été enregistré ce jour-là : "}
              <span className="font-medium">« {doublon.doublonAvec} »</span> à{" "}
              {doublon.montant.toLocaleString("fr-FR")} F. Cet achat compte déjà comme dépense — le
              ressaisir doublerait la charge.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={isPending}
                onClick={() => submit(true)}
                className="rounded-md border border-amber-400 px-3 py-1 text-xs font-medium hover:bg-amber-100 disabled:opacity-50"
              >
                C&apos;est un autre achat, enregistrer
              </button>
              <button
                type="button"
                onClick={() => setDoublon(null)}
                className="text-xs underline hover:no-underline"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-4">
          <input
            placeholder="Libellé"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:col-span-2"
          />
          <input
            type="number"
            placeholder="Montant"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
          <select
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button
            disabled={isPending}
            onClick={() => submit()}
            className="rounded-md bg-black px-4 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-50 sm:col-span-1"
          >
            Ajouter
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500" htmlFor="dateDebut">
                Du
              </label>
              <input
                id="dateDebut"
                type="date"
                value={periode.debut}
                onChange={(e) => setPeriode((p) => ({ ...p, debut: e.target.value }))}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500" htmlFor="dateFin">
                Au
              </label>
              <input
                id="dateFin"
                type="date"
                value={periode.fin}
                onChange={(e) => setPeriode((p) => ({ ...p, fin: e.target.value }))}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => voir(periode.debut, periode.fin)}
              className="rounded-md bg-black px-4 py-1.5 text-sm text-white hover:bg-neutral-800"
            >
              Afficher
            </button>
            {!surUnJour || debut !== aujourdhui ? (
              <button
                type="button"
                onClick={() => voir(aujourdhui, aujourdhui)}
                className="rounded-md border border-slate-300 px-4 py-1.5 text-sm hover:bg-slate-50"
              >
                Aujourd&apos;hui
              </button>
            ) : null}
          </div>
        </div>

        {/* Le total ne vaut que pour la periode affichee : la nommer a cote evite
            de le lire comme le total de toutes les depenses. */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <h2 className="font-semibold">{libellePeriode}</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              {expenses.length} dépense{expenses.length > 1 ? "s" : ""} · Total :{" "}
              {total.toLocaleString("fr-FR")} F
            </span>
            {expenses.length > 0 && (
              <button
                type="button"
                onClick={exportCsv}
                className="text-xs text-slate-600 hover:underline"
              >
                Exporter CSV
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-400">
              <th className="pb-2">Date</th>
              <th className="pb-2">Libellé</th>
              <th className="pb-2">Catégorie</th>
              <th className="pb-2">Montant</th>
              <th className="pb-2">Ajouté par</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id} className="border-t border-slate-100">
                <td className="py-2 pr-2">{formatDate(expense.date)}</td>
                <td className="py-2 pr-2">{expense.label}</td>
                <td className="py-2 pr-2">{expense.category}</td>
                <td className="py-2 pr-2">{expense.amount.toLocaleString("fr-FR")} F</td>
                <td className="py-2 pr-2 text-slate-500">{expense.user.name}</td>
                <td className="py-2 pr-2 text-right">
                  <button
                    onClick={() => remove(expense.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-slate-400">
                  {surUnJour ? "Aucune dépense ce jour-là." : "Aucune dépense sur cette période."}
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

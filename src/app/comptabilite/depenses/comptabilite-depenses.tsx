"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export function ComptabiliteDepenses({
  expenses,
  debut,
  fin,
}: {
  expenses: Expense[];
  debut: string;
  fin: string;
}) {
  const router = useRouter();
  const [dateDebut, setDateDebut] = useState(debut);
  const [dateFin, setDateFin] = useState(fin);

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  function applyFilter() {
    const params = new URLSearchParams();
    if (dateDebut) params.set("debut", dateDebut);
    if (dateFin) params.set("fin", dateFin);
    router.push(`/comptabilite/depenses${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function resetFilter() {
    setDateDebut("");
    setDateFin("");
    router.push("/comptabilite/depenses");
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
    downloadCsv(`comptabilite_depenses_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">Filtrer par période</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500" htmlFor="dateDebut">
              Date début
            </label>
            <input
              id="dateDebut"
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500" htmlFor="dateFin">
              Date fin
            </label>
            <input
              id="dateFin"
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={applyFilter}
              className="rounded-md bg-slate-900 px-4 py-1.5 text-sm text-white hover:bg-slate-800"
            >
              Filtrer
            </button>
            <button
              onClick={resetFilter}
              className="rounded-md border border-slate-300 px-4 py-1.5 text-sm hover:bg-slate-50"
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Dépenses</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">Total : {total.toLocaleString("fr-FR")} F</span>
            {expenses.length > 0 && (
              <button type="button" onClick={exportCsv} className="text-xs text-slate-600 hover:underline">
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
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-slate-400">
                  Aucune dépense sur cette période.
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

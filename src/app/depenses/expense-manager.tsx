"use client";

import { useState, useTransition } from "react";
import { createExpense, deleteExpense } from "@/lib/actions/expenses";
import { downloadCsv } from "@/lib/csv";

type Expense = {
  id: string;
  label: string;
  amount: number;
  category: string;
  date: Date;
  user: { name: string };
};

const CATEGORIES = ["Ingrédients", "Boissons", "Équipement", "Salaires", "Loyer", "Autre"];

export function ExpenseManager({ expenses }: { expenses: Expense[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    label: "",
    amount: "",
    category: CATEGORIES[0],
    date: new Date().toISOString().slice(0, 10),
  });

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Date", "Libellé", "Catégorie", "Montant (F)", "Ajouté par"],
      ...expenses.map((e) => [
        new Date(e.date).toLocaleDateString("fr-FR"),
        e.label,
        e.category,
        e.amount,
        e.user.name,
      ]),
    ];
    downloadCsv(`depenses_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  function submit() {
    setError(null);
    if (!form.label || !form.amount) {
      setError("Libellé et montant requis");
      return;
    }
    startTransition(async () => {
      try {
        await createExpense({
          label: form.label,
          amount: Number(form.amount),
          category: form.category,
          date: form.date,
        });
        setForm({ label: "", amount: "", category: CATEGORIES[0], date: new Date().toISOString().slice(0, 10) });
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
            onClick={submit}
            className="rounded-md bg-black px-4 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-50 sm:col-span-1"
          >
            Ajouter
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Historique</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">Total : {total.toLocaleString("fr-FR")} F</span>
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
                <td className="py-2 pr-2">{new Date(expense.date).toLocaleDateString("fr-FR")}</td>
                <td className="py-2 pr-2">{expense.label}</td>
                <td className="py-2 pr-2">{expense.category}</td>
                <td className="py-2 pr-2">{expense.amount.toLocaleString("fr-FR")} F</td>
                <td className="py-2 pr-2 text-slate-500">{expense.user.name}</td>
                <td className="py-2 pr-2 text-right">
                  <button
                    onClick={() => startTransition(() => deleteExpense(expense.id))}
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
                  Aucune dépense enregistrée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

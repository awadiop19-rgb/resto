"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#f97316", "#1f2937", "#fb923c", "#7c2d12", "#fdba74", "#57534e"];

function formatFCFA(value: number) {
  return `${value.toLocaleString("fr-FR")} F`;
}

type RecentVersement = {
  id: string;
  cashierName: string;
  closedAt: Date | null;
  amount: number;
  corrected: boolean;
};

type RecentExpense = {
  id: string;
  label: string;
  category: string;
  date: Date;
  amount: number;
  userName: string;
};

export function ComptabiliteDashboard({
  totalExpenses,
  totalVersements,
  versementsCount,
  solde,
  expensesByCategory,
  versementsByDay,
  recentVersements,
  recentExpenses,
}: {
  totalExpenses: number;
  totalVersements: number;
  versementsCount: number;
  solde: number;
  expensesByCategory: { category: string; total: number }[];
  versementsByDay: { date: string; total: number }[];
  recentVersements: RecentVersement[];
  recentExpenses: RecentExpense[];
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-400">Total versements reçus</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{formatFCFA(totalVersements)}</p>
          <p className="mt-1 text-xs text-slate-400">{versementsCount} versement(s)</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-400">Total dépenses</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">{formatFCFA(totalExpenses)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-400">Solde</p>
          <p className={`mt-1 text-2xl font-semibold ${solde >= 0 ? "text-black" : "text-red-600"}`}>
            {formatFCFA(solde)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-400">Accès rapide</p>
          <div className="mt-2 flex flex-col gap-1 text-sm">
            <Link href="/depenses" className="text-orange-600 hover:underline">
              Gérer les dépenses
            </Link>
            <Link href="/comptabilite/depenses" className="text-orange-600 hover:underline">
              Rapport de dépenses filtré
            </Link>
            <Link href="/caisse/versements" className="text-orange-600 hover:underline">
              Historique des versements
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold">Versements (14 derniers jours)</h2>
          {versementsByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={versementsByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(value) => formatFCFA(Number(value))} />
                <Bar dataKey="total" fill="#f97316" name="Versements" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-sm text-slate-400">Aucun versement pour le moment.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold">Dépenses par catégorie</h2>
          {expensesByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={expensesByCategory}
                  dataKey="total"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(entry) => entry.name}
                >
                  {expensesByCategory.map((entry, index) => (
                    <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatFCFA(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-sm text-slate-400">Aucune dépense pour le moment.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold">Derniers versements</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="pb-2">Caissier</th>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Montant</th>
                </tr>
              </thead>
              <tbody>
                {recentVersements.map((v) => (
                  <tr key={v.id} className="border-t border-slate-100">
                    <td className="py-2 pr-2">{v.cashierName}</td>
                    <td className="py-2 pr-2 whitespace-nowrap">
                      {v.closedAt ? new Date(v.closedAt).toLocaleDateString("fr-FR") : "-"}
                    </td>
                    <td className="py-2 pr-2 font-semibold">
                      {formatFCFA(v.amount)}
                      {v.corrected && <span className="ml-1 text-xs text-orange-600">(corrigé)</span>}
                    </td>
                  </tr>
                ))}
                {recentVersements.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-slate-400">
                      Aucun versement enregistré.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold">Dernières dépenses</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="pb-2">Libellé</th>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Montant</th>
                </tr>
              </thead>
              <tbody>
                {recentExpenses.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="py-2 pr-2">
                      {e.label}
                      <div className="text-xs text-slate-400">{e.category}</div>
                    </td>
                    <td className="py-2 pr-2 whitespace-nowrap">{new Date(e.date).toLocaleDateString("fr-FR")}</td>
                    <td className="py-2 pr-2 font-semibold">{formatFCFA(e.amount)}</td>
                  </tr>
                ))}
                {recentExpenses.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-slate-400">
                      Aucune dépense enregistrée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

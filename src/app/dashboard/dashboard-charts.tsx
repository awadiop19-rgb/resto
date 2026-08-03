"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
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

export function DashboardCharts({
  totalRevenue,
  totalExpenses,
  profit,
  salesByDay,
  expensesByCategory,
  topItems,
}: {
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  salesByDay: { date: string; total: number }[];
  expensesByCategory: { category: string; total: number }[];
  topItems: { name: string; quantity: number }[];
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-400">Chiffre d&apos;affaires</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{formatFCFA(totalRevenue)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-400">Dépenses</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">{formatFCFA(totalExpenses)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-400">Bénéfice</p>
          <p className={`mt-1 text-2xl font-semibold ${profit >= 0 ? "text-slate-900" : "text-red-600"}`}>
            {formatFCFA(profit)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold">Ventes (14 derniers jours)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={salesByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(value) => formatFCFA(Number(value))} />
              <Line type="monotone" dataKey="total" stroke="#f97316" strokeWidth={2} name="Ventes" />
            </LineChart>
          </ResponsiveContainer>
          {salesByDay.length === 0 && (
            <p className="text-center text-sm text-slate-400">Aucune commande servie pour le moment.</p>
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
                  {expensesByCategory.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatFCFA(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-sm text-slate-400">Aucune dépense enregistrée.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">Articles les plus vendus</h2>
        {topItems.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topItems}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="quantity" fill="#1f2937" name="Quantité vendue" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-sm text-slate-400">Aucune vente enregistrée.</p>
        )}
      </div>
    </div>
  );
}

"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["#f97316", "#1f2937"];

function formatFCFA(value: number) {
  return `${value.toLocaleString("fr-FR")} F`;
}

export function CaisseDashboard({
  ordersCount,
  totalRevenue,
  totalCash,
  totalWave,
  dishesSold,
}: {
  ordersCount: number;
  totalRevenue: number;
  totalCash: number;
  totalWave: number;
  dishesSold: { name: string; quantity: number }[];
}) {
  const paymentBreakdown = [
    { method: "Espèces", total: totalCash },
    { method: "Wave", total: totalWave },
  ].filter((p) => p.total > 0);

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Ma journée de caisse</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-400">Commandes encaissées</p>
          <p className="mt-1 text-2xl font-semibold">{ordersCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-400">Total encaissé</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{formatFCFA(totalRevenue)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-400">Espèces / Wave</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatFCFA(totalCash)} <span className="text-slate-300">/</span> {formatFCFA(totalWave)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold">Répartition par type de paiement</h3>
          {paymentBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={paymentBreakdown}
                  dataKey="total"
                  nameKey="method"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => entry.name}
                >
                  {paymentBreakdown.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatFCFA(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-sm text-slate-400">Aucun encaissement pour le moment.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold">Repas vendus</h3>
          {dishesSold.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dishesSold}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={10} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="quantity" fill="#f97316" name="Quantité vendue" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-sm text-slate-400">Aucun repas vendu pour le moment.</p>
          )}
        </div>
      </div>
    </div>
  );
}

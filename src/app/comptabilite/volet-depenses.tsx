"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "@/components/chart-card";
import { StatTile } from "@/components/stat-tile";
import { AXIS_TICK, CHART, CHART_MARK, TOOLTIP_STYLE } from "@/lib/chart-theme";
import { downloadCsv } from "@/lib/csv";
import { formatFCFA } from "@/lib/format";
import type { ComptabiliteData } from "@/lib/comptabilite";

export function VoletDepenses({ data }: { data: ComptabiliteData }) {
  const { depenses, totalDepenses, depenseMoyenne, depensesParCategorie, depensesParJour, recettes } = data;

  const posteDominant = depensesParCategorie[0];

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Date", "Libellé", "Catégorie", "Montant (F)", "Saisie par"],
      ...depenses.map((e) => [
        new Date(e.date).toLocaleDateString("fr-FR"),
        e.label,
        e.category,
        e.amount,
        e.userName,
      ]),
    ];
    downloadCsv(`depenses_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total dépenses" value={formatFCFA(totalDepenses)} tone="critique" />
        <StatTile label="Nombre de dépenses" value={depenses.length.toLocaleString("fr-FR")} />
        <StatTile label="Dépense moyenne" value={formatFCFA(Math.round(depenseMoyenne))} />
        <StatTile
          label="Poids sur les recettes"
          value={recettes > 0 ? `${Math.round((totalDepenses / recettes) * 100)} %` : "-"}
          hint={posteDominant ? `Premier poste : ${posteDominant.categorie}` : undefined}
          tone={recettes > 0 && totalDepenses > recettes ? "critique" : "neutre"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Dépenses par catégorie"
          hint="Classées du poste le plus lourd au plus léger"
          isEmpty={depensesParCategorie.length === 0}
          table={{
            headers: ["Catégorie", "Montant", "Nombre", "Part"],
            rows: depensesParCategorie.map((c) => [
              c.categorie,
              formatFCFA(c.total),
              c.count,
              totalDepenses > 0 ? `${Math.round((c.total / totalDepenses) * 100)} %` : "-",
            ]),
          }}
        >
          <ResponsiveContainer width="100%" height={Math.max(220, depensesParCategorie.length * 34 + 40)}>
            <BarChart
              data={depensesParCategorie}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
              barCategoryGap={6}
            >
              <CartesianGrid stroke={CHART.grille} horizontal={false} />
              <XAxis
                type="number"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => Number(v).toLocaleString("fr-FR")}
              />
              <YAxis
                type="category"
                dataKey="categorie"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={{ stroke: CHART.axe }}
                width={140}
              />
              <Tooltip {...TOOLTIP_STYLE} formatter={(value) => formatFCFA(Number(value))} />
              <Bar
                dataKey="total"
                name="Dépenses"
                fill={CHART.magnitudeAlt}
                radius={CHART_MARK.radiusHorizontal}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Dépenses dans le temps"
          hint="Montants engagés, par date de dépense"
          isEmpty={depensesParJour.every((d) => d.total === 0)}
          table={{
            headers: ["Période", "Montant"],
            rows: depensesParJour.map((d) => [d.label, formatFCFA(d.total)]),
          }}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={depensesParJour} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={CHART.grille} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: CHART.axe }} />
              <YAxis
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={72}
                tickFormatter={(v) => Number(v).toLocaleString("fr-FR")}
              />
              <Tooltip {...TOOLTIP_STYLE} formatter={(value) => formatFCFA(Number(value))} />
              <Bar
                dataKey="total"
                name="Dépenses"
                fill={CHART.magnitudeAlt}
                radius={CHART_MARK.radius}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Détail des dépenses</h3>
          <div className="flex items-center gap-3">
            <Link href="/depenses" className="text-xs text-orange-600 hover:underline">
              Saisir une dépense
            </Link>
            {depenses.length > 0 && (
              <button type="button" onClick={exportCsv} className="text-xs text-slate-600 hover:underline">
                Exporter CSV
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-400">
                <th className="pb-2 pr-3 font-medium">Date</th>
                <th className="pb-2 pr-3 font-medium">Libellé</th>
                <th className="pb-2 pr-3 font-medium">Catégorie</th>
                <th className="pb-2 pr-3 font-medium">Montant</th>
                <th className="pb-2 pr-3 font-medium">Saisie par</th>
              </tr>
            </thead>
            <tbody>
              {depenses.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap py-2 pr-3">
                    {new Date(e.date).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="py-2 pr-3">{e.label}</td>
                  <td className="py-2 pr-3 text-slate-500">{e.category}</td>
                  <td className="py-2 pr-3 font-semibold">{formatFCFA(e.amount)}</td>
                  <td className="py-2 pr-3 text-slate-500">{e.userName}</td>
                </tr>
              ))}
              {depenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
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

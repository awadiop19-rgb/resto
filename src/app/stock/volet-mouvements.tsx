"use client";

import { useState, useTransition } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/chart-card";
import { AXIS_TICK, CHART, CHART_MARK, TOOLTIP_STYLE } from "@/lib/chart-theme";
import { downloadCsv } from "@/lib/csv";
import { formatFCFA } from "@/lib/format";
import { supprimerMouvement } from "@/lib/actions/stock";
import { formatQuantite, formatQuantiteSignee, libelleType } from "@/lib/stock";
import type { StockData } from "@/lib/stock-data";

const TEINTE_TYPE: Record<string, string> = {
  ACHAT: "text-[#0ca30c]",
  SORTIE: "text-[#b47400]",
  AJUSTEMENT: "text-slate-500",
};

export function VoletMouvements({ data }: { data: StockData }) {
  const { mouvements, fluxParJour, consommationParProduit } = data;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<"tous" | "ACHAT" | "SORTIE" | "AJUSTEMENT">("tous");

  const visibles = filtre === "tous" ? mouvements : mouvements.filter((m) => m.type === filtre);

  function supprimer(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await supprimerMouvement(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Suppression impossible");
      }
    });
  }

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Date", "Type", "Produit", "Quantité", "Unité", "Prix unitaire (F)", "Montant (F)", "Fournisseur", "Note", "Saisi par"],
      ...visibles.map((m) => [
        new Date(m.date).toLocaleDateString("fr-FR"),
        libelleType(m.type),
        m.productName,
        m.quantity,
        m.unit,
        m.unitPrice ?? "",
        m.montant != null ? Math.round(m.montant) : "",
        m.supplier ?? "",
        m.note ?? "",
        m.userName,
      ]),
    ];
    downloadCsv(`mouvements_stock_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Achats et sorties dans le temps"
          hint="Achats au prix payé, sorties valorisées au coût moyen"
          isEmpty={fluxParJour.every((f) => f.achats === 0 && f.sorties === 0)}
          table={{
            headers: ["Période", "Achats", "Sorties cuisine"],
            rows: fluxParJour.map((f) => [f.label, formatFCFA(f.achats), formatFCFA(f.sorties)]),
          }}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={fluxParJour} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
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
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="achats" name="Achats" fill={CHART.wave} radius={CHART_MARK.radius} />
              <Bar
                dataKey="sorties"
                name="Sorties cuisine"
                fill={CHART.especes}
                radius={CHART_MARK.radius}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Consommation de la cuisine"
          hint="Produits sortis sur la période, du plus coûteux au moins coûteux"
          isEmpty={consommationParProduit.length === 0}
          table={{
            headers: ["Produit", "Quantité sortie", "Valeur"],
            rows: consommationParProduit.map((c) => [
              c.name,
              formatQuantite(c.quantite, c.unit),
              formatFCFA(c.valeur),
            ]),
          }}
        >
          <ResponsiveContainer
            width="100%"
            height={Math.max(220, Math.min(consommationParProduit.length, 12) * 30 + 40)}
          >
            <BarChart
              data={consommationParProduit.slice(0, 12)}
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
                dataKey="name"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={{ stroke: CHART.axe }}
                width={150}
              />
              <Tooltip {...TOOLTIP_STYLE} formatter={(value) => formatFCFA(Number(value))} />
              <Bar
                dataKey="valeur"
                name="Sorti vers la cuisine"
                fill={CHART.especes}
                radius={CHART_MARK.radiusHorizontal}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Journal des mouvements</h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1">
              {(["tous", "ACHAT", "SORTIE", "AJUSTEMENT"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFiltre(f)}
                  aria-pressed={filtre === f}
                  className={`rounded-md px-2.5 py-1 text-xs transition ${
                    filtre === f
                      ? "bg-black font-medium text-white"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {f === "tous" ? "Tous" : libelleType(f)}
                </button>
              ))}
            </div>
            {visibles.length > 0 && (
              <button type="button" onClick={exportCsv} className="text-xs text-slate-600 hover:underline">
                Exporter CSV
              </button>
            )}
          </div>
        </div>

        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-400">
                <th className="pb-2 pr-3 font-medium">Date</th>
                <th className="pb-2 pr-3 font-medium">Type</th>
                <th className="pb-2 pr-3 font-medium">Produit</th>
                <th className="pb-2 pr-3 font-medium">Quantité</th>
                <th className="pb-2 pr-3 font-medium">Prix unitaire</th>
                <th className="pb-2 pr-3 font-medium">Montant</th>
                <th className="pb-2 pr-3 font-medium">Détail</th>
                <th className="pb-2 pr-3 font-medium">Saisi par</th>
                <th className="pb-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {new Date(m.date).toLocaleDateString("fr-FR")}
                  </td>
                  <td className={`py-2 pr-3 font-medium ${TEINTE_TYPE[m.type]}`}>
                    {libelleType(m.type)}
                  </td>
                  <td className="py-2 pr-3">{m.productName}</td>
                  <td className="py-2 pr-3 font-semibold">
                    {formatQuantiteSignee(m.quantity, m.unit)}
                  </td>
                  <td className="py-2 pr-3 text-slate-500">
                    {m.unitPrice != null ? formatFCFA(m.unitPrice) : "—"}
                  </td>
                  <td className="py-2 pr-3">
                    {m.montant != null ? formatFCFA(Math.round(m.montant)) : "—"}
                  </td>
                  <td className="py-2 pr-3 text-slate-500">
                    {[m.supplier, m.note].filter(Boolean).join(" · ") || "—"}
                    {m.lieeAUneDepense && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                        en dépense
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-slate-500">{m.userName}</td>
                  <td className="py-2 pr-3 text-right">
                    <button
                      disabled={isPending}
                      onClick={() => supprimer(m.id)}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-400">
                    Aucun mouvement sur cette période.
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

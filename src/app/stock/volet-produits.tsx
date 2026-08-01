"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "@/components/chart-card";
import { AXIS_TICK, CHART, CHART_MARK, TOOLTIP_STYLE } from "@/lib/chart-theme";
import { downloadCsv } from "@/lib/csv";
import { formatFCFA } from "@/lib/format";
import { formatQuantite, uniteCourte } from "@/lib/stock";
import type { LigneStock } from "@/lib/stock";
import type { StockData } from "@/lib/stock-data";

const BADGE: Record<LigneStock["statut"], { texte: string; classe: string }> = {
  rupture: { texte: "Rupture", classe: "bg-red-50 text-[#d03b3b]" },
  sous_seuil: { texte: "Sous le seuil", classe: "bg-amber-50 text-[#b47400]" },
  ok: { texte: "OK", classe: "bg-green-50 text-[#0ca30c]" },
};

export function VoletProduits({ data }: { data: StockData }) {
  const { lignes, valeurParProduit, valeurParCategorie, ruptures, sousSeuil, valeurStock } = data;

  // Les produits désactivés restent visibles tant qu'il leur reste du stock :
  // ce qui est en réserve doit être compté même si on n'en rachète plus.
  const visibles = lignes.filter((l) => l.active || l.stock !== 0);
  const alertes = [...ruptures, ...sousSeuil];

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Produit", "Catégorie", "Unité", "Stock", "Seuil", "Coût moyen (F)", "Valeur (F)", "Entrées", "Sorties", "État"],
      ...visibles.map((l) => [
        l.name,
        l.category,
        uniteCourte(l.unit),
        l.stock,
        l.seuilAlerte,
        Math.round(l.coutMoyen),
        Math.round(l.valeur),
        l.entreesPeriode,
        l.sortiesPeriode,
        BADGE[l.statut].texte,
      ]),
    ];
    downloadCsv(`stock_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <div className="space-y-4">
      {alertes.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-[#8a5900]">
            {alertes.length} produit(s) à réapprovisionner
          </h3>
          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[#8a5900]">
            {alertes.map((l) => (
              <li key={l.id}>
                <span className="font-medium">{l.name}</span> :{" "}
                {l.stock <= 0 ? "épuisé" : `${formatQuantite(l.stock, l.unit)} restant`}
                {l.seuilAlerte > 0 && ` (seuil ${formatQuantite(l.seuilAlerte, l.unit)})`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Valeur du stock par produit"
          hint="Quantité restante × coût moyen d'achat. Les 12 premiers postes."
          isEmpty={valeurParProduit.length === 0}
          table={{
            headers: ["Produit", "Valeur"],
            rows: valeurParProduit.map((p) => [p.name, formatFCFA(p.valeur)]),
          }}
        >
          <ResponsiveContainer width="100%" height={Math.max(220, valeurParProduit.length * 30 + 40)}>
            <BarChart
              data={valeurParProduit}
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
                name="Valeur en stock"
                fill={CHART.magnitude}
                radius={CHART_MARK.radiusHorizontal}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Valeur du stock par catégorie"
          hint="Où dort l'argent immobilisé en réserve"
          isEmpty={valeurParCategorie.length === 0}
          table={{
            headers: ["Catégorie", "Valeur", "Part"],
            rows: valeurParCategorie.map((c) => [
              c.categorie,
              formatFCFA(c.valeur),
              valeurStock > 0 ? `${Math.round((c.valeur / valeurStock) * 100)} %` : "-",
            ]),
          }}
        >
          <ResponsiveContainer
            width="100%"
            height={Math.max(220, valeurParCategorie.length * 34 + 40)}
          >
            <BarChart
              data={valeurParCategorie}
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
                width={110}
              />
              <Tooltip {...TOOLTIP_STYLE} formatter={(value) => formatFCFA(Number(value))} />
              <Bar
                dataKey="valeur"
                name="Valeur en stock"
                fill={CHART.magnitudeAlt}
                radius={CHART_MARK.radiusHorizontal}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Stock par produit</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Le stock est le solde du jour ; entrées et sorties couvrent {data.periodeLabel.toLowerCase()}.
            </p>
          </div>
          {visibles.length > 0 && (
            <button type="button" onClick={exportCsv} className="text-xs text-slate-600 hover:underline">
              Exporter CSV
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-400">
                <th className="pb-2 pr-3 font-medium">Produit</th>
                <th className="pb-2 pr-3 font-medium">Catégorie</th>
                <th className="pb-2 pr-3 font-medium">Stock</th>
                <th className="pb-2 pr-3 font-medium">Seuil</th>
                <th className="pb-2 pr-3 font-medium">Entrées</th>
                <th className="pb-2 pr-3 font-medium">Sorties</th>
                <th className="pb-2 pr-3 font-medium">Coût moyen</th>
                <th className="pb-2 pr-3 font-medium">Valeur</th>
                <th className="pb-2 pr-3 font-medium">État</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="py-2 pr-3 font-medium">
                    {l.name}
                    {!l.active && <span className="ml-2 text-xs text-slate-400">(désactivé)</span>}
                  </td>
                  <td className="py-2 pr-3 text-slate-500">{l.category}</td>
                  <td className="py-2 pr-3 font-semibold">{formatQuantite(l.stock, l.unit)}</td>
                  <td className="py-2 pr-3 text-slate-400">
                    {l.seuilAlerte > 0 ? formatQuantite(l.seuilAlerte, l.unit) : "—"}
                  </td>
                  <td className="py-2 pr-3">
                    {l.entreesPeriode > 0 ? formatQuantite(l.entreesPeriode, l.unit) : "—"}
                  </td>
                  <td className="py-2 pr-3">
                    {l.sortiesPeriode > 0 ? formatQuantite(l.sortiesPeriode, l.unit) : "—"}
                  </td>
                  <td className="py-2 pr-3 text-slate-500">
                    {l.coutMoyen > 0 ? formatFCFA(Math.round(l.coutMoyen)) : "—"}
                  </td>
                  <td className="py-2 pr-3">{formatFCFA(Math.round(l.valeur))}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[l.statut].classe}`}
                    >
                      {BADGE[l.statut].texte}
                    </span>
                  </td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-400">
                    Aucun produit suivi pour l&apos;instant.
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

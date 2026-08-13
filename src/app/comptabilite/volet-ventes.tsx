"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/chart-card";
import { StatTile } from "@/components/stat-tile";
import { AXIS_TICK, CHART, CHART_MARK, TOOLTIP_STYLE } from "@/lib/chart-theme";
import { downloadCsv } from "@/lib/csv";
import { formatFCFA, formatSignedFCFA } from "@/lib/format";
import type { ComptabiliteData } from "@/lib/comptabilite";

const TOP_PLATS = 10;

export function VoletVentes({ data }: { data: ComptabiliteData }) {
  const {
    chiffreAffaires,
    totalRembourse,
    ventesEspeces,
    ventesWave,
    commandesEncaissees,
    ticketMoyen,
    ventesParJour,
    platsVendus,
    ventesParCategorie,
    parCaissier,
  } = data;

  const topPlats = platsVendus.slice(0, TOP_PLATS);
  const platsRestants = platsVendus.length - topPlats.length;

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Plat", "Quantité vendue", "Chiffre d'affaires (F)"],
      ...platsVendus.map((p) => [p.name, p.quantite, p.total]),
    ];
    downloadCsv(`ventes_plats_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Chiffre d'affaires encaissé"
          value={formatFCFA(chiffreAffaires)}
          hint={
            totalRembourse > 0
              ? `Somme des paiements enregistrés · ${formatFCFA(totalRembourse)} rendus au client, comptés en dépenses`
              : "Somme des paiements enregistrés"
          }
        />
        <StatTile label="Commandes encaissées" value={commandesEncaissees.toLocaleString("fr-FR")} />
        <StatTile label="Ticket moyen" value={formatFCFA(Math.round(ticketMoyen))} />
        <StatTile
          label="Espèces / Wave"
          value={`${formatFCFA(ventesEspeces)} · ${formatFCFA(ventesWave)}`}
          hint={
            chiffreAffaires > 0
              ? `${Math.round((ventesEspeces / chiffreAffaires) * 100)} % en espèces`
              : undefined
          }
        />
      </div>

      <ChartCard
        title="Évolution du chiffre d'affaires"
        hint="Montants encaissés, par date de paiement"
        isEmpty={ventesParJour.every((d) => d.total === 0)}
        table={{
          headers: ["Période", "Chiffre d'affaires"],
          rows: ventesParJour.map((d) => [d.label, formatFCFA(d.total)]),
        }}
      >
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={ventesParJour} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="gradientVentes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART.magnitude} stopOpacity={0.18} />
                <stop offset="100%" stopColor={CHART.magnitude} stopOpacity={0.02} />
              </linearGradient>
            </defs>
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
            <Area
              type="monotone"
              dataKey="total"
              name="Chiffre d'affaires"
              stroke={CHART.magnitude}
              strokeWidth={CHART_MARK.strokeWidth}
              fill="url(#gradientVentes)"
              activeDot={{ r: 5, strokeWidth: 2, stroke: CHART.surface }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={`Meilleures ventes${platsRestants > 0 ? ` (top ${TOP_PLATS})` : ""}`}
          hint={
            platsRestants > 0
              ? `${platsRestants} autre(s) plat(s) hors du classement — visibles dans les données`
              : "Chiffre d'affaires par plat"
          }
          isEmpty={topPlats.length === 0}
          table={{
            headers: ["Plat", "Quantité", "Chiffre d'affaires"],
            rows: platsVendus.map((p) => [p.name, p.quantite, formatFCFA(p.total)]),
          }}
        >
          <ResponsiveContainer width="100%" height={Math.max(220, topPlats.length * 34 + 40)}>
            <BarChart
              data={topPlats}
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
                width={140}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value, _name, entry) => [
                  `${formatFCFA(Number(value))} · ${entry?.payload?.quantite ?? 0} vendu(s)`,
                  "Chiffre d'affaires",
                ]}
              />
              <Bar
                dataKey="total"
                name="Chiffre d'affaires"
                fill={CHART.magnitude}
                radius={CHART_MARK.radiusHorizontal}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Ventes par catégorie"
          hint="Répartition du chiffre d'affaires dans la carte"
          isEmpty={ventesParCategorie.length === 0}
          table={{
            headers: ["Catégorie", "Chiffre d'affaires", "Part"],
            rows: ventesParCategorie.map((c) => [
              c.categorie,
              formatFCFA(c.total),
              chiffreAffaires > 0 ? `${Math.round((c.total / chiffreAffaires) * 100)} %` : "-",
            ]),
          }}
        >
          <ResponsiveContainer width="100%" height={Math.max(220, ventesParCategorie.length * 34 + 40)}>
            <BarChart
              data={ventesParCategorie}
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
                name="Chiffre d'affaires"
                fill={CHART.magnitude}
                radius={CHART_MARK.radiusHorizontal}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Ventes par caissier</h3>
          {platsVendus.length > 0 && (
            <button type="button" onClick={exportCsv} className="text-xs text-slate-600 hover:underline">
              Exporter les plats vendus (CSV)
            </button>
          )}
        </div>
        <p className="mb-3 text-xs text-slate-400">
          Le rapprochement compare les ventes en espèces aux recettes effectivement versées sur la période.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-400">
                <th className="pb-2 pr-3 font-medium">Caissier</th>
                <th className="pb-2 pr-3 font-medium">Commandes</th>
                <th className="pb-2 pr-3 font-medium">Espèces</th>
                <th className="pb-2 pr-3 font-medium">Wave</th>
                <th className="pb-2 pr-3 font-medium">Total ventes</th>
                <th className="pb-2 pr-3 font-medium">Versements</th>
                <th className="pb-2 pr-3 font-medium">Recette nette versée</th>
                <th className="pb-2 pr-3 font-medium">Rapprochement</th>
              </tr>
            </thead>
            <tbody>
              {parCaissier.map((c) => {
                const rapprochement = c.netVerse - c.especes;
                return (
                  <tr key={c.cashierId} className="border-t border-slate-100">
                    <td className="py-2 pr-3 font-medium">{c.cashierName}</td>
                    <td className="py-2 pr-3">{c.commandes}</td>
                    <td className="py-2 pr-3">{formatFCFA(c.especes)}</td>
                    <td className="py-2 pr-3">{formatFCFA(c.wave)}</td>
                    <td className="py-2 pr-3 font-semibold">{formatFCFA(c.totalVentes)}</td>
                    <td className="py-2 pr-3">{c.versementsCount}</td>
                    <td className="py-2 pr-3">{formatFCFA(c.netVerse)}</td>
                    <td
                      className={`py-2 pr-3 font-medium ${
                        rapprochement === 0
                          ? "text-slate-400"
                          : rapprochement < 0
                            ? "text-[#d03b3b]"
                            : "text-[#b47400]"
                      }`}
                    >
                      {rapprochement === 0 ? "Équilibré" : formatSignedFCFA(rapprochement)}
                    </td>
                  </tr>
                );
              })}
              {parCaissier.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400">
                    Aucune vente encaissée sur cette période.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Un rapprochement négatif signale des ventes en espèces pas encore versées (caisse ouverte) ou un
          manquant ; positif, un versement couvrant des ventes antérieures à la période.
        </p>
      </div>
    </div>
  );
}

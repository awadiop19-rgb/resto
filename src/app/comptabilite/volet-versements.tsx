"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "@/components/chart-card";
import { StatTile } from "@/components/stat-tile";
import { AXIS_TICK, CHART, CHART_MARK, TOOLTIP_STYLE } from "@/lib/chart-theme";
import { downloadCsv } from "@/lib/csv";
import { formatFCFA, formatSignedFCFA } from "@/lib/format";
import type { ComptabiliteData } from "@/lib/comptabilite";

/** Deux valeurs qui composent un tout : une jauge, pas un camembert à deux parts. */
function RepartitionPaiement({ especes, wave }: { especes: number; wave: number }) {
  const total = especes + wave;
  const partEspeces = total > 0 ? (especes / total) * 100 : 0;
  const partWave = total > 0 ? (wave / total) * 100 : 0;

  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-slate-100">
        <div style={{ width: `${partEspeces}%`, backgroundColor: CHART.especes }} />
        <div style={{ width: `${partWave}%`, backgroundColor: CHART.wave }} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: CHART.especes }} />
          <span className="text-sm text-slate-600">Espèces</span>
          <span className="ml-auto text-sm font-semibold tabular-nums">{formatFCFA(especes)}</span>
          <span className="w-12 text-right text-xs text-slate-400 tabular-nums">
            {partEspeces.toFixed(0)} %
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: CHART.wave }} />
          <span className="text-sm text-slate-600">Wave</span>
          <span className="ml-auto text-sm font-semibold tabular-nums">{formatFCFA(wave)}</span>
          <span className="w-12 text-right text-xs text-slate-400 tabular-nums">{partWave.toFixed(0)} %</span>
        </div>
      </div>
    </div>
  );
}

export function VoletVersements({ data }: { data: ComptabiliteData }) {
  const {
    versements,
    especesVersees,
    waveEncaisse,
    fondsRestitues,
    totalEcarts,
    versementsAvecEcart,
    versementsParJour,
    caissesOuvertes,
  } = data;

  const chartVide = versementsParJour.every((d) => d.especes === 0 && d.wave === 0);

  function exportCsv() {
    const rows: (string | number)[][] = [
      [
        "Caissier",
        "Fermeture",
        "Fond de caisse",
        "Encaissé espèces",
        "Encaissé Wave",
        "Espèces attendues",
        "Espèces déclarées",
        "Montant retenu",
        "Écart",
        "Recette espèces (net)",
        "Motif de l'écart",
      ],
      ...versements.map((v) => [
        v.cashierName,
        v.closedAt ? new Date(v.closedAt).toLocaleString("fr-FR") : "",
        v.openingFloat,
        v.totalCash,
        v.totalWave,
        v.expectedCash ?? "",
        v.declaredAmount,
        v.retenu,
        v.difference ?? "",
        v.net,
        v.note ?? "",
      ]),
    ];
    downloadCsv(`versements_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Recette espèces"
          value={formatFCFA(especesVersees)}
          hint="Versements reçus, hors fond de caisse"
        />
        <StatTile label="Encaissements Wave" value={formatFCFA(waveEncaisse)} hint="Reçus directement sur Wave" />
        <StatTile
          label="Total recettes"
          value={formatFCFA(especesVersees + waveEncaisse)}
          tone="bon"
          hint={`${versements.length} versement(s) clôturé(s)`}
        />
        <StatTile
          label="Écart de caisse cumulé"
          value={totalEcarts === 0 ? "Aucun" : formatSignedFCFA(totalEcarts)}
          tone={totalEcarts === 0 ? "neutre" : totalEcarts < 0 ? "critique" : "alerte"}
          hint={
            versementsAvecEcart === 0
              ? "Toutes les caisses tombent juste"
              : `${versementsAvecEcart} versement(s) avec écart`
          }
        />
      </div>

      {caissesOuvertes > 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {caissesOuvertes} caisse(s) encore ouverte(s) : les encaissements en cours n&apos;apparaissent pas
          dans les recettes tant que le versement n&apos;est pas clôturé.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard
            title="Versements par mode de paiement"
            hint="Recette espèces remise à la comptabilité et encaissements Wave, par date de clôture"
            isEmpty={chartVide}
            table={{
              headers: ["Période", "Espèces", "Wave", "Total"],
              rows: versementsParJour.map((d) => [
                d.label,
                formatFCFA(d.especes),
                formatFCFA(d.wave),
                formatFCFA(d.especes + d.wave),
              ]),
            }}
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={versementsParJour} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
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
                <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                {/* stroke = fond de la carte : crée l'écart de 2px entre segments empilés */}
                <Bar
                  dataKey="especes"
                  name="Espèces"
                  stackId="paiement"
                  fill={CHART.especes}
                  stroke={CHART.surface}
                  strokeWidth={2}
                />
                <Bar
                  dataKey="wave"
                  name="Wave"
                  stackId="paiement"
                  fill={CHART.wave}
                  stroke={CHART.surface}
                  strokeWidth={2}
                  radius={CHART_MARK.radius}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold">Répartition des recettes</h3>
          <p className="mt-0.5 mb-4 text-xs text-slate-400">Part de chaque mode sur la période</p>
          {especesVersees + waveEncaisse > 0 ? (
            <RepartitionPaiement especes={especesVersees} wave={waveEncaisse} />
          ) : (
            <p className="py-10 text-center text-sm text-slate-400">Aucune recette sur cette période.</p>
          )}
          <dl className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Fonds de caisse restitués</dt>
              <dd className="font-medium tabular-nums">{formatFCFA(fondsRestitues)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Espèces physiquement remises</dt>
              <dd className="font-medium tabular-nums">{formatFCFA(especesVersees + fondsRestitues)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-400">
            Le fond de caisse ressort le matin et rentre le soir : il est déduit pour ne pas être compté
            comme une recette.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Détail des versements</h3>
          <div className="flex items-center gap-3">
            <Link href="/caisse/versements" className="text-xs text-orange-600 hover:underline">
              Historique complet et corrections
            </Link>
            {versements.length > 0 && (
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
                <th className="pb-2 pr-3 font-medium">Caissier</th>
                <th className="pb-2 pr-3 font-medium">Clôture</th>
                <th className="pb-2 pr-3 font-medium">Fond</th>
                <th className="pb-2 pr-3 font-medium">Cash</th>
                <th className="pb-2 pr-3 font-medium">Wave</th>
                <th className="pb-2 pr-3 font-medium">Attendu</th>
                <th className="pb-2 pr-3 font-medium">Déclaré</th>
                <th className="pb-2 pr-3 font-medium">Écart</th>
                <th className="pb-2 pr-3 font-medium">Recette nette</th>
                <th className="pb-2 pr-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {versements.map((v) => (
                <tr key={v.id} className="border-t border-slate-100">
                  <td className="py-2 pr-3 font-medium">{v.cashierName}</td>
                  <td className="whitespace-nowrap py-2 pr-3">
                    {v.closedAt ? new Date(v.closedAt).toLocaleString("fr-FR") : "-"}
                  </td>
                  <td className="py-2 pr-3 text-slate-500">{formatFCFA(v.openingFloat)}</td>
                  <td className="py-2 pr-3">{formatFCFA(v.totalCash)}</td>
                  <td className="py-2 pr-3">{formatFCFA(v.totalWave)}</td>
                  <td className="py-2 pr-3 text-slate-500">
                    {v.expectedCash != null ? formatFCFA(v.expectedCash) : "-"}
                  </td>
                  <td className="py-2 pr-3">
                    {formatFCFA(v.declaredAmount)}
                    {v.corrected && (
                      <span className="ml-1 text-xs font-medium text-[#b47400]">corrigé → {formatFCFA(v.retenu)}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {v.difference == null ? (
                      <span className="text-slate-400">-</span>
                    ) : v.difference === 0 ? (
                      <span className="text-xs text-slate-400">Juste</span>
                    ) : (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          v.difference < 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {formatSignedFCFA(v.difference)}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 font-semibold">{formatFCFA(v.net)}</td>
                  <td className="py-2 pr-3 text-right">
                    <Link
                      href={`/caisse/versements/${v.id}`}
                      className="whitespace-nowrap text-xs text-orange-600 hover:underline"
                    >
                      Détail
                    </Link>
                  </td>
                </tr>
              ))}
              {versements.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-slate-400">
                    Aucun versement clôturé sur cette période.
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

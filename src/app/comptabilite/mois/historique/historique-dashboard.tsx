"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/chart-card";
import { StatTile } from "@/components/stat-tile";
import { AXIS_TICK, CHART, CHART_MARK, TOOLTIP_STYLE } from "@/lib/chart-theme";
import { downloadCsv } from "@/lib/csv";
import { formatFCFA } from "@/lib/format";
// `import type` obligatoire ici : le module de calcul importe Prisma, qui n'a
// rien à faire dans un bundle navigateur. Seuls les types en sont tirés.
import type { HistoriqueMois, MoisRevolu } from "@/lib/mois-historique";
import { NIVEAUX, SERIE } from "@/lib/mois-niveaux";
import { SEUILS } from "@/lib/mois-verdict";

function BadgeNiveau({ niveau }: { niveau: MoisRevolu["niveau"] }) {
  const n = NIVEAUX[niveau];
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${n.fond} ${n.encre}`}
    >
      {n.libelle}
    </span>
  );
}

export function HistoriqueDashboard({ data }: { data: HistoriqueMois }) {
  const { mois, totaux, meilleur, pire } = data;

  // Du plus récent au plus ancien dans le tableau : on cherche presque toujours
  // le mois qui vient de finir. La courbe, elle, garde l'ordre du temps.
  const recents = [...mois].reverse();
  const tauxConnu = mois.some((m) => m.taux != null);
  const serieVide = mois.every((m) => m.recettes === 0 && m.depenses === 0);

  function exportCsv() {
    downloadCsv("mois_passes.csv", [
      ["Mois", "Recettes", "Dépenses", "Résultat", "Taux de dépenses (%)", "Palier", "Achats de stock"],
      ...recents.map((m) => [
        m.label,
        m.recettes,
        m.depenses,
        m.resultat,
        m.taux == null ? "" : m.taux.toFixed(1),
        NIVEAUX[m.niveau].libelle,
        m.achatsStock,
      ]),
    ]);
  }

  if (mois.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">Aucun mois clos pour l&apos;instant.</p>
        <p className="mt-1 text-xs text-slate-400">
          Le premier mois apparaîtra ici le 1er du mois suivant, une fois qu&apos;il sera complet et
          donc comparable.{" "}
          <Link href="/comptabilite/mois" className="text-orange-600 hover:underline">
            Voir le mois en cours
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Mois clos"
          value={String(totaux.nombreMois)}
          hint={
            totaux.nombreMois > 1
              ? `De ${mois[0].label} à ${mois[mois.length - 1].label}`
              : mois[0].label
          }
        />
        <StatTile label="Recettes cumulées" value={formatFCFA(totaux.recettes)} />
        <StatTile
          label="Dépenses cumulées"
          value={formatFCFA(totaux.depenses)}
          hint={
            totaux.taux == null
              ? undefined
              : `${totaux.taux.toFixed(0)} % des recettes sur la période`
          }
        />
        <StatTile
          label="Résultat cumulé"
          value={formatFCFA(totaux.resultat)}
          tone={totaux.resultat >= 0 ? "bon" : "critique"}
          hint={NIVEAUX[totaux.niveau].libelle}
        />
      </div>

      {/* Deux mois nommés valent mieux qu'une moyenne : ils disent de combien la
          maison varie, et donnent deux mois précis à aller regarder. */}
      {meilleur && pire && meilleur.cle !== pire.cle && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.1em] text-slate-400">
              Le meilleur mois
            </p>
            <p className="mt-1.5 flex flex-wrap items-baseline gap-2">
              <Link
                href={`/comptabilite/mois/historique/${meilleur.cle}`}
                className="text-lg font-semibold capitalize hover:underline"
              >
                {meilleur.label}
              </Link>
              <BadgeNiveau niveau={meilleur.niveau} />
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {formatFCFA(meilleur.resultat)} de résultat
              {meilleur.taux != null && `, ${meilleur.taux.toFixed(0)} % de dépenses`}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.1em] text-slate-400">
              Le plus difficile
            </p>
            <p className="mt-1.5 flex flex-wrap items-baseline gap-2">
              <Link
                href={`/comptabilite/mois/historique/${pire.cle}`}
                className="text-lg font-semibold capitalize hover:underline"
              >
                {pire.label}
              </Link>
              <BadgeNiveau niveau={pire.niveau} />
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {formatFCFA(pire.resultat)} de résultat
              {pire.taux != null && `, ${pire.taux.toFixed(0)} % de dépenses`}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Recettes et dépenses, mois par mois"
          hint="Deux mesures de même nature sur un axe unique"
          isEmpty={serieVide}
          emptyLabel="Aucun mouvement n'a été enregistré sur les mois clos."
          table={{
            headers: ["Mois", "Recettes", "Dépenses", "Résultat"],
            rows: recents.map((m) => [
              m.label,
              formatFCFA(m.recettes),
              formatFCFA(m.depenses),
              formatFCFA(m.resultat),
            ]),
          }}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mois} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={CHART.grille} vertical={false} />
              <XAxis dataKey="court" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: CHART.axe }} />
              <YAxis
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={72}
                tickFormatter={(v) => Number(v).toLocaleString("fr-FR")}
              />
              <Tooltip {...TOOLTIP_STYLE} formatter={(value) => formatFCFA(Number(value))} />
              <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              {/* stroke = fond de la carte : l'écart de 2px sépare les barres voisines */}
              <Bar
                dataKey="recettes"
                name="Recettes"
                fill={SERIE.recettes}
                stroke={CHART.surface}
                strokeWidth={2}
                radius={CHART_MARK.radius}
              />
              <Bar
                dataKey="depenses"
                name="Dépenses"
                fill={SERIE.depenses}
                stroke={CHART.surface}
                strokeWidth={2}
                radius={CHART_MARK.radius}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Le taux plutôt que le résultat : c'est lui qui rend deux mois de
            tailles différentes comparables, et les paliers lui donnent une
            échelle que le lecteur n'a pas à retenir. */}
        <ChartCard
          title="Le taux de dépenses au fil des mois"
          hint={`Sous ${SEUILS.confortable} % le mois est confortable ; au-delà de ${SEUILS.tendu} % il est à perte`}
          isEmpty={!tauxConnu}
          emptyLabel="Aucun mois clos n'a enregistré de recette : le taux n'a rien à mesurer."
          table={{
            headers: ["Mois", "Taux de dépenses", "Palier"],
            rows: recents.map((m) => [
              m.label,
              m.taux == null ? "—" : `${m.taux.toFixed(0)} %`,
              NIVEAUX[m.niveau].libelle,
            ]),
          }}
        >
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mois} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={CHART.grille} vertical={false} />
              <XAxis dataKey="court" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: CHART.axe }} />
              <YAxis
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(v) => `${v} %`}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value) => `${Number(value).toFixed(0)} %`}
                labelFormatter={(label) => String(label)}
              />
              {[SEUILS.confortable, SEUILS.surveiller, SEUILS.tendu].map((seuil) => (
                <ReferenceLine
                  key={seuil}
                  y={seuil}
                  stroke={seuil === SEUILS.tendu ? CHART.critique : CHART.axe}
                  strokeDasharray="4 4"
                  label={{ value: `${seuil} %`, position: "insideTopRight", fontSize: 10, fill: CHART.encreDiscrete }}
                />
              ))}
              <Line
                type="monotone"
                dataKey="taux"
                name="Taux de dépenses"
                stroke={SERIE.depenses}
                strokeWidth={CHART_MARK.strokeWidth}
                connectNulls
                dot={{ r: 4, strokeWidth: 2, stroke: CHART.surface }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Tous les mois clos</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Du plus récent au plus ancien — ouvrez un mois pour le retrouver jour par jour
            </p>
          </div>
          <button type="button" onClick={exportCsv} className="text-xs text-slate-600 hover:underline">
            Exporter CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-2xl text-sm tabular-nums">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-400">
                <th className="pb-2 pr-3 font-medium">Mois</th>
                <th className="pb-2 pr-3 text-right font-medium">Recettes</th>
                <th className="pb-2 pr-3 text-right font-medium">Dépenses</th>
                <th className="pb-2 pr-3 text-right font-medium">Résultat</th>
                <th className="pb-2 pr-3 text-right font-medium">Taux</th>
                <th className="pb-2 font-medium">Palier</th>
              </tr>
            </thead>
            <tbody>
              {recents.map((m) => (
                <tr key={m.cle} className="border-t border-slate-100 transition hover:bg-slate-50">
                  <td className="py-2 pr-3">
                    {/* Le lien porte le nom du mois plutôt qu'un chevron en bout
                        de ligne : c'est ce mot que l'œil cherche, et une ligne
                        entière cliquable ne se voit pas.

                        Un mois sans le moindre mouvement garde sa ligne — la
                        série ne doit pas se tasser — mais pas son lien : il n'y
                        a pas de journée à aller regarder derrière, et le détail
                        de ce mois-là n'existe pas. */}
                    {m.recettes > 0 || m.depenses > 0 ? (
                      <Link
                        href={`/comptabilite/mois/historique/${m.cle}`}
                        className="font-medium capitalize text-orange-600 hover:underline"
                      >
                        {m.label}
                      </Link>
                    ) : (
                      <span className="font-medium capitalize text-slate-400">
                        {m.label}
                        <span className="ml-2 text-xs font-normal normal-case">aucun mouvement</span>
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right">{formatFCFA(m.recettes)}</td>
                  <td className="py-2 pr-3 text-right">{formatFCFA(m.depenses)}</td>
                  <td
                    className={`py-2 pr-3 text-right font-semibold ${
                      m.resultat >= 0 ? "text-[#0ca30c]" : "text-[#d03b3b]"
                    }`}
                  >
                    {formatFCFA(m.resultat)}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {m.taux == null ? "—" : `${m.taux.toFixed(0)} %`}
                  </td>
                  <td className="py-2">
                    <BadgeNiveau niveau={m.niveau} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Palier atteint : {NIVEAUX.confortable.libelle} sous {SEUILS.confortable} %,{" "}
          {NIVEAUX.surveiller.libelle} jusqu&apos;à {SEUILS.surveiller} %, {NIVEAUX.tendu.libelle}{" "}
          jusqu&apos;à {SEUILS.tendu} %, {NIVEAUX.perte.libelle} au-delà.
        </p>
      </div>
    </div>
  );
}

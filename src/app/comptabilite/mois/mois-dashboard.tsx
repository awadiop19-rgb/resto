"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
import type { MoisComptable } from "@/lib/mois-comptable";
import { SEUILS, verdictDuMois, type NiveauMois } from "@/lib/mois-verdict";

/**
 * Recettes et Dépenses sont deux identités, pas deux états : elles gardent la
 * paire catégorielle validée du dépôt, et non le vert/rouge réservé au statut.
 */
const SERIE = { recettes: CHART.magnitude, depenses: CHART.magnitudeAlt } as const;

/**
 * Le fond porte le niveau, le texte le nomme. L'ambre du jeu graphique est trop
 * clair pour un texte : les libellés reprennent l'encre foncée des tuiles.
 */
const NIVEAUX: Record<NiveauMois, { libelle: string; fond: string; encre: string; barre: string }> = {
  confortable: { libelle: "Confortable", fond: "bg-emerald-50 border-emerald-200", encre: "text-emerald-800", barre: CHART.bon },
  surveiller: { libelle: "À surveiller", fond: "bg-amber-50 border-amber-200", encre: "text-amber-900", barre: CHART.alerte },
  tendu: { libelle: "Tendu", fond: "bg-orange-50 border-orange-200", encre: "text-orange-900", barre: CHART.magnitudeAlt },
  perte: { libelle: "À perte", fond: "bg-red-50 border-red-200", encre: "text-red-800", barre: CHART.critique },
  indetermine: { libelle: "Indéterminé", fond: "bg-slate-50 border-slate-200", encre: "text-slate-700", barre: CHART.axe },
};

const TONE_PAR_NIVEAU = {
  confortable: "bon",
  surveiller: "alerte",
  tendu: "alerte",
  perte: "critique",
  indetermine: "neutre",
} as const;

/**
 * Le taux lu contre ses paliers. Une jauge plutôt qu'un graphique : c'est une
 * valeur unique qui ne prend son sens que par rapport à des bornes.
 */
function JaugeTaux({
  taux,
  niveau,
  projetable,
}: {
  taux: number | null;
  niveau: NiveauMois;
  projetable: boolean;
}) {
  // Trop tôt dans le mois, le palier est un artefact : la jauge reste neutre et
  // le dit, plutôt que d'afficher un niveau que le verdict contredit.
  const n = projetable ? NIVEAUX[niveau] : NIVEAUX.indetermine;
  const libelle = projetable ? n.libelle : taux == null ? "Indéterminé" : "Trop tôt pour conclure";
  // Au-delà de 100 %, la jauge sature : la barre dirait « presque plein » là où
  // le seuil est déjà franchi.
  const largeur = taux == null ? 0 : Math.min(100, (taux / 120) * 100);
  const marque = (valeur: number) => `${(valeur / 120) * 100}%`;

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums" style={{ color: n.barre }}>
          {taux == null ? "—" : `${taux.toFixed(0)} %`}
        </span>
        <span className={`text-sm font-medium ${n.encre}`}>{libelle}</span>
      </div>

      <div className="relative mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${largeur}%`, backgroundColor: n.barre }} />
        {[SEUILS.confortable, SEUILS.surveiller, SEUILS.tendu].map((seuil) => (
          <span
            key={seuil}
            className="absolute top-0 h-full w-px bg-slate-400"
            style={{ left: marque(seuil) }}
            aria-hidden
          />
        ))}
      </div>
      <div className="relative mt-1 h-4 text-[10px] text-slate-400">
        {[SEUILS.confortable, SEUILS.surveiller, SEUILS.tendu].map((seuil) => (
          <span key={seuil} className="absolute -translate-x-1/2 tabular-nums" style={{ left: marque(seuil) }}>
            {seuil}%
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Part des recettes absorbée par les dépenses. Sous {SEUILS.confortable} % le mois est confortable ; au-delà de{" "}
        {SEUILS.tendu} % il est à perte.
      </p>
    </div>
  );
}

export function MoisDashboard({ data }: { data: MoisComptable }) {
  const verdict = verdictDuMois(data);
  const n = NIVEAUX[verdict.niveau];
  const serieVide = data.serie.every((j) => j.recettes === 0 && j.depenses === 0);

  function exportCsv() {
    downloadCsv(`mois_${data.debut.toISOString().slice(0, 7)}.csv`, [
      ["Jour", "Recettes", "Dépenses", "Résultat", "Recettes cumulées", "Dépenses cumulées", "Résultat cumulé"],
      ...data.serie.map((j) => [
        j.label,
        j.recettes,
        j.depenses,
        j.recettes - j.depenses,
        j.cumulRecettes,
        j.cumulDepenses,
        j.cumulResultat,
      ]),
    ]);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Recettes encaissées"
          value={formatFCFA(data.recettes)}
          hint={`${data.nombreEncaissements} encaissement(s) · ${formatFCFA(Math.round(data.recettesParJour))}/jour`}
        />
        <StatTile
          label="Dépenses"
          value={formatFCFA(data.depenses)}
          hint={`${data.nombreDepenses} dépense(s) · ${formatFCFA(Math.round(data.depensesParJour))}/jour`}
        />
        <StatTile
          label="Résultat"
          value={formatFCFA(data.resultat)}
          tone={data.resultat >= 0 ? "bon" : "critique"}
          hint={`${data.joursEcoules} jour(s) sur ${data.joursDansLeMois}`}
        />
        {/* Tant que la projection n'est pas fiable, la tuile ne porte pas de
            palier : afficher « À perte » au-dessus d'un verdict qui dit de ne
            rien changer donnerait deux messages contraires. */}
        <StatTile
          label="Taux de dépenses"
          value={data.taux == null ? "—" : `${data.taux.toFixed(0)} %`}
          tone={data.projetable ? TONE_PAR_NIVEAU[data.niveau] : "neutre"}
          hint={
            data.projetable
              ? NIVEAUX[data.niveau].libelle
              : `Sur ${data.joursEcoules} jour(s) — trop tôt pour conclure`
          }
        />
      </div>

      {/* Le verdict porte le niveau par son fond ET par son texte : la couleur
          seule ne dit rien à qui ne la distingue pas. */}
      <div className={`rounded-xl border p-4 ${n.fond}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={`text-lg font-semibold ${n.encre}`}>{verdict.titre}</h2>
          <span className={`rounded-full border border-current px-2 py-0.5 text-xs font-semibold ${n.encre}`}>
            {n.libelle}
          </span>
        </div>
        <p className={`mt-2 text-sm ${n.encre}`}>{verdict.message}</p>
        <p className={`mt-2 text-sm font-medium ${n.encre}`}>{verdict.conseil}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold">Taux de dépenses</h3>
          <p className="mt-0.5 mb-4 text-xs text-slate-400">
            Constaté sur {data.joursEcoules} jour(s) de {data.moisLabel}
          </p>
          <JaugeTaux taux={data.taux} niveau={data.niveau} projetable={data.projetable} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
          <h3 className="font-semibold">Fin de mois</h3>
          <p className="mt-0.5 mb-4 text-xs text-slate-400">
            {data.projetable
              ? `Projection au rythme des ${data.joursEcoules} premiers jours`
              : `Disponible à partir du ${data.joursAvantProjection}ᵉ jour du mois`}
          </p>

          {data.projetable ? (
            <>
              <dl className="grid gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-slate-400">Recettes projetées</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {formatFCFA(Math.round(data.recettesProjetees ?? 0))}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Dépenses projetées</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {formatFCFA(Math.round(data.depensesProjetees ?? 0))}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Résultat projeté</dt>
                  <dd
                    className={`text-lg font-semibold tabular-nums ${
                      (data.resultatProjete ?? 0) >= 0 ? "text-[#0ca30c]" : "text-[#d03b3b]"
                    }`}
                  >
                    {formatFCFA(Math.round(data.resultatProjete ?? 0))}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                  Ce qu&apos;il reste à dépenser · {data.joursRestants} jour(s) restant(s)
                </p>
                <table className="w-full text-sm tabular-nums">
                  <thead>
                    <tr className="text-left text-xs uppercase text-slate-400">
                      <th className="pb-1 pr-3 font-medium">Pour finir sous</th>
                      <th className="pb-1 pr-3 text-right font-medium">Enveloppe restante</th>
                      <th className="pb-1 pr-3 text-right font-medium">Plafond / jour</th>
                      <th className="pb-1 text-right font-medium">Correction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { titre: `${SEUILS.confortable} % — confortable`, budget: data.budgetConfortable },
                      { titre: `${SEUILS.surveiller} % — acceptable`, budget: data.budgetSurveiller },
                      { titre: `${SEUILS.tendu} % — équilibre`, budget: data.budgetEquilibre },
                    ].map(({ titre, budget }) => (
                      <tr key={titre} className="border-t border-slate-100">
                        <td className="py-1.5 pr-3">{titre}</td>
                        <td
                          className={`py-1.5 pr-3 text-right font-medium ${
                            budget?.depassement ? "text-[#d03b3b]" : ""
                          }`}
                        >
                          {budget ? formatFCFA(Math.round(budget.reste)) : "—"}
                          {budget?.depassement && <span className="ml-1 text-xs">dépassé</span>}
                        </td>
                        <td className="py-1.5 pr-3 text-right text-slate-600">
                          {budget && !budget.depassement ? formatFCFA(Math.round(budget.parJour)) : "—"}
                        </td>
                        {/* Un plafond ne dit rien seul : c'est l'écart au rythme
                            actuel qui indique s'il faut freiner, et de combien. */}
                        <td className="py-1.5 text-right">
                          {!budget ? (
                            "—"
                          ) : budget.depassement ? (
                            <span className="text-xs font-semibold text-[#d03b3b]">Tout suspendre</span>
                          ) : budget.doitCorriger ? (
                            <span className="text-xs font-semibold text-[#b47400]">
                              −{formatFCFA(Math.round(budget.reduction))}/jour
                            </span>
                          ) : (
                            <span className="text-xs text-[#0ca30c]">Dans les clous</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-slate-400">
                  Rythme de dépense actuel : {formatFCFA(Math.round(data.depensesParJour))} par jour.
                </p>
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">
              {data.joursEcoules} jour(s) écoulé(s) : une projection reposerait sur trop peu de données.
              <br />
              <span className="text-xs text-slate-400">
                Un réapprovisionnement pèse d&apos;un coup mais couvre plusieurs semaines — extrapolé jour
                par jour, il annoncerait une dérive qui n&apos;existe pas.
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Recettes et dépenses, jour par jour"
          hint="Deux mesures de même nature sur un axe unique"
          isEmpty={serieVide}
          table={{
            headers: ["Jour", "Recettes", "Dépenses", "Résultat"],
            rows: data.serie.map((j) => [
              j.label,
              formatFCFA(j.recettes),
              formatFCFA(j.depenses),
              formatFCFA(j.recettes - j.depenses),
            ]),
          }}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.serie} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
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

        <ChartCard
          title="Cumul depuis le début du mois"
          hint="Tant que la courbe des recettes reste au-dessus, le mois est bénéficiaire"
          isEmpty={serieVide}
          table={{
            headers: ["Jour", "Recettes cumulées", "Dépenses cumulées", "Résultat cumulé"],
            rows: data.serie.map((j) => [
              j.label,
              formatFCFA(j.cumulRecettes),
              formatFCFA(j.cumulDepenses),
              formatFCFA(j.cumulResultat),
            ]),
          }}
        >
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.serie} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
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
              <Legend iconType="plainline" iconSize={14} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Line
                type="monotone"
                dataKey="cumulRecettes"
                name="Recettes"
                stroke={SERIE.recettes}
                strokeWidth={CHART_MARK.strokeWidth}
                dot={{ r: 4, strokeWidth: 2, stroke: CHART.surface }}
              />
              <Line
                type="monotone"
                dataKey="cumulDepenses"
                name="Dépenses"
                stroke={SERIE.depenses}
                strokeWidth={CHART_MARK.strokeWidth}
                dot={{ r: 4, strokeWidth: 2, stroke: CHART.surface }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">D&apos;où viennent les dépenses</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Ce qui pèse le plus est ce sur quoi une correction agit le plus
            </p>
          </div>
          {data.serie.length > 0 && (
            <button type="button" onClick={exportCsv} className="text-xs text-slate-600 hover:underline">
              Exporter CSV
            </button>
          )}
        </div>

        {data.achatsStock > 0 && (
          <p className="mb-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
            {formatFCFA(data.achatsStock)} de ces dépenses sont des achats de stock, soit{" "}
            {((data.achatsStock / data.depenses) * 100).toFixed(0)} % du total. Ce n&apos;est pas une charge
            consommée : la marchandise est en réserve et servira les jours suivants. Couper là-dessus
            n&apos;améliore le mois qu&apos;en apparence.
          </p>
        )}

        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-400">
              <th className="pb-2 pr-3 font-medium">Catégorie</th>
              <th className="pb-2 pr-3 font-medium">Part</th>
              <th className="pb-2 text-right font-medium">Montant</th>
            </tr>
          </thead>
          <tbody>
            {data.parCategorie.map((c) => (
              <tr key={c.categorie} className="border-t border-slate-100">
                <td className="py-2 pr-3 font-medium">{c.categorie}</td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full" style={{ width: `${c.part}%`, backgroundColor: SERIE.depenses }} />
                    </div>
                    <span className="text-xs text-slate-500">{c.part.toFixed(0)} %</span>
                  </div>
                </td>
                <td className="py-2 text-right font-semibold">{formatFCFA(c.total)}</td>
              </tr>
            ))}
            {data.parCategorie.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-slate-400">
                  Aucune dépense enregistrée ce mois-ci.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

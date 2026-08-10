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
import Link from "next/link";
import { downloadCsv } from "@/lib/csv";
import { formatDate, formatFCFA } from "@/lib/format";
import type { TresorerieDuMois } from "@/lib/caisse-comptable";
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

/** Une poche de la trésorerie : son parcours, du départ au 31. */
function Poche({
  titre,
  legende,
  couleur,
  debut,
  mouvementLabel,
  mouvement,
  fin,
  alerte,
  projete,
  projeteLabel,
}: {
  titre: string;
  legende: string;
  couleur: string;
  debut: number;
  mouvementLabel: string;
  mouvement: number;
  fin: number;
  alerte?: boolean;
  /** Où la poche finirait le mois au rythme actuel, `null` s'il est trop tôt. */
  projete?: number | null;
  projeteLabel: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: couleur }} />
        <h4 className="text-sm font-semibold">{titre}</h4>
      </div>
      <p className="mt-0.5 text-xs text-slate-400">{legende}</p>
      <dl className="mt-3 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-xs text-slate-400">En début de mois</dt>
          <dd className="text-sm font-medium tabular-nums">{formatFCFA(debut)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-xs text-slate-400">{mouvementLabel}</dt>
          <dd className="text-sm font-medium tabular-nums">{formatFCFA(Math.abs(mouvement))}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2 border-t border-slate-100 pt-1.5">
          <dt className="text-xs font-medium text-slate-600">Aujourd&apos;hui</dt>
          <dd
            className={`text-lg font-semibold tabular-nums ${alerte ? "text-[#d03b3b]" : ""}`}
          >
            {formatFCFA(fin)}
          </dd>
        </div>
        {/* La projection reste en retrait du constaté : c'est une droite tirée
            d'un rythme, pas un montant que quelqu'un pourra compter. Lui donner
            la même graisse qu'au solde du jour la ferait lire comme un fait. */}
        {projete != null && (
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-xs text-slate-400">{projeteLabel}</dt>
            <dd
              className={`text-sm font-medium tabular-nums ${
                projete < 0 ? "text-[#d03b3b]" : "text-slate-500"
              }`}
            >
              {formatFCFA(Math.round(projete))}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/**
 * Avec quel argent le mois a réglé ses achats, et où sont passées ses recettes.
 *
 * Sa place est sous le verdict, et non dans les tuiles : il ne corrige aucun
 * chiffre du mois, il dit d'où vient l'argent. Mis en tuile à côté des recettes,
 * il se lirait comme une recette de plus.
 *
 * Les deux poches restent séparées parce qu'elles ne jouent pas le même rôle :
 * le coffre est la seule où le mois puise, le compte Wave ne fait que se
 * remplir. Les fondre en un total unique masquerait ce qui explique le mois —
 * un coffre qui se vide pendant qu'une part des recettes s'accumule ailleurs.
 *
 * La projection à fin de mois vit ici et non dans le bloc « Fin de mois », qui
 * répond à une autre question : celui-là dit si le mois gagne de l'argent,
 * celui-ci dit s'il en aura sous la main. Un mois peut très bien être rentable
 * et manquer d'espèces le 20.
 */
function BlocTresorerie({
  tresorerie,
  recettes,
  resultat,
  joursDansLeMois,
}: {
  tresorerie: TresorerieDuMois;
  recettes: number;
  resultat: number;
  joursDansLeMois: number;
}) {
  const { coffre, wave, projection } = tresorerie;
  const projeteLabel = `Au ${joursDansLeMois}, au rythme actuel`;
  // Un coffre peut être regarni plutôt qu'entamé : un mois qui encaisse en
  // espèces plus qu'il ne dépense repart avec un coffre plus lourd qu'il ne l'a
  // trouvé.
  const consomme = coffre.entame > 0;
  const partWave = recettes > 0 ? (wave.encaisse / recettes) * 100 : 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">Trésorerie du mois</h3>
        <span className="text-xs text-slate-400">
          Coffre compté le {formatDate(coffre.comptage.countedAt)}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-slate-400">
        L&apos;argent dont le mois disposait en commençant, et ce qu&apos;il en reste. Il tient en
        deux poches qui ne se comportent pas pareil : les achats se règlent au coffre, jamais en
        Wave.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Poche
          titre="Coffre"
          legende="Espèces : versements du soir, achats de la comptabilité"
          couleur={CHART.especes}
          debut={coffre.report}
          mouvementLabel={consomme ? "Entamé depuis" : "Regarni depuis"}
          mouvement={coffre.entame}
          fin={coffre.solde}
          alerte={coffre.impossible}
          projete={projection?.coffre}
          projeteLabel={projeteLabel}
        />
        <Poche
          titre="Compte Wave"
          legende="Encaissé depuis le démarrage, jamais entamé"
          couleur={CHART.wave}
          debut={wave.report}
          mouvementLabel="Encaissé ce mois-ci"
          mouvement={wave.encaisse}
          fin={wave.solde}
          projete={projection?.wave}
          projeteLabel={projeteLabel}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
        <span className="text-sm font-medium text-slate-600">Les deux poches réunies</span>
        <span className="text-lg font-semibold tabular-nums">
          {formatFCFA(tresorerie.solde)}{" "}
          <span className="text-xs font-normal text-slate-400">
            contre {formatFCFA(tresorerie.report)} en début de mois
            {projection && `, et ${formatFCFA(Math.round(projection.total))} au ${joursDansLeMois}`}
          </span>
        </span>
      </div>

      {/* Le coffre est la seule poche qui puisse manquer : c'est de là que
          sortent les achats. L'annoncer à date donne le temps de décaler un
          réapprovisionnement — une fois le coffre vide, il n'y a plus de choix
          à faire. */}
      {projection?.rupture && (
        <p className="mt-3 rounded-md border border-[#fab219] bg-[#fab219]/10 px-3 py-2 text-sm text-slate-700">
          <span className="font-semibold">
            Le coffre serait vide vers le {formatDate(projection.rupture)}
          </span>
          , avant la fin du mois : il se vide de{" "}
          {formatFCFA(Math.round(-projection.rythmeCoffre))} par jour
          {wave.encaisse > 0 && ", pendant que les recettes Wave s'accumulent hors de sa portée"}. Ce
          n&apos;est pas une perte — le résultat du mois n&apos;en dit rien — mais les achats se
          règlent en espèces, et il n&apos;y en aurait plus.
        </p>
      )}

      {/* Un coffre négatif ne se constate pas, il se signale : la maison n'est
          pas à sec, c'est le calcul qui a perdu le fil. */}
      {coffre.impossible && (
        <p className="mt-3 rounded-md border border-[#d03b3b] bg-[#d03b3b]/5 px-3 py-2 text-sm text-slate-700">
          <span className="font-semibold text-[#d03b3b]">Le coffre ressort négatif</span>, ce
          qu&apos;un coffre ne peut pas être : il manque quelque chose au calcul. Soit un comptage
          récent, qui le recalerait sur ce qu&apos;il contient réellement ; soit des achats réglés
          autrement qu&apos;en espèces prises au coffre, que rien ne permet aujourd&apos;hui de
          distinguer.{" "}
          <Link href="/comptabilite/caisse" className="font-medium text-orange-600 hover:underline">
            Compter la caisse
          </Link>
        </p>
      )}

      {/* La conclusion dépend du sens dans lequel le coffre a bougé : un mois qui
          encaisse beaucoup en Wave peut malgré tout regarnir son coffre, si les
          espèces du mois ont suffi aux achats. */}
      {wave.encaisse > 0 && (
        <p className="mt-3 text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{partWave.toFixed(0)} %</span> des recettes
          du mois ({formatFCFA(wave.encaisse)}) sont entrées sur le compte Wave, hors du coffre où se
          règlent les achats.{" "}
          {consomme
            ? "Le coffre se vide donc plus vite que le mois ne perd de l'argent — un résultat et une trésorerie sont deux questions différentes."
            : "Le coffre n'en a pas moins tenu : les espèces encaissées ont suffi aux achats du mois."}
        </p>
      )}

      {coffre.creux && (
        <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Le mois s&apos;est appuyé jusqu&apos;à{" "}
          <span className="font-semibold text-slate-900">{formatFCFA(coffre.creux.montant)}</span> sur
          les espèces héritées du mois précédent, au {formatDate(coffre.creux.date)} : sans elles, le
          coffre y aurait été à découvert d&apos;autant.
        </p>
      )}

      <p className="mt-2 text-xs text-slate-400">
        Le résultat du mois ({formatFCFA(resultat)}) n&apos;en est pas changé : une dépense reste une
        charge du mois où elle est engagée, quelle que soit la poche qui l&apos;a payée. Le solde
        Wave est ce que l&apos;application a vu passer, non un relevé du compte.{" "}
        <Link href="/comptabilite/caisse" className="text-orange-600 hover:underline">
          Voir le livre de caisse
        </Link>
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

      {data.tresorerie && (
        <BlocTresorerie
          tresorerie={data.tresorerie}
          recettes={data.recettes}
          resultat={data.resultat}
          joursDansLeMois={data.joursDansLeMois}
        />
      )}

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

import { eachMonthOfInterval, format, startOfMonth, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { niveauPourTaux, type NiveauMois } from "@/lib/mois-verdict";

/**
 * Les mois révolus, une ligne par mois.
 *
 * Le mois en cours en est exclu, et pas par commodité : cinq jours écoulés
 * placés à côté de trente et un se compareraient à tort, et la courbe
 * plongerait chaque 1er du mois sans que rien ne se soit passé. Le mois en cours
 * a son écran, qui sait dire ce qu'il vaut au prorata des jours ; celui-ci ne
 * montre que des mois finis, donc comparables entre eux.
 *
 * Les recettes sont ici les encaissements, comme sur la page du mois : c'est la
 * même lecture de gestion, prolongée dans le temps. La recette comptable
 * officielle — celle des caisses clôturées — reste l'affaire de `getComptabilite`.
 */

export type MoisRevolu = {
  /** Clé d'URL et de tri : « 2026-08 ». */
  cle: string;
  /** « août 2026 ». */
  label: string;
  /** « août 26 » : la forme abrégée du fuseau français, pour un axe de graphique. */
  court: string;
  debut: Date;
  recettes: number;
  depenses: number;
  resultat: number;
  /** `null` sans recette : un rapport à zéro ne mesure rien. */
  taux: number | null;
  niveau: NiveauMois;
  nombreEncaissements: number;
  nombreDepenses: number;
  /** Part des dépenses qui a constitué de la réserve plutôt qu'une charge consommée. */
  achatsStock: number;
};

export type HistoriqueMois = {
  /** Du plus ancien au plus récent : l'ordre d'une série, que la courbe suit. */
  mois: MoisRevolu[];
  /** Le cumul de tous les mois clos, pour situer une année plutôt qu'un mois. */
  totaux: {
    recettes: number;
    depenses: number;
    resultat: number;
    taux: number | null;
    niveau: NiveauMois;
    nombreMois: number;
  };
  /** Les deux extrêmes, quand il y a au moins deux mois à comparer. */
  meilleur: MoisRevolu | null;
  pire: MoisRevolu | null;
};

export async function getHistoriqueMois(maintenant = new Date()): Promise<HistoriqueMois> {
  // Borne haute exclusive : tout ce qui appartient au mois en cours relève de
  // l'autre écran.
  const moisCourant = startOfMonth(maintenant);

  const [paiements, depenses] = await Promise.all([
    prisma.payment.findMany({
      where: { createdAt: { lt: moisCourant } },
      select: { amount: true, createdAt: true },
    }),
    prisma.expense.findMany({
      where: { date: { lt: moisCourant } },
      select: { amount: true, date: true, stockMovement: { select: { id: true } } },
    }),
  ]);

  type Cumul = {
    recettes: number;
    depenses: number;
    nombreEncaissements: number;
    nombreDepenses: number;
    achatsStock: number;
  };
  const vide = (): Cumul => ({
    recettes: 0,
    depenses: 0,
    nombreEncaissements: 0,
    nombreDepenses: 0,
    achatsStock: 0,
  });

  // Clé formatée dans le fuseau du serveur, calé à GMT par `instrumentation.ts` :
  // c'est celui du restaurant. Sans lui, un encaissement du 1er à minuit
  // retomberait dans le mois précédent.
  const parMois = new Map<string, Cumul>();
  const cumulPour = (date: Date) => {
    const cle = format(date, "yyyy-MM");
    let cumul = parMois.get(cle);
    if (!cumul) parMois.set(cle, (cumul = vide()));
    return cumul;
  };

  for (const p of paiements) {
    const cumul = cumulPour(p.createdAt);
    cumul.recettes += p.amount;
    cumul.nombreEncaissements += 1;
  }
  for (const e of depenses) {
    const cumul = cumulPour(e.date);
    cumul.depenses += e.amount;
    cumul.nombreDepenses += 1;
    if (e.stockMovement != null) cumul.achatsStock += e.amount;
  }

  if (parMois.size === 0) {
    return {
      mois: [],
      totaux: { recettes: 0, depenses: 0, resultat: 0, taux: null, niveau: "indetermine", nombreMois: 0 },
      meilleur: null,
      pire: null,
    };
  }

  // Les mois sans le moindre mouvement sont rétablis entre les autres : les
  // sauter tasserait la courbe et ferait passer une fermeture pour une
  // continuité. Le dernier mois de la série est toujours celui qui précède le
  // mois en cours, même s'il est resté vide — son absence serait, elle aussi,
  // une information.
  const premier = Array.from(parMois.keys()).sort()[0];
  const mois = eachMonthOfInterval({
    start: new Date(`${premier}-01T00:00:00.000Z`),
    end: subMonths(moisCourant, 1),
  }).map((debut): MoisRevolu => {
    const cle = format(debut, "yyyy-MM");
    const { recettes, depenses, nombreEncaissements, nombreDepenses, achatsStock } =
      parMois.get(cle) ?? vide();
    const taux = recettes > 0 ? (depenses / recettes) * 100 : null;
    return {
      cle,
      label: format(debut, "MMMM yyyy", { locale: fr }),
      court: format(debut, "MMM yy", { locale: fr }),
      debut,
      recettes,
      depenses,
      resultat: recettes - depenses,
      taux,
      niveau: niveauPourTaux(taux),
      nombreEncaissements,
      nombreDepenses,
      achatsStock,
    };
  });

  const recettes = mois.reduce((s, m) => s + m.recettes, 0);
  const depensesTotal = mois.reduce((s, m) => s + m.depenses, 0);
  const tauxTotal = recettes > 0 ? (depensesTotal / recettes) * 100 : null;

  // Les extrêmes se prennent sur le résultat, pas sur le taux : ce qui distingue
  // un bon mois d'un mauvais est ce qu'il a laissé, et un petit mois très
  // économe ferait sinon la meilleure ligne du tableau. Ils ne sont montrés
  // qu'à partir de deux mois — désigner un extrême dans une série d'un seul
  // élément ne compare rien.
  const classes = mois.filter((m) => m.recettes > 0 || m.depenses > 0);
  const compares = classes.length >= 2 ? [...classes].sort((a, b) => b.resultat - a.resultat) : [];

  return {
    mois,
    totaux: {
      recettes,
      depenses: depensesTotal,
      resultat: recettes - depensesTotal,
      taux: tauxTotal,
      niveau: niveauPourTaux(tauxTotal),
      nombreMois: mois.length,
    },
    meilleur: compares[0] ?? null,
    pire: compares[compares.length - 1] ?? null,
  };
}

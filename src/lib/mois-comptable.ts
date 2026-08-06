import {
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDaysInMonth,
  startOfMonth,
} from "date-fns";
import { fr } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { getReportDuMois } from "@/lib/caisse-comptable";
import { JOURS_AVANT_PROJECTION, niveauPourTaux, SEUILS } from "@/lib/mois-verdict";

/**
 * Croisement recettes / dépenses du mois en cours.
 *
 * Les recettes retenues ici sont les encaissements, pas les versements : le taux
 * doit rester lisible en cours de journée, or une recette n'entre en versement
 * qu'à la clôture du soir. C'est donc une lecture de gestion, pas l'état comptable
 * officiel — que donne `getComptabilite`.
 *
 * L'interprétation de ces chiffres vit dans `mois-verdict`, qui ne touche pas la
 * base et peut donc être lue côté client.
 */

export type MoisComptable = Awaited<ReturnType<typeof getMoisComptable>>;

export async function getMoisComptable(maintenant = new Date()) {
  // Bornes lues dans le fuseau du serveur, que `instrumentation.ts` fixe à GMT :
  // c'est celui de Dakar, et celui dans lequel les dépenses saisies au jour sont
  // enregistrées. Sans cette garantie, le 1er du mois basculerait dans le mois
  // précédent et sortirait du total.
  const debut = startOfMonth(maintenant);
  const finDuMois = endOfMonth(maintenant);

  const [paiements, depensesBrutes, report] = await Promise.all([
    prisma.payment.findMany({
      where: { createdAt: { gte: debut, lte: finDuMois } },
      select: { amount: true, method: true, createdAt: true },
    }),
    prisma.expense.findMany({
      where: { date: { gte: debut, lte: finDuMois } },
      select: { amount: true, category: true, date: true, stockMovement: { select: { id: true } } },
    }),
    // Les espèces déjà au coffre quand le mois a commencé. Elles ne changent
    // rien au résultat, mais disent avec quel argent les premiers achats ont
    // été réglés — un mois qui démarre sur une réserve n'est pas un mois qui
    // démarre à zéro.
    getReportDuMois(debut, finDuMois, maintenant),
  ]);

  const recettes = paiements.reduce((s, p) => s + p.amount, 0);
  const depenses = depensesBrutes.reduce((s, e) => s + e.amount, 0);
  const resultat = recettes - depenses;

  // Sans recette, le rapport n'a pas de valeur : diviser par zéro afficherait un
  // taux infini là où il n'y a simplement rien à mesurer.
  const taux = recettes > 0 ? (depenses / recettes) * 100 : null;

  const joursDansLeMois = getDaysInMonth(maintenant);
  const joursEcoules = differenceInCalendarDays(maintenant, debut) + 1;
  const joursRestants = Math.max(0, joursDansLeMois - joursEcoules);

  const recettesParJour = recettes / joursEcoules;
  const depensesParJour = depenses / joursEcoules;

  // ------------------------------------------------------------------ Série

  const jours = eachDayOfInterval({ start: debut, end: maintenant });
  const recettesParDate = new Map<string, number>();
  const depensesParDate = new Map<string, number>();
  for (const p of paiements) {
    const cle = format(p.createdAt, "yyyy-MM-dd");
    recettesParDate.set(cle, (recettesParDate.get(cle) ?? 0) + p.amount);
  }
  for (const e of depensesBrutes) {
    const cle = format(e.date, "yyyy-MM-dd");
    depensesParDate.set(cle, (depensesParDate.get(cle) ?? 0) + e.amount);
  }

  let cumulRecettes = 0;
  let cumulDepenses = 0;
  const serie = jours.map((jour) => {
    const cle = format(jour, "yyyy-MM-dd");
    const r = recettesParDate.get(cle) ?? 0;
    const d = depensesParDate.get(cle) ?? 0;
    cumulRecettes += r;
    cumulDepenses += d;
    return {
      label: format(jour, "dd/MM"),
      recettes: r,
      depenses: d,
      cumulRecettes,
      cumulDepenses,
      cumulResultat: cumulRecettes - cumulDepenses,
    };
  });

  // -------------------------------------------------------------- Dépenses

  const parCategorieMap = new Map<string, number>();
  for (const e of depensesBrutes) {
    parCategorieMap.set(e.category, (parCategorieMap.get(e.category) ?? 0) + e.amount);
  }
  const parCategorie = Array.from(parCategorieMap.entries())
    .map(([categorie, total]) => ({
      categorie,
      total,
      part: depenses > 0 ? (total / depenses) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Un achat de stock n'est pas une charge consommée : il constitue une réserve
  // qui servira les jours suivants. Le distinguer évite de conclure à une dérive
  // quand le mois commence simplement par un réapprovisionnement.
  const achatsStock = depensesBrutes
    .filter((e) => e.stockMovement != null)
    .reduce((s, e) => s + e.amount, 0);

  // ------------------------------------------------------------ Projection

  const projetable = joursEcoules >= JOURS_AVANT_PROJECTION;
  const recettesProjetees = projetable ? recettesParJour * joursDansLeMois : null;
  const depensesProjetees = projetable ? depensesParJour * joursDansLeMois : null;
  const tauxProjete =
    recettesProjetees && recettesProjetees > 0 && depensesProjetees != null
      ? (depensesProjetees / recettesProjetees) * 100
      : null;
  const resultatProjete =
    recettesProjetees != null && depensesProjetees != null ? recettesProjetees - depensesProjetees : null;

  /**
   * Enveloppe de dépenses encore disponible pour finir le mois sous un seuil,
   * et ce qu'elle représente par jour restant. C'est le chiffre sur lequel le
   * comptable peut agir : le taux constate, celui-ci commande.
   */
  function budgetRestant(seuil: number) {
    if (recettesProjetees == null || recettesProjetees <= 0) return null;
    const plafond = (recettesProjetees * seuil) / 100;
    const reste = plafond - depenses;
    // Le dernier jour du mois, il n'y a plus de jours à répartir : l'enveloppe
    // vaut pour la journée en cours.
    const parJour = reste / Math.max(1, joursRestants);
    return {
      seuil,
      plafond,
      reste,
      parJour,
      depassement: reste < 0,
      /**
       * Le seul chiffre qui dise s'il faut corriger. Le taux constate, l'enveloppe
       * plafonne — mais tant que le rythme de dépense reste sous ce plafond, il n'y
       * a rien à changer. Annoncer une enveloppe plus large que le rythme actuel
       * comme une consigne reviendrait à autoriser une hausse en croyant freiner.
       */
      reduction: Math.max(0, depensesParJour - parJour),
      doitCorriger: reste < 0 || parJour < depensesParJour,
    };
  }

  const niveau = niveauPourTaux(taux);
  const niveauProjete = niveauPourTaux(tauxProjete);

  return {
    moisLabel: format(debut, "MMMM yyyy", { locale: fr }),
    debut,
    fin: finDuMois,
    joursDansLeMois,
    joursEcoules,
    joursRestants,
    projetable,
    joursAvantProjection: JOURS_AVANT_PROJECTION,

    recettes,
    depenses,
    resultat,
    taux,
    niveau,

    nombreEncaissements: paiements.length,
    nombreDepenses: depensesBrutes.length,
    recettesParJour,
    depensesParJour,

    serie,
    parCategorie,
    achatsStock,
    report,

    recettesProjetees,
    depensesProjetees,
    resultatProjete,
    tauxProjete,
    niveauProjete,
    budgetConfortable: budgetRestant(SEUILS.confortable),
    budgetSurveiller: budgetRestant(SEUILS.surveiller),
    budgetEquilibre: budgetRestant(SEUILS.tendu),
  };
}

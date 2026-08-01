/**
 * Lecture du mois : paliers, niveaux, et la consigne qui en découle.
 *
 * Séparé de `mois-comptable` à dessein : ce module ne touche pas la base et peut
 * donc être importé par un composant client. Le module serveur entraînerait
 * Prisma dans le bundle du navigateur.
 */

/**
 * Paliers du taux de dépenses. Écrits ici plutôt que stockés : ils relèvent de la
 * politique de gestion, pas de la donnée, et se règlent en changeant ces valeurs.
 */
export const SEUILS = {
  confortable: 70,
  surveiller: 85,
  tendu: 100,
} as const;

/**
 * En dessous de ce nombre de jours écoulés, aucune projection n'est affichée.
 *
 * Les dépenses sont grumeleuses : un sac de riz acheté le 2 couvre trois semaines,
 * mais une extrapolation linéaire le rachèterait chaque jour. Projeter trop tôt
 * annoncerait un mois catastrophique et pousserait à couper des dépenses saines.
 */
export const JOURS_AVANT_PROJECTION = 7;

export type NiveauMois = "confortable" | "surveiller" | "tendu" | "perte" | "indetermine";

export type Budget = {
  seuil: number;
  plafond: number;
  reste: number;
  parJour: number;
  depassement: boolean;
  reduction: number;
  doitCorriger: boolean;
};

export type Verdict = {
  niveau: NiveauMois;
  titre: string;
  message: string;
  /** Ce que le comptable doit faire, en une phrase. */
  conseil: string;
};

/** Ce dont la lecture a besoin, sans dépendre de la forme complète du calcul. */
export type DonneesVerdict = {
  recettes: number;
  taux: number | null;
  tauxProjete: number | null;
  projetable: boolean;
  joursEcoules: number;
  joursRestants: number;
  joursAvantProjection: number;
  depensesParJour: number;
  budgetConfortable: Budget | null;
  budgetSurveiller: Budget | null;
  budgetEquilibre: Budget | null;
};

/** Palier atteint par un taux de dépenses. */
export function niveauPourTaux(taux: number | null): NiveauMois {
  if (taux == null) return "indetermine";
  if (taux > SEUILS.tendu) return "perte";
  if (taux > SEUILS.surveiller) return "tendu";
  if (taux > SEUILS.confortable) return "surveiller";
  return "confortable";
}

/**
 * Traduit le mois en une conclusion et une consigne.
 *
 * Tant que la projection n'est pas fiable, le verdict porte sur ce qui est
 * constaté, jamais sur ce qui est prédit : annoncer un mois perdu au vu de trois
 * jours ferait couper des dépenses sur un artefact de calcul.
 */
export function verdictDuMois(data: DonneesVerdict): Verdict {
  const { taux, tauxProjete, projetable, joursRestants, recettes } = data;

  if (recettes <= 0) {
    return {
      niveau: "indetermine",
      titre: "Pas encore de recette ce mois-ci",
      message: "Aucun encaissement n'a été enregistré : le taux de dépenses n'a rien à mesurer.",
      conseil: "Rien à corriger pour l'instant. Le taux apparaîtra dès le premier encaissement.",
    };
  }

  if (!projetable) {
    return {
      niveau: niveauPourTaux(taux),
      titre: "Trop tôt pour se prononcer sur le mois",
      message:
        `Le taux constaté est de ${taux!.toFixed(0)} %, mais il porte sur ${data.joursEcoules} jour(s) seulement. ` +
        `Un réapprovisionnement pèse d'un coup alors qu'il couvrira plusieurs semaines : en début de mois, ce taux est ` +
        `presque toujours trop sombre.`,
      conseil: `Attendez le ${data.joursAvantProjection}ᵉ jour avant d'ajuster quoi que ce soit. D'ici là, surveillez sans corriger.`,
    };
  }

  const niveau = niveauPourTaux(tauxProjete);
  const projete = tauxProjete!.toFixed(0);
  const f = (v: number) => `${Math.round(v).toLocaleString("fr-FR")} F`;
  const rythme = f(data.depensesParJour);

  /**
   * Consigne tirée d'une enveloppe : freiner, ou constater qu'il n'y a rien à
   * freiner. C'est la comparaison au rythme actuel qui tranche, jamais le seul
   * montant restant — une enveloppe plus large que le rythme en cours, présentée
   * comme une consigne, autoriserait une hausse en croyant freiner.
   */
  function consignePour(budget: Budget | null, seuil: number) {
    if (!budget) return "Aucune correction chiffrable tant que les recettes ne sont pas établies.";
    if (budget.depassement) {
      return `L'enveloppe des ${seuil} % est déjà dépassée de ${f(-budget.reste)}. Suspendez toute dépense non indispensable sur les ${joursRestants} jour(s) restant(s) : seules les recettes peuvent encore redresser le mois.`;
    }
    if (budget.doitCorriger) {
      return `Vous dépensez ${rythme} par jour ; pour finir sous ${seuil} %, il faut redescendre à ${f(budget.parJour)} par jour sur les ${joursRestants} jour(s) restant(s), soit ${f(budget.reduction)} de moins chaque jour.`;
    }
    return `Rien à corriger : votre rythme est de ${rythme} par jour, sous le plafond de ${f(budget.parJour)} qui tient le mois à ${seuil} %. Il reste ${f(budget.reste)} d'enveloppe.`;
  }

  if (niveau === "perte") {
    return {
      niveau,
      titre: "Le mois part à perte",
      message: `Au rythme actuel, les dépenses atteindraient ${projete} % des recettes — plus que ce qui rentre.`,
      conseil: consignePour(data.budgetEquilibre, SEUILS.tendu),
    };
  }

  if (niveau === "tendu") {
    return {
      niveau,
      titre: "Le mois est jouable, mais tendu",
      message: `La projection donne ${projete} % de dépenses : le mois resterait positif, avec très peu de marge.`,
      // Viser l'équilibre ici reviendrait à répondre « rien à corriger » à qui
      // frôle la perte : chaque niveau vise le palier immédiatement meilleur.
      conseil: consignePour(data.budgetSurveiller, SEUILS.surveiller),
    };
  }

  if (niveau === "surveiller") {
    return {
      niveau,
      titre: "Le mois devrait être tenu",
      message: `La projection donne ${projete} % de dépenses : au-dessus de l'objectif de ${SEUILS.confortable} %, mais sans danger.`,
      conseil: consignePour(data.budgetConfortable, SEUILS.confortable),
    };
  }

  return {
    niveau,
    titre: "Le mois est bien engagé",
    message: `La projection donne ${projete} % de dépenses, sous l'objectif de ${SEUILS.confortable} %.`,
    conseil: consignePour(data.budgetConfortable, SEUILS.confortable),
  };
}

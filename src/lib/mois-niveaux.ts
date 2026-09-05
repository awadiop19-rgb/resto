import { CHART } from "@/lib/chart-theme";
import type { NiveauMois } from "@/lib/mois-verdict";

/**
 * Habillage des paliers du mois, partagé par l'écran du mois et celui des mois
 * passés.
 *
 * Le fond porte le niveau, le texte le nomme : la couleur seule ne dit rien à
 * qui ne la distingue pas. L'ambre du jeu graphique est trop clair pour un
 * texte, d'où l'encre foncée séparée de la barre.
 *
 * Partagé plutôt que dupliqué : deux tables voisines finiraient par diverger, et
 * le même mois se lirait « tendu » ici et « à surveiller » là.
 */
export const NIVEAUX: Record<
  NiveauMois,
  { libelle: string; fond: string; encre: string; barre: string }
> = {
  confortable: {
    libelle: "Confortable",
    fond: "bg-emerald-50 border-emerald-200",
    encre: "text-emerald-800",
    barre: CHART.bon,
  },
  surveiller: {
    libelle: "À surveiller",
    fond: "bg-amber-50 border-amber-200",
    encre: "text-amber-900",
    barre: CHART.alerte,
  },
  tendu: {
    libelle: "Tendu",
    fond: "bg-orange-50 border-orange-200",
    encre: "text-orange-900",
    barre: CHART.magnitudeAlt,
  },
  perte: {
    libelle: "À perte",
    fond: "bg-red-50 border-red-200",
    encre: "text-red-800",
    barre: CHART.critique,
  },
  indetermine: {
    libelle: "Indéterminé",
    fond: "bg-slate-50 border-slate-200",
    encre: "text-slate-700",
    barre: CHART.axe,
  },
};

export const TONE_PAR_NIVEAU = {
  confortable: "bon",
  surveiller: "alerte",
  tendu: "alerte",
  perte: "critique",
  indetermine: "neutre",
} as const;

/**
 * Recettes et Dépenses sont deux identités, pas deux états : elles gardent la
 * paire catégorielle validée du dépôt, et non le vert/rouge réservé au statut.
 */
export const SERIE = { recettes: CHART.magnitude, depenses: CHART.magnitudeAlt } as const;

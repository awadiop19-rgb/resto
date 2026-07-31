/**
 * Jetons graphiques des tableaux de bord.
 *
 * La paire catégorielle Espèces / Wave a été validée sur le fond blanc des cartes
 * (ΔE CVD 24.7, vision normale 33.6 — au-dessus des seuils de 8 et 15). Ne pas
 * remplacer ces valeurs sans revalider : deux couleurs « qui semblent différentes »
 * peuvent être identiques pour un lecteur daltonien.
 *
 * Règle d'attribution : la couleur suit l'entité, jamais son rang. Espèces reste
 * orange et Wave reste bleu quel que soit le filtre appliqué.
 */
export const CHART = {
  /** Catégoriel : identité du mode de paiement. */
  especes: "#eb6834",
  wave: "#2a78d6",
  /** Séquentiel : une seule teinte pour les graphiques de magnitude (une série). */
  magnitude: "#2a78d6",
  magnitudeAlt: "#eb6834",
  /** Statut : réservé à l'état (écart, solde), jamais à une série. */
  bon: "#0ca30c",
  alerte: "#fab219",
  critique: "#d03b3b",
  /** Habillage : grille et axes en filet, une nuance au-dessus du fond. */
  grille: "#e1e0d9",
  axe: "#c3c2b7",
  encreDiscrete: "#898781",
  /** Fond des cartes : sert aussi d'écart de 2px entre segments empilés. */
  surface: "#ffffff",
} as const;

/** Habillage commun des axes Recharts : filet solide, encre discrète, pas de tirets. */
export const AXIS_TICK = { fill: CHART.encreDiscrete, fontSize: 11 } as const;

export const TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: 8,
    border: `1px solid ${CHART.grille}`,
    boxShadow: "0 4px 12px rgba(11,11,11,0.08)",
    fontSize: 12,
  },
  cursor: { fill: "rgba(11,11,11,0.04)" },
} as const;

export const CHART_MARK = {
  /** Extrémité de barre arrondie, ancrée à la ligne de base. */
  radius: [4, 4, 0, 0] as [number, number, number, number],
  radiusHorizontal: [0, 4, 4, 0] as [number, number, number, number],
  /** Épaisseur des courbes. */
  strokeWidth: 2,
} as const;

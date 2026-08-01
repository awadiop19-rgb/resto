/**
 * Dépenses courantes réglées par un caissier depuis son tiroir.
 *
 * Liste volontairement distincte de celle de la comptabilité : un caissier ne
 * paie ni le loyer ni les salaires depuis sa caisse. Lui présenter ces choix
 * n'ouvrirait qu'une porte à l'erreur de saisie.
 *
 * Module sans accès à la base : le formulaire du comptoir en a besoin côté
 * client, et le module de caisse entraînerait Prisma dans le bundle navigateur.
 */
export const CATEGORIES_DEPENSE_CAISSE = [
  "Transport",
  "Gaz",
  "Glace",
  "Petit matériel",
  "Entretien",
  "Autre",
] as const;

export type CategorieDepenseCaisse = (typeof CATEGORIES_DEPENSE_CAISSE)[number];

export function estCategorieDeCaisse(valeur: string): valeur is CategorieDepenseCaisse {
  return (CATEGORIES_DEPENSE_CAISSE as readonly string[]).includes(valeur);
}

/**
 * Espèces réellement disponibles dans le tiroir à un instant donné.
 *
 * Le fond de caisse en fait partie : il est physiquement là et peut servir à
 * régler une dépense. Les encaissements Wave, non — ils ne passent pas par le
 * tiroir.
 */
export function especesDisponibles({
  openingFloat,
  totalCash,
  sorties,
}: {
  openingFloat: number;
  totalCash: number;
  sorties: number;
}) {
  return openingFloat + totalCash - sorties;
}

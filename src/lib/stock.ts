/**
 * Vocabulaire et mise en forme du stock. Aucun accès base : ce module est importé
 * aussi bien par les composants client que par les actions serveur, et charger
 * Prisma ici enverrait le pilote SQLite dans le bundle navigateur.
 * Les requêtes vivent dans `@/lib/stock-data`.
 */
import type { StockMovementType, StockUnit } from "@/generated/prisma/client";

export const UNITES: { value: StockUnit; label: string; court: string }[] = [
  { value: "KG", label: "Poids (kg)", court: "kg" },
  { value: "LITRE", label: "Volume (litre)", court: "L" },
  { value: "UNITE", label: "Quantité (unité)", court: "u" },
];

const UNITE_COURTE: Record<StockUnit, string> = {
  KG: "kg",
  LITRE: "L",
  UNITE: "u",
};

export const CATEGORIES_PRODUIT = [
  "Ingrédients",
  "Boissons",
  "Emballages",
  "Entretien",
  "Autre",
];

export const TYPES_MOUVEMENT: { value: StockMovementType; label: string }[] = [
  { value: "ACHAT", label: "Achat" },
  { value: "PRODUCTION", label: "Production maison" },
  { value: "SORTIE", label: "Sortie cuisine" },
  { value: "AJUSTEMENT", label: "Ajustement d'inventaire" },
];

const LIBELLE_TYPE: Record<StockMovementType, string> = {
  ACHAT: "Achat",
  PRODUCTION: "Production",
  SORTIE: "Sortie cuisine",
  AJUSTEMENT: "Ajustement",
};

/**
 * Un produit fait maison s'approvisionne par une production, un produit acheté
 * par un achat — jamais l'inverse. La règle vaut des deux côtés : le formulaire
 * n'offre que le type possible, et le serveur refuse l'autre.
 */
export function typesPossibles(faitMaison: boolean) {
  return TYPES_MOUVEMENT.filter((t) =>
    t.value === "ACHAT" ? !faitMaison : t.value === "PRODUCTION" ? faitMaison : true
  );
}

export function libelleType(type: StockMovementType) {
  return LIBELLE_TYPE[type];
}

export function uniteCourte(unit: StockUnit) {
  return UNITE_COURTE[unit];
}

/**
 * Les quantités sont décimales (0,5 kg) mais rarement longues : trois décimales
 * suffisent, et on ne montre pas « 3,000 kg » là où « 3 kg » se lit mieux.
 */
export function formatQuantite(value: number, unit: StockUnit) {
  const nombre = value.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
  return `${nombre} ${UNITE_COURTE[unit]}`;
}

/** Mouvement : le signe porte le sens de l'écriture (+ entrée, − sortie). */
export function formatQuantiteSignee(value: number, unit: StockUnit) {
  const signe = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${signe}${formatQuantite(Math.abs(value), unit)}`;
}

export type StatutStock = "rupture" | "sous_seuil" | "ok";

export type LigneStock = {
  id: string;
  name: string;
  unit: StockUnit;
  category: string;
  faitMaison: boolean;
  seuilAlerte: number;
  active: boolean;
  /** Solde courant, toutes dates confondues : un stock ne se filtre pas par période. */
  stock: number;
  statut: StatutStock;
  /** Coût moyen unitaire pondéré des achats (CMUP). */
  coutMoyen: number;
  valeur: number;
  entreesPeriode: number;
  sortiesPeriode: number;
  achatsPeriode: number;
  dernierMouvement: Date | null;
};

export type ProduitOption = {
  id: string;
  name: string;
  unit: StockUnit;
  category: string;
  faitMaison: boolean;
  stock: number;
};

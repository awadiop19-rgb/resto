import {
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  format,
  startOfMonth,
} from "date-fns";
import { fr } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import type { Periode } from "@/lib/periode";
import type { LigneStock, ProduitOption } from "@/lib/stock";
import type { StockUnit } from "@/generated/prisma/client";

/**
 * Au-delà de deux mois, une barre par jour devient illisible : on bascule au mois.
 * Même règle que la comptabilité, pour que les deux pages se lisent pareil.
 */
function buildBuckets(periode: Periode) {
  const jours = differenceInCalendarDays(periode.fin, periode.debut) + 1;
  const parMois = jours > 62;

  const dates = parMois
    ? eachMonthOfInterval({ start: periode.debut, end: periode.fin })
    : eachDayOfInterval({ start: periode.debut, end: periode.fin });

  const keyOf = (date: Date) =>
    parMois ? format(startOfMonth(date), "yyyy-MM") : format(date, "yyyy-MM-dd");

  const labelOf = (date: Date) =>
    parMois ? format(date, "MMM yy", { locale: fr }) : format(date, "dd/MM");

  return { keys: dates.map((d) => ({ key: keyOf(d), label: labelOf(d) })), keyOf };
}

export type StockData = Awaited<ReturnType<typeof getStock>>;

/**
 * Le stock est la somme de tous les mouvements depuis toujours ; seuls les flux
 * (achats, sorties) sont cadrés par la période affichée.
 */
export async function getStock(periode: Periode) {
  const intervalle = { gte: periode.debut, lte: periode.fin };
  const buckets = buildBuckets(periode);

  const [produits, soldes, achats, dernierParProduit, mouvementsPeriode] = await Promise.all([
    prisma.product.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.stockMovement.groupBy({ by: ["productId"], _sum: { quantity: true } }),
    // Le CMUP demande quantité × prix : un groupBy ne sait pas multiplier, on
    // ramène les seules colonnes nécessaires.
    prisma.stockMovement.findMany({
      where: { type: "ACHAT" },
      select: { productId: true, quantity: true, unitPrice: true },
    }),
    prisma.stockMovement.groupBy({ by: ["productId"], _max: { date: true } }),
    prisma.stockMovement.findMany({
      where: { date: intervalle },
      include: {
        product: { select: { id: true, name: true, unit: true, category: true } },
        user: { select: { name: true } },
        correctedBy: { select: { name: true } },
      },
      orderBy: { date: "desc" },
    }),
  ]);

  const soldeParProduit = new Map(soldes.map((s) => [s.productId, s._sum.quantity ?? 0]));
  const dateParProduit = new Map(dernierParProduit.map((d) => [d.productId, d._max.date]));

  const cumulAchats = new Map<string, { quantite: number; montant: number }>();
  for (const achat of achats) {
    const entry = cumulAchats.get(achat.productId) ?? { quantite: 0, montant: 0 };
    entry.quantite += achat.quantity;
    entry.montant += achat.quantity * (achat.unitPrice ?? 0);
    cumulAchats.set(achat.productId, entry);
  }

  const fluxPeriode = new Map<string, { entrees: number; sorties: number; achats: number }>();
  for (const m of mouvementsPeriode) {
    const entry = fluxPeriode.get(m.productId) ?? { entrees: 0, sorties: 0, achats: 0 };
    if (m.quantity >= 0) entry.entrees += m.quantity;
    else entry.sorties += -m.quantity;
    if (m.type === "ACHAT") entry.achats += m.quantity * (m.unitPrice ?? 0);
    fluxPeriode.set(m.productId, entry);
  }

  const lignes: LigneStock[] = produits.map((p) => {
    const stock = soldeParProduit.get(p.id) ?? 0;
    const cumul = cumulAchats.get(p.id);
    const coutMoyen = cumul && cumul.quantite > 0 ? cumul.montant / cumul.quantite : 0;
    const flux = fluxPeriode.get(p.id);

    return {
      id: p.id,
      name: p.name,
      unit: p.unit,
      category: p.category,
      seuilAlerte: p.seuilAlerte,
      active: p.active,
      stock,
      statut: stock <= 0 ? "rupture" : stock <= p.seuilAlerte ? "sous_seuil" : "ok",
      coutMoyen,
      valeur: stock > 0 ? stock * coutMoyen : 0,
      entreesPeriode: flux?.entrees ?? 0,
      sortiesPeriode: flux?.sorties ?? 0,
      achatsPeriode: flux?.achats ?? 0,
      dernierMouvement: dateParProduit.get(p.id) ?? null,
    };
  });

  const suivis = lignes.filter((l) => l.active);
  const valeurStock = lignes.reduce((s, l) => s + l.valeur, 0);
  const ruptures = suivis.filter((l) => l.statut === "rupture");
  const sousSeuil = suivis.filter((l) => l.statut === "sous_seuil");

  // ------------------------------------------------------------------- Flux

  const mouvements = mouvementsPeriode.map((m) => ({
    id: m.id,
    date: m.date,
    type: m.type,
    productId: m.productId,
    productName: m.product.name,
    unit: m.product.unit,
    category: m.product.category,
    quantity: m.quantity,
    unitPrice: m.unitPrice,
    montant: m.type === "ACHAT" ? m.quantity * (m.unitPrice ?? 0) : null,
    supplier: m.supplier,
    note: m.note,
    userName: m.user.name,
    lieeAUneDepense: m.expenseId != null,
    // Renseignée si la comptabilité a rectifié la saisie. La quantité d'origine
    // est le delta signé : c'est sa valeur absolue qui s'affiche.
    correction: m.correctedAt
      ? {
          quantiteOrigine: m.originalQuantity,
          prixOrigine: m.originalUnitPrice,
          motif: m.correctionNote,
          auteur: m.correctedBy?.name ?? null,
          date: m.correctedAt,
        }
      : null,
  }));

  const achatsPeriode = mouvements
    .filter((m) => m.type === "ACHAT")
    .reduce((s, m) => s + (m.montant ?? 0), 0);

  // Les sorties sont valorisées au coût moyen : c'est ce que la cuisine a
  // effectivement consommé, indépendamment du prix du dernier réassort.
  const coutMoyenParProduit = new Map(lignes.map((l) => [l.id, l.coutMoyen]));
  const sortiesPeriode = mouvements
    .filter((m) => m.type === "SORTIE")
    .reduce((s, m) => s + -m.quantity * (coutMoyenParProduit.get(m.productId) ?? 0), 0);

  const fluxParJourMap = new Map<string, { achats: number; sorties: number }>();
  for (const m of mouvements) {
    const key = buckets.keyOf(m.date);
    const entry = fluxParJourMap.get(key) ?? { achats: 0, sorties: 0 };
    if (m.type === "ACHAT") entry.achats += m.montant ?? 0;
    if (m.type === "SORTIE") {
      entry.sorties += -m.quantity * (coutMoyenParProduit.get(m.productId) ?? 0);
    }
    fluxParJourMap.set(key, entry);
  }
  const fluxParJour = buckets.keys.map(({ key, label }) => ({
    label,
    achats: Math.round(fluxParJourMap.get(key)?.achats ?? 0),
    sorties: Math.round(fluxParJourMap.get(key)?.sorties ?? 0),
  }));

  const valeurParCategorieMap = new Map<string, number>();
  for (const l of lignes) {
    valeurParCategorieMap.set(l.category, (valeurParCategorieMap.get(l.category) ?? 0) + l.valeur);
  }
  const valeurParCategorie = Array.from(valeurParCategorieMap.entries())
    .map(([categorie, valeur]) => ({ categorie, valeur: Math.round(valeur) }))
    .filter((c) => c.valeur > 0)
    .sort((a, b) => b.valeur - a.valeur);

  const valeurParProduit = lignes
    .filter((l) => l.valeur > 0)
    .map((l) => ({ name: l.name, valeur: Math.round(l.valeur) }))
    .sort((a, b) => b.valeur - a.valeur)
    .slice(0, 12);

  const consommationParProduit = Array.from(
    mouvements
      .filter((m) => m.type === "SORTIE")
      .reduce((acc, m) => {
        const entry = acc.get(m.productId) ?? {
          name: m.productName,
          unit: m.unit,
          quantite: 0,
          valeur: 0,
        };
        entry.quantite += -m.quantity;
        entry.valeur += -m.quantity * (coutMoyenParProduit.get(m.productId) ?? 0);
        acc.set(m.productId, entry);
        return acc;
      }, new Map<string, { name: string; unit: StockUnit; quantite: number; valeur: number }>())
      .values()
  )
    .map((c) => ({ ...c, valeur: Math.round(c.valeur) }))
    .sort((a, b) => b.valeur - a.valeur);

  const options: ProduitOption[] = lignes
    .filter((l) => l.active)
    .map((l) => ({ id: l.id, name: l.name, unit: l.unit, category: l.category, stock: l.stock }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return {
    periodeLabel: periode.label,
    lignes,
    options,
    valeurStock: Math.round(valeurStock),
    produitsSuivis: suivis.length,
    ruptures,
    sousSeuil,
    mouvements,
    achatsPeriode: Math.round(achatsPeriode),
    sortiesPeriode: Math.round(sortiesPeriode),
    fluxParJour,
    valeurParCategorie,
    valeurParProduit,
    consommationParProduit,
  };
}

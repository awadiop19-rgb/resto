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

/**
 * Au-delà de deux mois, une barre par jour devient illisible : on bascule au mois.
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

  return {
    keys: dates.map((d) => ({ key: keyOf(d), label: labelOf(d) })),
    keyOf,
  };
}

export type VersementRow = {
  id: string;
  cashierName: string;
  closedAt: Date | null;
  openingFloat: number;
  totalCash: number;
  totalWave: number;
  expectedCash: number | null;
  declaredAmount: number;
  /** Montant retenu par la comptabilité : la correction prime sur la déclaration. */
  retenu: number;
  /** Espèces sorties du tiroir pour des dépenses courantes pendant le service. */
  sortiesCaisse: number;
  /** Espèces issues des ventes : le fond de caisse est ressorti puis rentré, il ne crée pas de recette. */
  net: number;
  difference: number | null;
  corrected: boolean;
  note: string | null;
};

export type ComptabiliteData = Awaited<ReturnType<typeof getComptabilite>>;

export async function getComptabilite(periode: Periode) {
  const intervalle = { gte: periode.debut, lte: periode.fin };
  const buckets = buildBuckets(periode);

  const [closedRegisters, payments, expenses, openRegistersCount] = await Promise.all([
    prisma.cashRegister.findMany({
      where: { status: "FERMEE", closedAt: intervalle },
      include: {
        cashier: { select: { id: true, name: true } },
        expenses: { select: { amount: true } },
      },
      orderBy: { closedAt: "desc" },
    }),
    prisma.payment.findMany({
      where: { createdAt: intervalle },
      include: {
        cashier: { select: { id: true, name: true } },
        order: {
          include: {
            items: { include: { menuItem: { include: { category: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.expense.findMany({
      where: { date: intervalle },
      include: { user: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.cashRegister.count({ where: { status: "OUVERTE" } }),
  ]);

  // ---------------------------------------------------------------- Versements

  const versements: VersementRow[] = closedRegisters.map((cr) => {
    const retenu = cr.correctedAmount ?? cr.declaredAmount ?? 0;
    const sortiesCaisse = cr.expenses.reduce((s, e) => s + e.amount, 0);
    return {
      id: cr.id,
      cashierName: cr.cashier.name,
      closedAt: cr.closedAt,
      openingFloat: cr.openingFloat,
      totalCash: cr.totalCash ?? 0,
      totalWave: cr.totalWave ?? 0,
      expectedCash: cr.expectedCash,
      declaredAmount: cr.declaredAmount ?? 0,
      retenu,
      sortiesCaisse,
      // Ce qui est sorti du tiroir pour une dépense est déjà compté en dépenses.
      // Ne pas le réintégrer ici l'amputerait une seconde fois de la recette.
      net: retenu - cr.openingFloat + sortiesCaisse,
      difference: cr.difference,
      corrected: cr.correctedAmount != null,
      note: cr.note,
    };
  });

  const especesVersees = versements.reduce((s, v) => s + v.net, 0);
  const waveEncaisse = versements.reduce((s, v) => s + v.totalWave, 0);
  const fondsRestitues = versements.reduce((s, v) => s + v.openingFloat, 0);
  const totalEcarts = versements.reduce((s, v) => s + (v.difference ?? 0), 0);
  const versementsAvecEcart = versements.filter((v) => (v.difference ?? 0) !== 0).length;
  const recettes = especesVersees + waveEncaisse;

  const versementsParJourMap = new Map<string, { especes: number; wave: number }>();
  for (const v of versements) {
    if (!v.closedAt) continue;
    const key = buckets.keyOf(v.closedAt);
    const entry = versementsParJourMap.get(key) ?? { especes: 0, wave: 0 };
    entry.especes += v.net;
    entry.wave += v.totalWave;
    versementsParJourMap.set(key, entry);
  }
  const versementsParJour = buckets.keys.map(({ key, label }) => ({
    label,
    especes: versementsParJourMap.get(key)?.especes ?? 0,
    wave: versementsParJourMap.get(key)?.wave ?? 0,
  }));

  // -------------------------------------------------------------------- Ventes

  const ventesEspeces = payments
    .filter((p) => p.method === "CASH")
    .reduce((s, p) => s + p.amount, 0);
  const ventesWave = payments.filter((p) => p.method === "WAVE").reduce((s, p) => s + p.amount, 0);
  const chiffreAffaires = ventesEspeces + ventesWave;
  const ticketMoyen = payments.length > 0 ? chiffreAffaires / payments.length : 0;

  const ventesParJourMap = new Map<string, number>();
  for (const p of payments) {
    const key = buckets.keyOf(p.createdAt);
    ventesParJourMap.set(key, (ventesParJourMap.get(key) ?? 0) + p.amount);
  }
  const ventesParJour = buckets.keys.map(({ key, label }) => ({
    label,
    total: ventesParJourMap.get(key) ?? 0,
  }));

  const platsMap = new Map<string, { name: string; quantite: number; total: number }>();
  const categoriesMap = new Map<string, number>();
  for (const p of payments) {
    for (const item of p.order.items) {
      const ligne = item.unitPrice * item.quantity;
      const plat = platsMap.get(item.menuItemId) ?? {
        name: item.menuItem.name,
        quantite: 0,
        total: 0,
      };
      plat.quantite += item.quantity;
      plat.total += ligne;
      platsMap.set(item.menuItemId, plat);

      const categorie = item.menuItem.category.name;
      categoriesMap.set(categorie, (categoriesMap.get(categorie) ?? 0) + ligne);
    }
  }

  const platsVendus = Array.from(platsMap.values()).sort((a, b) => b.total - a.total);
  const ventesParCategorie = Array.from(categoriesMap.entries())
    .map(([categorie, total]) => ({ categorie, total }))
    .sort((a, b) => b.total - a.total);

  const parCaissierMap = new Map<
    string,
    {
      cashierId: string;
      cashierName: string;
      commandes: number;
      especes: number;
      wave: number;
      versementsCount: number;
      netVerse: number;
      ecarts: number;
    }
  >();
  const entryFor = (id: string, name: string) => {
    const existing = parCaissierMap.get(id);
    if (existing) return existing;
    const created = {
      cashierId: id,
      cashierName: name,
      commandes: 0,
      especes: 0,
      wave: 0,
      versementsCount: 0,
      netVerse: 0,
      ecarts: 0,
    };
    parCaissierMap.set(id, created);
    return created;
  };

  for (const p of payments) {
    const entry = entryFor(p.cashierId, p.cashier.name);
    entry.commandes += 1;
    if (p.method === "CASH") entry.especes += p.amount;
    else entry.wave += p.amount;
  }
  for (const cr of closedRegisters) {
    const entry = entryFor(cr.cashierId, cr.cashier.name);
    entry.versementsCount += 1;
    entry.netVerse +=
      (cr.correctedAmount ?? cr.declaredAmount ?? 0) -
      cr.openingFloat +
      cr.expenses.reduce((s, e) => s + e.amount, 0);
    entry.ecarts += cr.difference ?? 0;
  }
  const parCaissier = Array.from(parCaissierMap.values())
    .map((c) => ({ ...c, totalVentes: c.especes + c.wave }))
    .sort((a, b) => b.totalVentes - a.totalVentes);

  // ------------------------------------------------------------------ Dépenses

  const totalDepenses = expenses.reduce((s, e) => s + e.amount, 0);
  const depenseMoyenne = expenses.length > 0 ? totalDepenses / expenses.length : 0;

  const depensesParCategorieMap = new Map<string, { total: number; count: number }>();
  for (const e of expenses) {
    const entry = depensesParCategorieMap.get(e.category) ?? { total: 0, count: 0 };
    entry.total += e.amount;
    entry.count += 1;
    depensesParCategorieMap.set(e.category, entry);
  }
  const depensesParCategorie = Array.from(depensesParCategorieMap.entries())
    .map(([categorie, v]) => ({ categorie, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total);

  const depensesParJourMap = new Map<string, number>();
  for (const e of expenses) {
    const key = buckets.keyOf(e.date);
    depensesParJourMap.set(key, (depensesParJourMap.get(key) ?? 0) + e.amount);
  }
  const depensesParJour = buckets.keys.map(({ key, label }) => ({
    label,
    total: depensesParJourMap.get(key) ?? 0,
  }));

  const depenses = expenses.map((e) => ({
    id: e.id,
    label: e.label,
    category: e.category,
    date: e.date,
    amount: e.amount,
    userName: e.user.name,
  }));

  return {
    periodeLabel: periode.label,
    // Synthèse
    recettes,
    totalDepenses,
    resultat: recettes - totalDepenses,
    // Versements
    versements,
    especesVersees,
    waveEncaisse,
    fondsRestitues,
    totalEcarts,
    versementsAvecEcart,
    versementsParJour,
    caissesOuvertes: openRegistersCount,
    // Ventes
    chiffreAffaires,
    // Argent rendu sur la période pour des commandes annulées après
    // encaissement. Le chiffre d'affaires reste brut : le remboursement est déjà
    // compté en dépense, et l'ôter aussi de la recette le retrancherait deux
    // fois du résultat. Il est dit à côté, pour qu'un chiffre d'affaires ne
    // paraisse pas entièrement gardé.
    totalRembourse: expenses
      .filter((e) => e.refundedOrderId != null)
      .reduce((s, e) => s + e.amount, 0),
    ventesEspeces,
    ventesWave,
    commandesEncaissees: payments.length,
    ticketMoyen,
    ventesParJour,
    platsVendus,
    ventesParCategorie,
    parCaissier,
    // Dépenses
    depenses,
    depenseMoyenne,
    depensesParCategorie,
    depensesParJour,
  };
}

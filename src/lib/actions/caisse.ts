"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { blocageCaisse } from "@/lib/journee-caisse";
import { premierMessage, refus } from "@/lib/actions/resultat";
import { refusCloture } from "@/lib/cloture-caisse";
import { especesDisponibles, estCategorieDeCaisse } from "@/lib/depenses-caisse";
import { totalCommande } from "@/lib/total-commande";

async function requireCashier() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "CAISSIER" && session.user.role !== "ADMIN")) {
    throw new Error("Non autorisé");
  }
  return session;
}

async function requireAdminOrComptabilite() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "COMPTABILITE")) {
    throw new Error("Non autorisé");
  }
  return session;
}

export async function openCashRegister(openingFloat: number) {
  const session = await requireCashier();

  const blocage = await blocageCaisse(session.user.id, session.user.role);
  if (blocage) return refus(blocage);

  const existing = await prisma.cashRegister.findFirst({
    where: { cashierId: session.user.id, status: "OUVERTE" },
  });
  if (existing) return refus("Une caisse est déjà ouverte");

  await prisma.cashRegister.create({
    data: {
      cashierId: session.user.id,
      openingFloat: Number.isFinite(openingFloat) && openingFloat > 0 ? openingFloat : 0,
    },
  });

  revalidatePath("/caisse");
}

const payOrderSchema = z.object({
  orderId: z.string(),
  method: z.enum(["CASH", "WAVE"]),
});

export async function payOrder(input: z.infer<typeof payOrderSchema>) {
  const session = await requireCashier();

  const blocage = await blocageCaisse(session.user.id, session.user.role);
  if (blocage) return refus(blocage);

  const parsed = payOrderSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const data = parsed.data;

  const cashRegister = await prisma.cashRegister.findFirst({
    where: { cashierId: session.user.id, status: "OUVERTE" },
  });
  if (!cashRegister) return refus("Ouvrez votre caisse avant d'encaisser un paiement");

  const order = await prisma.order.findUnique({
    where: { id: data.orderId },
    include: { items: true, payment: true },
  });
  if (!order) return refus("Commande introuvable");
  if (order.status === "ANNULEE") return refus("Impossible d'encaisser une commande annulée");
  if (order.payment) return refus("Cette commande a déjà été payée");

  // Le client règle les articles et, pour une livraison, les frais de la zone.
  const amount = totalCommande(order.items, order.deliveryFee);
  if (amount <= 0) return refus("Le montant de la commande est invalide");

  await prisma.payment.create({
    data: {
      orderId: order.id,
      amount,
      method: data.method,
      cashierId: session.user.id,
      cashRegisterId: cashRegister.id,
    },
  });

  revalidatePath("/caisse");
  revalidatePath("/commandes");
}

const closeCashRegisterSchema = z.object({
  // Espèces comptées dans le tiroir à la fermeture, fond de caisse inclus.
  declaredAmount: z.number().min(0, "Montant invalide"),
  note: z.string().optional(),
});

export async function closeCashRegister(input: z.infer<typeof closeCashRegisterSchema>) {
  const session = await requireCashier();

  const parsed = closeCashRegisterSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const data = parsed.data;

  const cashRegister = await prisma.cashRegister.findFirst({
    where: { cashierId: session.user.id, status: "OUVERTE" },
  });
  if (!cashRegister) return refus("Aucune caisse ouverte");

  const payments = await prisma.payment.findMany({ where: { cashRegisterId: cashRegister.id } });
  const totalCash = payments.filter((p) => p.method === "CASH").reduce((sum, p) => sum + p.amount, 0);
  const totalWave = payments.filter((p) => p.method === "WAVE").reduce((sum, p) => sum + p.amount, 0);

  // Le tiroir est versé en entier : les espèces attendues incluent le fond de
  // caisse, et déduisent ce qui en est sorti pour régler une dépense courante.
  // Sans cette déduction, chaque dépense apparaîtrait comme un manquant.
  const sorties = await sortiesEspeces(cashRegister.id);
  const expectedCash = cashRegister.openingFloat + totalCash - sorties;
  const difference = data.declaredAmount - expectedCash;

  const note = data.note?.trim() ? data.note.trim() : null;
  // Le formulaire pose déjà ces contrôles, mais un versement est définitif :
  // c'est ici qu'ils tiennent.
  const motifRefus = refusCloture(
    {
      declaredAmount: data.declaredAmount,
      openingFloat: cashRegister.openingFloat,
      totalCash,
      totalWave,
      sorties,
    },
    note,
  );
  if (motifRefus) return refus(motifRefus);

  await prisma.cashRegister.update({
    where: { id: cashRegister.id },
    data: {
      status: "FERMEE",
      closedAt: new Date(),
      totalCash,
      totalWave,
      declaredAmount: data.declaredAmount,
      expectedCash,
      difference,
      note,
    },
  });

  revalidatePath("/caisse");
  revalidatePath("/caisse/versements");
  revalidatePath("/comptabilite");
}

const depenseCaisseSchema = z.object({
  categorie: z.string().refine(estCategorieDeCaisse, "Type de dépense inconnu"),
  commentaire: z.string().trim().min(1, "Indiquez à quoi correspond la dépense").max(200),
  montant: z.number().positive("Le montant doit être positif"),
});

/** Espèces sorties du tiroir d'une caisse depuis son ouverture. */
async function sortiesEspeces(cashRegisterId: string) {
  const { _sum } = await prisma.expense.aggregate({
    where: { cashRegisterId },
    _sum: { amount: true },
  });
  return _sum.amount ?? 0;
}

/**
 * Dépense courante réglée en espèces par le caissier depuis son tiroir.
 *
 * Enregistrée comme une dépense ordinaire — elle entre donc telle quelle dans le
 * résultat comptable — mais rattachée à la caisse, ce qui retire la somme des
 * espèces attendues à la clôture. Sans ce rattachement, chaque dépense créerait
 * un manquant de caisse à justifier le soir.
 */
export async function enregistrerDepenseCaisse(input: z.infer<typeof depenseCaisseSchema>) {
  const session = await requireCashier();

  const blocage = await blocageCaisse(session.user.id, session.user.role);
  if (blocage) return refus(blocage);

  const parsed = depenseCaisseSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const data = parsed.data;

  const cashRegister = await prisma.cashRegister.findFirst({
    where: { cashierId: session.user.id, status: "OUVERTE" },
    include: { payments: { select: { amount: true, method: true } } },
  });
  if (!cashRegister) return refus("Ouvrez votre caisse avant d'enregistrer une dépense");

  const totalCash = cashRegister.payments
    .filter((p) => p.method === "CASH")
    .reduce((s, p) => s + p.amount, 0);
  const disponible = especesDisponibles({
    openingFloat: cashRegister.openingFloat,
    totalCash,
    sorties: await sortiesEspeces(cashRegister.id),
  });

  // On ne sort pas du tiroir plus qu'il ne contient : la dépense serait payée
  // avec de l'argent qui n'existe pas, et la caisse close sur un écart inventé.
  if (data.montant > disponible) {
    return refus(
      `Le tiroir ne contient que ${disponible.toLocaleString("fr-FR")} F. Impossible d'en sortir ${data.montant.toLocaleString("fr-FR")} F.`
    );
  }

  await prisma.expense.create({
    data: {
      label: data.commentaire,
      amount: data.montant,
      category: data.categorie,
      date: new Date(),
      userId: session.user.id,
      cashRegisterId: cashRegister.id,
      // Un tiroir ne contient que des espèces : le mode ne se demande pas au
      // caissier, il découle de l'endroit d'où sort l'argent.
      method: "CASH",
    },
  });

  revalidatePath("/caisse");
  revalidatePath("/depenses");
  revalidatePath("/comptabilite");
  revalidatePath("/comptabilite/journee");
  revalidatePath("/comptabilite/mois");
}

/**
 * Retrait d'une dépense mal saisie, tant que la caisse n'est pas versée.
 * Après clôture, les espèces attendues ont été figées avec : la retirer
 * fabriquerait un excédent sur un versement déjà remis.
 */
export async function supprimerDepenseCaisse(id: string) {
  const session = await requireCashier();

  const depense = await prisma.expense.findUnique({
    where: { id },
    include: { cashRegister: { select: { id: true, status: true, cashierId: true } } },
  });
  if (!depense || !depense.cashRegister) return refus("Dépense introuvable");
  if (depense.cashRegister.cashierId !== session.user.id) {
    return refus("Cette dépense a été enregistrée par un autre caissier");
  }
  if (depense.cashRegister.status !== "OUVERTE") {
    return refus("Cette caisse est déjà versée : la dépense ne peut plus être retirée");
  }

  await prisma.expense.delete({ where: { id } });

  revalidatePath("/caisse");
  revalidatePath("/depenses");
  revalidatePath("/comptabilite");
  revalidatePath("/comptabilite/journee");
  revalidatePath("/comptabilite/mois");
}

const corrigerModePaiementSchema = z.object({
  paymentId: z.string(),
  method: z.enum(["CASH", "WAVE"]),
  note: z.string().trim().min(1, "Indiquez la raison de la correction").max(200),
});

/**
 * Corrige le mode d'un encaissement quand le caissier s'est trompé de touche.
 *
 * Limité aux caisses encore ouvertes. À la clôture, `totalCash`, `expectedCash`
 * et `difference` sont figés à partir des paiements du moment : les rouvrir ici
 * réécrirait un versement déjà remis à la comptabilité, qui dispose pour cela de
 * `correctCashRegister`.
 *
 * Le montant ne bouge pas — seul change le mode par lequel il est entré. C'est
 * la répartition espèces/Wave, et donc les espèces attendues en tiroir, qui s'en
 * trouvent rétablies.
 */
export async function corrigerModePaiement(input: z.infer<typeof corrigerModePaiementSchema>) {
  const session = await requireAdminOrComptabilite();

  const parsed = corrigerModePaiementSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const data = parsed.data;

  const paiement = await prisma.payment.findUnique({
    where: { id: data.paymentId },
    include: { cashRegister: { select: { status: true } } },
  });
  if (!paiement) return refus("Encaissement introuvable");
  if (paiement.cashRegister.status !== "OUVERTE") {
    return refus(
      "Cette caisse est déjà clôturée : son versement fait foi. Passez par une correction de versement."
    );
  }
  if (paiement.method === data.method) return refus("Ce mode de paiement est déjà celui enregistré");

  await prisma.payment.update({
    where: { id: paiement.id },
    data: {
      method: data.method,
      // Le mode d'origine ne se renseigne qu'une fois : un aller-retour
      // Espèces → Wave → Espèces effacerait sinon la trace de la saisie initiale.
      originalMethod: paiement.originalMethod ?? paiement.method,
      methodCorrectionNote: data.note,
      methodCorrectedById: session.user.id,
      methodCorrectedAt: new Date(),
    },
  });

  revalidatePath("/comptabilite/journee");
  revalidatePath("/comptabilite");
  revalidatePath("/caisse");
}

const correctCashRegisterSchema = z.object({
  id: z.string(),
  correctedAmount: z.number().min(0, "Montant invalide"),
  correctionNote: z.string().min(1, "Veuillez indiquer la raison de la correction"),
});

export async function correctCashRegister(input: z.infer<typeof correctCashRegisterSchema>) {
  const session = await requireAdminOrComptabilite();

  const parsed = correctCashRegisterSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const data = parsed.data;

  const cashRegister = await prisma.cashRegister.findUnique({ where: { id: data.id } });
  if (!cashRegister) return refus("Versement introuvable");
  if (cashRegister.status !== "FERMEE") return refus("Seul un versement clôturé peut être corrigé");

  await prisma.cashRegister.update({
    where: { id: data.id },
    data: {
      correctedAmount: data.correctedAmount,
      correctionNote: data.correctionNote,
      correctedById: session.user.id,
      correctedAt: new Date(),
    },
  });

  revalidatePath("/caisse/versements");
  revalidatePath("/comptabilite");
}

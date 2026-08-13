"use server";

import { endOfDay, startOfDay } from "date-fns";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { premierMessage, refus } from "@/lib/actions/resultat";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const expenseSchema = z.object({
  label: z.string().min(1, "Libellé requis"),
  amount: z.number().positive("Le montant doit être positif"),
  category: z.string().min(1, "Catégorie requise"),
  date: z.string().min(1, "Date requise"),
  /**
   * Avec quoi la dépense a été réglée. Exigé à la saisie, alors que la colonne
   * accepte le nul : ce nul est réservé à l'historique d'avant la question. Une
   * nouvelle dépense sans règlement rouvrirait la zone d'ombre qu'on referme.
   */
  method: z.enum(["CASH", "WAVE"], { message: "Mode de règlement requis" }),
  /** Le comptable a vu l'avertissement de doublon et maintient la saisie. */
  confirme: z.boolean().optional(),
});

/**
 * Un achat de stock du même jour qui ressemble à la dépense saisie. Ce n'est pas
 * un refus — deux achats identiques le même jour arrivent — mais une question
 * posée avant d'enregistrer.
 */
export type DoublonPresume = {
  doublonAvec: string;
  montant: number;
  /** Ce qui a déclenché l'alerte, pour que l'écran dise vrai : deux achats sans
   *  rapport peuvent partager un montant, et l'avertissement doit l'assumer. */
  motif: "produit" | "montant";
};

/**
 * Enregistrer un achat de stock crée déjà sa dépense. Ressaisir le même achat à
 * la main double la charge sans que rien ne le signale : le mois se met à coûter
 * deux fois le panier du marché. On cherche donc, avant d'écrire, un achat de
 * stock du même jour de même montant ou portant le même produit.
 */
async function achatDeStockJumeau(data: z.infer<typeof expenseSchema>) {
  const jour = new Date(data.date);
  return prisma.expense.findFirst({
    where: {
      date: { gte: startOfDay(jour), lte: endOfDay(jour) },
      stockMovement: { isNot: null },
      OR: [{ amount: data.amount }, { label: { contains: data.label.trim() } }],
    },
    select: { label: true, amount: true },
  });
}

export async function createExpense(input: z.infer<typeof expenseSchema>) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "COMPTABILITE")) {
    throw new Error("Non autorisé");
  }

  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const data = parsed.data;

  if (!data.confirme) {
    const jumeau = await achatDeStockJumeau(data);
    if (jumeau) {
      const parProduit = jumeau.label.toLowerCase().includes(data.label.trim().toLowerCase());
      return {
        doublonAvec: jumeau.label,
        montant: jumeau.amount,
        motif: parProduit ? "produit" : "montant",
      } satisfies DoublonPresume;
    }
  }

  await prisma.expense.create({
    data: {
      label: data.label,
      amount: data.amount,
      category: data.category,
      date: new Date(data.date),
      method: data.method,
      userId: session.user.id,
    },
  });

  revalider();
}

/** Les écrans où une dépense change le tableau : le résultat comme les poches. */
function revalider() {
  revalidatePath("/depenses");
  revalidatePath("/dashboard");
  revalidatePath("/comptabilite");
  revalidatePath("/comptabilite/caisse");
  revalidatePath("/comptabilite/mois");
}

/**
 * Rattacher une dépense à la poche qui l'a réglée.
 *
 * Sert d'abord à renseigner l'historique : les dépenses antérieures à cette
 * colonne sont portées par le coffre faute de savoir, et celles qui étaient en
 * fait des Wave l'ont creusé à tort. C'est ici qu'on les remet à leur place.
 *
 * Une dépense sortie d'un tiroir de caissier n'est pas concernée : un tiroir ne
 * contient que des espèces, et la dire Wave contredirait le versement du soir,
 * déjà compté sur ce que le tiroir avait en moins.
 */
export async function setExpenseMethod(id: string, method: "CASH" | "WAVE") {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "COMPTABILITE")) {
    throw new Error("Non autorisé");
  }

  const depense = await prisma.expense.findUnique({
    where: { id },
    select: { cashRegisterId: true, refundedOrderId: true },
  });
  if (!depense) return refus("Cette dépense n'existe plus.");
  // Un remboursement rend l'argent par où il est entré. Le dire réglé autrement
  // ferait sortir d'une poche ce qu'une autre a encaissé, et les deux seraient
  // fausses en sens inverse.
  if (depense.refundedOrderId) {
    return refus(
      "Ce remboursement suit le mode de l'encaissement qu'il défait : il ne se change pas."
    );
  }
  if (depense.cashRegisterId) {
    return refus(
      "Cette dépense a été réglée depuis le tiroir d'un caissier : elle est en espèces par nature."
    );
  }

  await prisma.expense.update({ where: { id }, data: { method } });
  revalider();
}

export async function deleteExpense(id: string) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "COMPTABILITE")) {
    throw new Error("Non autorisé");
  }

  // Un remboursement appartient à la commande qu'il défait : le supprimer
  // laisserait une commande annulée dont l'argent serait rendu nulle part, et la
  // trace de ce qui est sorti disparaîtrait avec la seule pièce qui l'expliquait.
  const remboursement = await prisma.expense.findFirst({
    where: { id, refundedOrderId: { not: null } },
  });
  if (remboursement) {
    return refus(
      "Cette dépense est le remboursement d'une commande annulée : elle ne se supprime pas à part."
    );
  }

  // Une dépense née d'un achat de stock appartient à son mouvement : la
  // supprimer seule laisserait l'entrée en stock sans charge en face.
  const liee = await prisma.stockMovement.findFirst({ where: { expenseId: id } });
  if (liee) {
    return refus(
      "Cette dépense provient d'un achat de stock. Supprimez le mouvement depuis la page Stock."
    );
  }

  // Une dépense réglée depuis un tiroir déjà versé a été déduite des espèces
  // attendues à la clôture : la retirer fabriquerait un excédent de caisse sur
  // un versement pourtant remis et vérifié.
  const surCaisseFermee = await prisma.expense.findFirst({
    where: { id, cashRegister: { status: "FERMEE" } },
  });
  if (surCaisseFermee) {
    return refus(
      "Cette dépense a été réglée depuis une caisse déjà versée. La supprimer fausserait le versement."
    );
  }

  await prisma.expense.delete({ where: { id } });
  revalider();
}

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
      userId: session.user.id,
    },
  });

  revalidatePath("/depenses");
  revalidatePath("/dashboard");
}

export async function deleteExpense(id: string) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "COMPTABILITE")) {
    throw new Error("Non autorisé");
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
  revalidatePath("/depenses");
  revalidatePath("/dashboard");
}

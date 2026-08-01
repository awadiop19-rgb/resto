"use server";

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
});

export async function createExpense(input: z.infer<typeof expenseSchema>) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "COMPTABILITE")) {
    throw new Error("Non autorisé");
  }

  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const data = parsed.data;

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

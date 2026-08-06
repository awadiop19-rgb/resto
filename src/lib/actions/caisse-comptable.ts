"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { premierMessage, refus } from "@/lib/actions/resultat";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const comptageSchema = z.object({
  /** Jour du comptage, en `YYYY-MM-DD` : l'état du coffre au matin de ce jour. */
  date: z.string().min(1, "Date requise"),
  amount: z.number().min(0, "Le montant compté ne peut pas être négatif"),
  note: z.string().optional(),
});

/**
 * Enregistre ce que contient réellement le coffre à une date donnée.
 *
 * C'est le seul point d'entrée d'un montant dans la caisse comptable qui ne
 * vienne pas d'un versement : un démarrage, un report de l'exercice précédent,
 * ou un recomptage qui rattrape une dérive. À partir de là, le disponible se
 * recalcule tout seul.
 */
export async function enregistrerComptageCaisse(input: z.infer<typeof comptageSchema>) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "COMPTABILITE")) {
    throw new Error("Non autorisé");
  }

  const parsed = comptageSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const { date, amount, note } = parsed.data;

  const countedAt = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(countedAt.getTime())) return refus("Date invalide");

  // Un comptage daté en avant afficherait un disponible qui ne s'appuie sur
  // rien : les versements et les dépenses censés le suivre n'existent pas
  // encore, et le coffre paraîtrait figé jusqu'à ce que la date soit atteinte.
  if (countedAt.getTime() > Date.now()) {
    return refus("Un comptage ne peut pas être daté dans le futur");
  }

  await prisma.cashCount.create({
    data: {
      countedAt,
      amount,
      note: note?.trim() || null,
      userId: session.user.id,
    },
  });

  revalidatePath("/comptabilite/caisse");
  revalidatePath("/comptabilite");
}

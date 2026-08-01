"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { premierMessage, refus } from "@/lib/actions/resultat";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") throw new Error("Non autorisé");
  return session;
}

const menuItemSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  description: z.string().optional(),
  price: z.number().positive("Le prix doit être positif"),
  categoryId: z.string().min(1, "Catégorie requise"),
  available: z.boolean().default(true),
});

export async function createMenuItem(input: z.infer<typeof menuItemSchema>) {
  await requireAdmin();
  const parsed = menuItemSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const data = parsed.data;
  await prisma.menuItem.create({ data });
  revalidatePath("/menu");
}

export async function updateMenuItem(id: string, input: z.infer<typeof menuItemSchema>) {
  await requireAdmin();
  const parsed = menuItemSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const data = parsed.data;
  await prisma.menuItem.update({ where: { id }, data });
  revalidatePath("/menu");
}

export async function deleteMenuItem(id: string) {
  await requireAdmin();

  // Un plat déjà commandé est référencé par l'historique : le supprimer
  // effacerait des lignes de commandes encaissées.
  const commandes = await prisma.orderItem.count({ where: { menuItemId: id } });
  if (commandes > 0) {
    return refus(
      `Ce plat figure dans ${commandes} commande(s). Rendez-le indisponible plutôt que de le supprimer.`
    );
  }

  await prisma.menuItem.delete({ where: { id } });
  revalidatePath("/menu");
}

export async function toggleAvailability(id: string, available: boolean) {
  await requireAdmin();
  await prisma.menuItem.update({ where: { id }, data: { available } });
  revalidatePath("/menu");
}

export async function createCategory(name: string) {
  await requireAdmin();
  if (!name.trim()) return refus("Nom de catégorie requis");
  await prisma.menuCategory.create({ data: { name: name.trim() } });
  revalidatePath("/menu");
}

export async function deleteCategory(id: string) {
  await requireAdmin();

  const plats = await prisma.menuItem.count({ where: { categoryId: id } });
  if (plats > 0) {
    return refus(`Cette catégorie contient ${plats} plat(s). Videz-la avant de la supprimer.`);
  }

  await prisma.menuCategory.delete({ where: { id } });
  revalidatePath("/menu");
}

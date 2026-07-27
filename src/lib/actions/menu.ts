"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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
  const data = menuItemSchema.parse(input);
  await prisma.menuItem.create({ data });
  revalidatePath("/menu");
}

export async function updateMenuItem(id: string, input: z.infer<typeof menuItemSchema>) {
  await requireAdmin();
  const data = menuItemSchema.parse(input);
  await prisma.menuItem.update({ where: { id }, data });
  revalidatePath("/menu");
}

export async function deleteMenuItem(id: string) {
  await requireAdmin();
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
  if (!name.trim()) throw new Error("Nom de catégorie requis");
  await prisma.menuCategory.create({ data: { name: name.trim() } });
  revalidatePath("/menu");
}

export async function deleteCategory(id: string) {
  await requireAdmin();
  await prisma.menuCategory.delete({ where: { id } });
  revalidatePath("/menu");
}

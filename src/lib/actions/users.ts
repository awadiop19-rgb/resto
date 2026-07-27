"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Role } from "@/generated/prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") throw new Error("Non autorisé");
  return session;
}

// Empêche de désactiver ou de rétrograder le dernier administrateur actif restant,
// ce qui laisserait l'application sans compte capable de la gérer.
async function assertNotLastActiveAdmin(id: string) {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new Error("Utilisateur introuvable");
  if (target.role === "ADMIN" && target.active) {
    const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", active: true } });
    if (activeAdmins <= 1) {
      throw new Error("Impossible : il doit rester au moins un administrateur actif");
    }
  }
}

const createUserSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "6 caractères minimum"),
  role: z.enum(["ADMIN", "SERVEUR", "CUISINE", "CAISSIER"]),
});

export async function createUser(input: z.infer<typeof createUserSchema>) {
  await requireAdmin();
  const data = createUserSchema.parse(input);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new Error("Cet email est déjà utilisé");

  const hashed = await bcrypt.hash(data.password, 10);
  await prisma.user.create({
    data: { name: data.name, email: data.email, password: hashed, role: data.role },
  });

  revalidatePath("/utilisateurs");
}

const updateUserSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide"),
});

export async function updateUser(input: z.infer<typeof updateUserSchema>) {
  await requireAdmin();
  const data = updateUserSchema.parse(input);

  const existing = await prisma.user.findFirst({
    where: { email: data.email, NOT: { id: data.id } },
  });
  if (existing) throw new Error("Cet email est déjà utilisé");

  await prisma.user.update({ where: { id: data.id }, data: { name: data.name, email: data.email } });
  revalidatePath("/utilisateurs");
}

export async function updateUserRole(id: string, role: Role) {
  const session = await requireAdmin();
  if (session.user.id === id) throw new Error("Vous ne pouvez pas modifier votre propre rôle");
  if (role !== "ADMIN") {
    await assertNotLastActiveAdmin(id);
  }

  await prisma.user.update({ where: { id }, data: { role } });
  revalidatePath("/utilisateurs");
}

const resetPasswordSchema = z.object({
  id: z.string(),
  password: z.string().min(6, "6 caractères minimum"),
});

export async function resetUserPassword(input: z.infer<typeof resetPasswordSchema>) {
  await requireAdmin();
  const data = resetPasswordSchema.parse(input);

  const hashed = await bcrypt.hash(data.password, 10);
  await prisma.user.update({ where: { id: data.id }, data: { password: hashed } });
  revalidatePath("/utilisateurs");
}

export async function setUserActive(id: string, active: boolean) {
  const session = await requireAdmin();
  if (session.user.id === id) throw new Error("Vous ne pouvez pas désactiver votre propre compte");
  if (!active) {
    await assertNotLastActiveAdmin(id);
  }

  await prisma.user.update({ where: { id }, data: { active } });
  revalidatePath("/utilisateurs");
}

export async function deleteUser(id: string) {
  const session = await requireAdmin();
  if (session.user.id === id) throw new Error("Vous ne pouvez pas supprimer votre propre compte");
  await assertNotLastActiveAdmin(id);

  const [orders, expenses, payments, cashRegisters, corrections] = await Promise.all([
    prisma.order.count({ where: { userId: id } }),
    prisma.expense.count({ where: { userId: id } }),
    prisma.payment.count({ where: { cashierId: id } }),
    prisma.cashRegister.count({ where: { cashierId: id } }),
    prisma.cashRegister.count({ where: { correctedById: id } }),
  ]);
  if (orders + expenses + payments + cashRegisters + corrections > 0) {
    throw new Error(
      "Impossible de supprimer : cet utilisateur a des données liées (commandes, dépenses, paiements ou caisses). Désactivez-le plutôt.",
    );
  }

  await prisma.user.delete({ where: { id } });
  revalidatePath("/utilisateurs");
}

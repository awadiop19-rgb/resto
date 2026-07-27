"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  return session;
}

const updateProfileSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide"),
});

export async function updateProfile(input: z.infer<typeof updateProfileSchema>) {
  const session = await requireUser();
  const data = updateProfileSchema.parse(input);

  const existing = await prisma.user.findFirst({
    where: { email: data.email, NOT: { id: session.user.id } },
  });
  if (existing) throw new Error("Cet email est déjà utilisé");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: data.name, email: data.email },
  });

  revalidatePath("/profil");
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  newPassword: z.string().min(6, "6 caractères minimum"),
});

export async function changePassword(input: z.infer<typeof changePasswordSchema>) {
  const session = await requireUser();
  const data = changePasswordSchema.parse(input);

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) throw new Error("Utilisateur introuvable");

  const isValid = await bcrypt.compare(data.currentPassword, user.password);
  if (!isValid) throw new Error("Mot de passe actuel incorrect");

  const hashed = await bcrypt.hash(data.newPassword, 10);
  await prisma.user.update({ where: { id: session.user.id }, data: { password: hashed } });

  revalidatePath("/profil");
}

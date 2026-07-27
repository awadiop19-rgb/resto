"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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
  if (!session?.user || session.user.role !== "ADMIN") throw new Error("Non autorisé");

  const data = expenseSchema.parse(input);

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
  if (!session?.user || session.user.role !== "ADMIN") throw new Error("Non autorisé");

  await prisma.expense.delete({ where: { id } });
  revalidatePath("/depenses");
  revalidatePath("/dashboard");
}

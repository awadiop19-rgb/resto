"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function requireCashier() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "CAISSIER" && session.user.role !== "ADMIN")) {
    throw new Error("Non autorisé");
  }
  return session;
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") throw new Error("Non autorisé");
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

  const existing = await prisma.cashRegister.findFirst({
    where: { cashierId: session.user.id, status: "OUVERTE" },
  });
  if (existing) throw new Error("Une caisse est déjà ouverte");

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
  const data = payOrderSchema.parse(input);

  const cashRegister = await prisma.cashRegister.findFirst({
    where: { cashierId: session.user.id, status: "OUVERTE" },
  });
  if (!cashRegister) throw new Error("Ouvrez votre caisse avant d'encaisser un paiement");

  const order = await prisma.order.findUnique({
    where: { id: data.orderId },
    include: { items: true, payment: true },
  });
  if (!order) throw new Error("Commande introuvable");
  if (order.status === "ANNULEE") throw new Error("Impossible d'encaisser une commande annulée");
  if (order.payment) throw new Error("Cette commande a déjà été payée");

  const amount = order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  if (amount <= 0) throw new Error("Le montant de la commande est invalide");

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
  declaredAmount: z.number().min(0, "Montant invalide"),
  note: z.string().optional(),
});

export async function closeCashRegister(input: z.infer<typeof closeCashRegisterSchema>) {
  const session = await requireCashier();
  const data = closeCashRegisterSchema.parse(input);

  const cashRegister = await prisma.cashRegister.findFirst({
    where: { cashierId: session.user.id, status: "OUVERTE" },
  });
  if (!cashRegister) throw new Error("Aucune caisse ouverte");

  const payments = await prisma.payment.findMany({ where: { cashRegisterId: cashRegister.id } });
  const totalCash = payments.filter((p) => p.method === "CASH").reduce((sum, p) => sum + p.amount, 0);
  const totalWave = payments.filter((p) => p.method === "WAVE").reduce((sum, p) => sum + p.amount, 0);

  await prisma.cashRegister.update({
    where: { id: cashRegister.id },
    data: {
      status: "FERMEE",
      closedAt: new Date(),
      totalCash,
      totalWave,
      declaredAmount: data.declaredAmount,
      note: data.note?.trim() ? data.note.trim() : null,
    },
  });

  revalidatePath("/caisse");
  revalidatePath("/caisse/versements");
}

const correctCashRegisterSchema = z.object({
  id: z.string(),
  correctedAmount: z.number().min(0, "Montant invalide"),
  correctionNote: z.string().min(1, "Veuillez indiquer la raison de la correction"),
});

export async function correctCashRegister(input: z.infer<typeof correctCashRegisterSchema>) {
  const session = await requireAdminOrComptabilite();
  const data = correctCashRegisterSchema.parse(input);

  const cashRegister = await prisma.cashRegister.findUnique({ where: { id: data.id } });
  if (!cashRegister) throw new Error("Versement introuvable");
  if (cashRegister.status !== "FERMEE") throw new Error("Seul un versement clôturé peut être corrigé");

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
}

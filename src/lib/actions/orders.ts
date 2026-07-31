"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { OrderStatus, Role } from "@/generated/prisma/client";
import { assertCaisseAJour } from "@/lib/journee-caisse";

// Les Server Actions sont des endpoints HTTP publics : le contrôle fait dans l'UI
// n'est pas une barrière de sécurité, chaque action doit vérifier le rôle elle-même.
const ROLES_PRISE_COMMANDE: Role[] = ["ADMIN", "SERVEUR", "CAISSIER"];
const ROLES_SUIVI_COMMANDE: Role[] = ["ADMIN", "SERVEUR", "CUISINE", "CAISSIER"];

async function requireRole(roles: Role[]) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (!roles.includes(session.user.role)) throw new Error("Non autorisé");
  return session;
}

/**
 * Actions de service courant : interdites tant qu'une caisse d'une journée
 * antérieure n'est pas clôturée.
 */
async function requireRoleEnService(roles: Role[]) {
  const session = await requireRole(roles);
  await assertCaisseAJour(session.user.id, session.user.role);
  return session;
}

const orderItemSchema = z.object({
  menuItemId: z.string(),
  quantity: z.number().int().min(1),
  note: z.string().optional(),
});

const createOrderSchema = z.object({
  tableNumber: z.number().int().min(1).optional(),
  items: z.array(orderItemSchema).min(1, "Ajoutez au moins un article"),
});

export async function createOrder(input: z.infer<typeof createOrderSchema>) {
  const session = await requireRoleEnService(ROLES_PRISE_COMMANDE);

  const data = createOrderSchema.parse(input);

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: data.items.map((item) => item.menuItemId) } },
  });

  await prisma.order.create({
    data: {
      tableNumber: data.tableNumber,
      userId: session.user.id,
      items: {
        create: data.items.map((item) => {
          const menuItem = menuItems.find((m) => m.id === item.menuItemId);
          if (!menuItem) throw new Error("Article du menu introuvable");
          return {
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            unitPrice: menuItem.price,
            note: item.note,
          };
        }),
      },
    },
  });

  revalidatePath("/commandes");
  revalidatePath("/dashboard");
}

const publicOrderSchema = z.object({
  customerName: z.string().trim().min(2, "Nom requis").max(100),
  customerPhone: z
    .string()
    .trim()
    .min(6, "Numéro de téléphone requis")
    .max(20)
    .regex(/^[0-9+\s]+$/, "Numéro de téléphone invalide"),
  items: z.array(orderItemSchema).min(1, "Ajoutez au moins un article").max(50),
});

export async function createPublicOrder(input: z.infer<typeof publicOrderSchema>) {
  const data = publicOrderSchema.parse(input);

  const ids = data.items.map((item) => item.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: ids }, available: true },
  });

  if (menuItems.length !== new Set(ids).size) {
    throw new Error("Un ou plusieurs articles ne sont plus disponibles");
  }

  const order = await prisma.order.create({
    data: {
      source: "EN_LIGNE",
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      userId: null,
      items: {
        create: data.items.map((item) => {
          const menuItem = menuItems.find((m) => m.id === item.menuItemId)!;
          return {
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            unitPrice: menuItem.price,
            note: item.note,
          };
        }),
      },
    },
  });

  revalidatePath("/commandes");
  revalidatePath("/dashboard");
  return order.id;
}

const updateOrderSchema = z.object({
  orderId: z.string(),
  tableNumber: z.number().int().min(1).nullable(),
  items: z.array(orderItemSchema).min(1, "Ajoutez au moins un article"),
});

export async function updateOrder(input: z.infer<typeof updateOrderSchema>) {
  await requireRoleEnService(ROLES_PRISE_COMMANDE);

  const data = updateOrderSchema.parse(input);

  const existing = await prisma.order.findUnique({
    where: { id: data.orderId },
    include: { payment: true },
  });
  if (!existing) throw new Error("Commande introuvable");
  if (existing.status === "SERVIE" || existing.status === "ANNULEE") {
    throw new Error("Impossible de modifier une commande servie ou annulée");
  }
  // Le paiement fige un montant : modifier les articles après coup fausserait la caisse.
  if (existing.payment) {
    throw new Error("Impossible de modifier une commande déjà encaissée");
  }

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: data.items.map((item) => item.menuItemId) } },
  });

  await prisma.$transaction([
    prisma.orderItem.deleteMany({ where: { orderId: data.orderId } }),
    prisma.order.update({
      where: { id: data.orderId },
      data: {
        tableNumber: data.tableNumber,
        items: {
          create: data.items.map((item) => {
            const menuItem = menuItems.find((m) => m.id === item.menuItemId);
            if (!menuItem) throw new Error("Article du menu introuvable");
            return {
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              unitPrice: menuItem.price,
              note: item.note,
            };
          }),
        },
      },
    }),
  ]);

  revalidatePath("/commandes");
  revalidatePath("/dashboard");
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  await requireRoleEnService(ROLES_SUIVI_COMMANDE);

  if (status === "ANNULEE") {
    const payment = await prisma.payment.findUnique({ where: { orderId } });
    if (payment) throw new Error("Impossible d'annuler une commande déjà encaissée");
  }

  await prisma.order.update({ where: { id: orderId }, data: { status } });
  revalidatePath("/commandes");
  revalidatePath("/caisse");
}

export async function deleteOrder(orderId: string) {
  await requireRole(["ADMIN"]);

  const payment = await prisma.payment.findUnique({ where: { orderId } });
  if (payment) throw new Error("Impossible de supprimer une commande déjà encaissée");

  await prisma.order.delete({ where: { id: orderId } });
  revalidatePath("/commandes");
  revalidatePath("/dashboard");
}

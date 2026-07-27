"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { OrderStatus } from "@/generated/prisma/client";

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
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

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
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const data = updateOrderSchema.parse(input);

  const existing = await prisma.order.findUnique({ where: { id: data.orderId } });
  if (!existing) throw new Error("Commande introuvable");
  if (existing.status === "SERVIE" || existing.status === "ANNULEE") {
    throw new Error("Impossible de modifier une commande servie ou annulée");
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
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  await prisma.order.update({ where: { id: orderId }, data: { status } });
  revalidatePath("/commandes");
}

export async function deleteOrder(orderId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") throw new Error("Non autorisé");

  await prisma.order.delete({ where: { id: orderId } });
  revalidatePath("/commandes");
  revalidatePath("/dashboard");
}

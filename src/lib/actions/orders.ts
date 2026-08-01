"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { OrderStatus, Role } from "@/generated/prisma/client";
import { blocageCaisse } from "@/lib/journee-caisse";
import { premierMessage, refus } from "@/lib/actions/resultat";
import { genererReference } from "@/lib/reference-commande";
import { tarifDuQuartier } from "@/lib/zones-livraison";

/**
 * Résout le tarif d'une livraison. Le montant est lu en base puis figé sur la
 * commande : modifier le tarif d'une zone ne doit pas réécrire l'historique.
 */
async function resoudreLivraison(type: string, quartierId: string | undefined) {
  if (type !== "LIVRAISON") return { quartierId: null, deliveryFee: null };
  if (!quartierId) return refus("Choisissez le quartier de livraison");
  const tarif = await tarifDuQuartier(quartierId);
  if ("erreur" in tarif) return tarif;
  return { quartierId, deliveryFee: tarif.fee };
}

/** Deux références tirées au hasard peuvent coïncider : on retente au lieu d'échouer. */
async function avecReferenceUnique<T>(creer: (reference: string) => Promise<T>): Promise<T> {
  for (let tentative = 0; tentative < 5; tentative++) {
    try {
      return await creer(genererReference());
    } catch (erreur) {
      const collision =
        typeof erreur === "object" && erreur !== null && "code" in erreur && erreur.code === "P2002";
      if (!collision || tentative === 4) throw erreur;
    }
  }
  throw new Error("Impossible de générer une référence de commande");
}

const typeCommandeSchema = z.enum(["SUR_PLACE", "A_EMPORTER", "LIVRAISON"]);

/** Une livraison sans nom, téléphone et adresse n'est pas livrable. */
const livraisonRenseignee = <T extends {
  type: "SUR_PLACE" | "A_EMPORTER" | "LIVRAISON";
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
}>(
  data: T,
) =>
  data.type !== "LIVRAISON" ||
  Boolean(data.customerName?.trim() && data.customerPhone?.trim() && data.deliveryAddress?.trim());

const MESSAGE_LIVRAISON = {
  message: "Une livraison exige le nom, le téléphone et l'adresse du client",
  path: ["deliveryAddress"],
};

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

const orderItemSchema = z.object({
  menuItemId: z.string(),
  quantity: z.number().int().min(1),
  note: z.string().optional(),
});

const createOrderSchema = z
  .object({
    tableNumber: z.number().int().min(1).optional(),
    type: typeCommandeSchema.default("SUR_PLACE"),
    customerName: z.string().trim().max(100).optional(),
    customerPhone: z.string().trim().max(20).optional(),
    quartierId: z.string().optional(),
    deliveryAddress: z.string().trim().max(300).optional(),
    deliveryNote: z.string().trim().max(300).optional(),
    items: z.array(orderItemSchema).min(1, "Ajoutez au moins un article"),
  })
  .refine(livraisonRenseignee, MESSAGE_LIVRAISON);

export async function createOrder(input: z.infer<typeof createOrderSchema>) {
  const session = await requireRole(ROLES_PRISE_COMMANDE);

  const blocage = await blocageCaisse(session.user.id, session.user.role);
  if (blocage) return refus(blocage);

  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const data = parsed.data;

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: data.items.map((item) => item.menuItemId) } },
  });

  const manquant = data.items.find((item) => !menuItems.some((m) => m.id === item.menuItemId));
  if (manquant) return refus("Article du menu introuvable");

  const lignes = data.items.map((item) => {
    const menuItem = menuItems.find((m) => m.id === item.menuItemId)!;
    return {
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      unitPrice: menuItem.price,
      note: item.note,
    };
  });

  const livraison = await resoudreLivraison(data.type, data.quartierId);
  if ("erreur" in livraison) return livraison;

  const commande = await avecReferenceUnique((reference) =>
    prisma.order.create({
      data: {
        reference,
        // Un numéro de table n'a de sens que pour une consommation sur place.
        tableNumber: data.type === "SUR_PLACE" ? data.tableNumber : null,
        type: data.type,
        customerName: data.customerName || null,
        customerPhone: data.customerPhone || null,
        deliveryAddress: data.type === "LIVRAISON" ? data.deliveryAddress : null,
        deliveryNote: data.type === "LIVRAISON" ? data.deliveryNote || null : null,
        deliveryStatus: data.type === "LIVRAISON" ? "A_ASSIGNER" : null,
        quartierId: livraison.quartierId,
        deliveryFee: livraison.deliveryFee,
        userId: session.user.id,
        items: { create: lignes },
      },
    }),
  );

  revalidatePath("/commandes");
  revalidatePath("/livraisons");
  revalidatePath("/dashboard");
  return commande.reference;
}

const publicOrderSchema = z
  .object({
    customerName: z.string().trim().min(2, "Nom requis").max(100),
    customerPhone: z
      .string()
      .trim()
      .min(6, "Numéro de téléphone requis")
      .max(20)
      .regex(/^[0-9+\s]+$/, "Numéro de téléphone invalide"),
    // Une commande passée sur le site est soit retirée sur place, soit livrée.
    type: z.enum(["A_EMPORTER", "LIVRAISON"]).default("A_EMPORTER"),
    quartierId: z.string().optional(),
    deliveryAddress: z.string().trim().max(300).optional(),
    deliveryNote: z.string().trim().max(300).optional(),
    items: z.array(orderItemSchema).min(1, "Ajoutez au moins un article").max(50),
  })
  .refine(
    (data) => data.type !== "LIVRAISON" || Boolean(data.deliveryAddress?.trim()),
    { message: "Indiquez l'adresse de livraison", path: ["deliveryAddress"] },
  );

export async function createPublicOrder(input: z.infer<typeof publicOrderSchema>) {
  const parsed = publicOrderSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const data = parsed.data;

  const ids = data.items.map((item) => item.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: ids }, available: true },
  });

  if (menuItems.length !== new Set(ids).size) {
    return refus("Un ou plusieurs articles ne sont plus disponibles");
  }

  const livraison = await resoudreLivraison(data.type, data.quartierId);
  if ("erreur" in livraison) return livraison;

  const order = await avecReferenceUnique((reference) =>
    prisma.order.create({
      data: {
        reference,
        source: "EN_LIGNE",
        type: data.type,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        deliveryAddress: data.type === "LIVRAISON" ? data.deliveryAddress : null,
        deliveryNote: data.type === "LIVRAISON" ? data.deliveryNote || null : null,
        deliveryStatus: data.type === "LIVRAISON" ? "A_ASSIGNER" : null,
        quartierId: livraison.quartierId,
        deliveryFee: livraison.deliveryFee,
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
    }),
  );

  revalidatePath("/commandes");
  revalidatePath("/livraisons");
  revalidatePath("/dashboard");
  return order.reference;
}

const updateOrderSchema = z
  .object({
    orderId: z.string(),
    tableNumber: z.number().int().min(1).nullable(),
    type: typeCommandeSchema.default("SUR_PLACE"),
    customerName: z.string().trim().max(100).optional(),
    customerPhone: z.string().trim().max(20).optional(),
    quartierId: z.string().optional(),
    deliveryAddress: z.string().trim().max(300).optional(),
    deliveryNote: z.string().trim().max(300).optional(),
    items: z.array(orderItemSchema).min(1, "Ajoutez au moins un article"),
  })
  .refine(livraisonRenseignee, MESSAGE_LIVRAISON);

export async function updateOrder(input: z.infer<typeof updateOrderSchema>) {
  const session = await requireRole(ROLES_PRISE_COMMANDE);

  const blocage = await blocageCaisse(session.user.id, session.user.role);
  if (blocage) return refus(blocage);

  const parsed = updateOrderSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const data = parsed.data;

  const existing = await prisma.order.findUnique({
    where: { id: data.orderId },
    include: { payment: true },
  });
  if (!existing) return refus("Commande introuvable");
  if (existing.status === "SERVIE" || existing.status === "ANNULEE") {
    return refus("Impossible de modifier une commande servie ou annulée");
  }
  // Le paiement fige un montant : modifier les articles après coup fausserait la caisse.
  if (existing.payment) {
    return refus("Impossible de modifier une commande déjà encaissée");
  }

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: data.items.map((item) => item.menuItemId) } },
  });

  const manquant = data.items.find((item) => !menuItems.some((m) => m.id === item.menuItemId));
  if (manquant) return refus("Article du menu introuvable");

  const livraison = await resoudreLivraison(data.type, data.quartierId);
  if ("erreur" in livraison) return livraison;

  await prisma.$transaction([
    prisma.orderItem.deleteMany({ where: { orderId: data.orderId } }),
    prisma.order.update({
      where: { id: data.orderId },
      data: {
        tableNumber: data.type === "SUR_PLACE" ? data.tableNumber : null,
        type: data.type,
        customerName: data.customerName || null,
        customerPhone: data.customerPhone || null,
        deliveryAddress: data.type === "LIVRAISON" ? data.deliveryAddress : null,
        deliveryNote: data.type === "LIVRAISON" ? data.deliveryNote || null : null,
        // Repasser en livraison replace la commande dans la file d'affectation ;
        // en sortir libère le livreur éventuellement déjà assigné.
        deliveryStatus:
          data.type === "LIVRAISON" ? (existing.deliveryStatus ?? "A_ASSIGNER") : null,
        livreurId: data.type === "LIVRAISON" ? existing.livreurId : null,
        quartierId: livraison.quartierId,
        deliveryFee: livraison.deliveryFee,
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
    }),
  ]);

  revalidatePath("/commandes");
  revalidatePath("/dashboard");
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const session = await requireRole(ROLES_SUIVI_COMMANDE);

  const blocage = await blocageCaisse(session.user.id, session.user.role);
  if (blocage) return refus(blocage);

  if (status === "ANNULEE") {
    const payment = await prisma.payment.findUnique({ where: { orderId } });
    if (payment) return refus("Impossible d'annuler une commande déjà encaissée");
  }

  await prisma.order.update({ where: { id: orderId }, data: { status } });
  revalidatePath("/commandes");
  revalidatePath("/caisse");
}

export async function deleteOrder(orderId: string) {
  await requireRole(["ADMIN"]);

  const payment = await prisma.payment.findUnique({ where: { orderId } });
  if (payment) return refus("Impossible de supprimer une commande déjà encaissée");

  await prisma.order.delete({ where: { id: orderId } });
  revalidatePath("/commandes");
  revalidatePath("/dashboard");
}

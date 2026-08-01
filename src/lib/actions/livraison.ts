"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Role } from "@/generated/prisma/client";
import { premierMessage, refus } from "@/lib/actions/resultat";

async function requireRole(roles: Role[]) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (!roles.includes(session.user.role)) throw new Error("Non autorisé");
  return session;
}

/** Qui répartit les tournées : la caisse, et l'administration. */
const ROLES_REPARTITION: Role[] = ["ADMIN", "CAISSIER"];

function revalider() {
  revalidatePath("/livraisons");
  revalidatePath("/mes-livraisons");
  revalidatePath("/commandes");
}

const assignerSchema = z.object({
  orderIds: z.array(z.string()).min(1, "Sélectionnez au moins une commande"),
  livreurId: z.string().min(1, "Choisissez un livreur"),
});

/** Affecte un livreur à une ou plusieurs commandes en une seule fois. */
export async function assignerLivreur(input: z.infer<typeof assignerSchema>) {
  await requireRole(ROLES_REPARTITION);

  const parsed = assignerSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const data = parsed.data;

  const livreur = await prisma.user.findUnique({ where: { id: data.livreurId } });
  if (!livreur || livreur.role !== "LIVREUR") return refus("Livreur introuvable");
  if (!livreur.active) return refus("Ce livreur est désactivé");

  const commandes = await prisma.order.findMany({
    where: { id: { in: data.orderIds } },
    select: {
      id: true,
      type: true,
      deliveryStatus: true,
      reference: true,
      payment: { select: { id: true } },
    },
  });

  if (commandes.length !== data.orderIds.length) return refus("Commande introuvable");

  const nonLivrables = commandes.filter((c) => c.type !== "LIVRAISON");
  if (nonLivrables.length > 0) {
    return refus("Seule une commande en livraison peut être confiée à un livreur");
  }
  // Une commande part encaissée : le livreur ne collecte pas d'argent.
  const impayees = commandes.filter((c) => !c.payment);
  if (impayees.length > 0) {
    return refus(
      `Encaissez d'abord ${impayees.length > 1 ? "ces commandes" : "cette commande"} avant de la confier à un livreur : ${impayees
        .map((c) => c.reference ?? "sans référence")
        .join(", ")}`,
    );
  }
  // Une commande déjà remise au client ne se réaffecte pas.
  const terminees = commandes.filter((c) => c.deliveryStatus === "LIVREE");
  if (terminees.length > 0) {
    return refus(`Commande déjà livrée : ${terminees.map((c) => c.reference).join(", ")}`);
  }

  await prisma.order.updateMany({
    where: { id: { in: data.orderIds } },
    data: { livreurId: data.livreurId, deliveryStatus: "ASSIGNEE", assignedAt: new Date() },
  });

  revalider();
  return commandes.length;
}

export async function retirerLivreur(orderId: string) {
  await requireRole(ROLES_REPARTITION);

  const commande = await prisma.order.findUnique({ where: { id: orderId } });
  if (!commande) return refus("Commande introuvable");
  if (commande.deliveryStatus === "LIVREE") {
    return refus("Impossible de retirer le livreur d'une commande déjà livrée");
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { livreurId: null, deliveryStatus: "A_ASSIGNER", assignedAt: null },
  });

  revalider();
}

const avancementSchema = z.object({
  orderId: z.string(),
  statut: z.enum(["EN_ROUTE", "LIVREE", "ECHOUEE"]),
});

/**
 * Avancement d'une livraison. Le livreur ne peut agir que sur ses propres
 * courses : l'identité vient de la session, jamais du client.
 */
export async function avancerLivraison(input: z.infer<typeof avancementSchema>) {
  const session = await requireRole(["ADMIN", "CAISSIER", "LIVREUR"]);

  const parsed = avancementSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const data = parsed.data;

  const commande = await prisma.order.findUnique({ where: { id: data.orderId } });
  if (!commande) return refus("Commande introuvable");
  if (commande.type !== "LIVRAISON") return refus("Cette commande n'est pas une livraison");

  if (session.user.role === "LIVREUR" && commande.livreurId !== session.user.id) {
    throw new Error("Cette livraison ne vous est pas attribuée");
  }
  if (!commande.livreurId) return refus("Aucun livreur n'est affecté à cette commande");
  if (commande.deliveryStatus === "LIVREE") return refus("Cette commande est déjà livrée");

  await prisma.order.update({
    where: { id: data.orderId },
    data: {
      deliveryStatus: data.statut,
      deliveredAt: data.statut === "LIVREE" ? new Date() : null,
      // Une commande remise au client est servie : la cuisine n'a plus à la suivre.
      status: data.statut === "LIVREE" ? "SERVIE" : commande.status,
    },
  });

  revalider();
  revalidatePath("/dashboard");
}

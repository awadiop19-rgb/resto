"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { OrderStatus, Role } from "@/generated/prisma/client";
import { blocageCaisse } from "@/lib/journee-caisse";
import { blocageCommandeEnLigne } from "@/lib/horaires-data";
import { premierMessage, refus } from "@/lib/actions/resultat";
import { genererReference } from "@/lib/reference-commande";
import { tarifDuQuartier } from "@/lib/zones-livraison";
import {
  annulerSortiesDeVente,
  ecrireSortiesDeVente,
  sortiesDeVente,
} from "@/lib/stock-vente";

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

  // Ce que la commande retire du stock, vérifié avant d'être écrit : on ne prend
  // pas une commande de boissons qu'on n'a pas.
  const sorties = await sortiesDeVente(data.items);
  if ("erreur" in sorties) return sorties;

  const commande = await avecReferenceUnique((reference) =>
    prisma.$transaction(async (tx) => {
      const creee = await tx.order.create({
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
      });
      await ecrireSortiesDeVente(tx, creee.id, sorties, session.user.id, creee.createdAt);
      return creee;
    }),
  );

  revalidatePath("/commandes");
  revalidatePath("/livraisons");
  revalidatePath("/dashboard");
  revalidatePath("/stock");
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
  // Avant toute chose : hors des heures d'ouverture, la commande en ligne n'est
  // pas prise. La page se ferme deja d'elle-meme, mais elle peut avoir ete
  // ouverte avant l'heure de fermeture et rester affichee — sans cette barriere,
  // le formulaire resterait actif pour qui l'a sous les yeux.
  const ferme = await blocageCommandeEnLigne();
  if (ferme) return refus(ferme);

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

  // Une boisson épuisée ne se sert pas davantage parce que la commande vient du
  // site : le client doit l'apprendre maintenant, pas au retrait.
  const sorties = await sortiesDeVente(data.items);
  if ("erreur" in sorties) return sorties;

  const order = await avecReferenceUnique((reference) =>
    prisma.$transaction(async (tx) => {
      const creee = await tx.order.create({
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
      });
      // Aucun auteur : personne n'a saisi cette sortie, c'est la commande qui en
      // répond.
      await ecrireSortiesDeVente(tx, creee.id, sorties, null, creee.createdAt);
      return creee;
    }),
  );

  revalidatePath("/commandes");
  revalidatePath("/livraisons");
  revalidatePath("/dashboard");
  revalidatePath("/stock");
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

  // Les sorties de la commande vont être refaites : ce qu'elle avait déjà retiré
  // du stock lui reste acquis le temps du calcul, sinon ajouter une bière à une
  // commande qui en comptait déjà deux se heurterait à un stock compté en double.
  const sorties = await sortiesDeVente(data.items, { commandeId: data.orderId });
  if ("erreur" in sorties) return sorties;

  await prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({ where: { orderId: data.orderId } });
    await annulerSortiesDeVente(tx, data.orderId);
    await tx.order.update({
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
    });
    await ecrireSortiesDeVente(tx, data.orderId, sorties, session.user.id, existing.createdAt);
  });

  revalidatePath("/commandes");
  revalidatePath("/dashboard");
  revalidatePath("/stock");
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const session = await requireRole(ROLES_SUIVI_COMMANDE);

  const blocage = await blocageCaisse(session.user.id, session.user.role);
  if (blocage) return refus(blocage);

  if (status === "ANNULEE") {
    const payment = await prisma.payment.findUnique({ where: { orderId } });
    if (payment) return refus("Impossible d'annuler une commande déjà encaissée");
  }

  const commande = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      createdAt: true,
      userId: true,
      items: { select: { menuItemId: true, quantity: true } },
    },
  });
  if (!commande) return refus("Commande introuvable");

  // Le stock suit l'annulation dans les deux sens : ce qui n'est plus vendu
  // revient, ce qui l'est de nouveau repart. Une commande rétablie sans que le
  // stock ne bouge ferait apparaître des boissons qui sont chez le client.
  const annule = status === "ANNULEE";
  const retabli = commande.status === "ANNULEE" && !annule;

  const sorties = retabli ? await sortiesDeVente(commande.items) : [];
  if ("erreur" in sorties) return sorties;

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { status } });
    if (annule) await annulerSortiesDeVente(tx, orderId);
    if (retabli) {
      await ecrireSortiesDeVente(tx, orderId, sorties, commande.userId, commande.createdAt);
    }
  });

  revalidatePath("/commandes");
  revalidatePath("/caisse");
  if (annule || retabli) revalidatePath("/stock");
}

const annulationSchema = z.object({
  orderId: z.string().min(1),
  // Un motif est exige, et pas seulement quelques caracteres : « x » ferait
  // passer le controle sans rien expliquer a qui relira la journee.
  motif: z.string().trim().min(5, "Expliquez le motif de l'annulation").max(300),
});

/**
 * Annulation par la comptabilite d'une commande restee impayee.
 *
 * Une commande qui n'est jamais reglee reste en « attente d'encaissement » et
 * fausse le montant a encaisser de la journee, sans qu'aucun caissier ne puisse
 * la solder — elle n'a jamais eu de contrepartie. Cela vaut pour une commande du
 * site, ou le client peut ne jamais venir, se tromper, ou plaisanter, comme pour
 * une commande du comptoir dont le client est parti sans payer.
 *
 * La commande n'est pas detruite mais annulee, avec son motif, son auteur et son
 * heure. Une suppression ferait disparaitre la justification avec ce qu'elle
 * justifie : plus rien ne permettrait de verifier ce qui a quitte la journee, ni
 * de constater une annulation faite a tort. C'est aussi pourquoi le motif est
 * exige, et pas seulement quelques caracteres — la trace ecrite est ce qui
 * distingue une correction d'une disparition.
 */
export async function annulerCommandeImpayee(input: z.infer<typeof annulationSchema>) {
  const session = await requireRole(["ADMIN", "COMPTABILITE"]);

  const parsed = annulationSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const { orderId, motif } = parsed.data;

  const commande = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: { select: { id: true } } },
  });
  if (!commande) return refus("Commande introuvable");

  // Encaissee, elle est devenue une recette : l'annuler creuserait un ecart de
  // caisse que personne ne pourrait expliquer.
  if (commande.payment) return refus("Impossible d'annuler une commande déjà encaissée");
  if (commande.status === "ANNULEE") return refus("Cette commande est déjà annulée");

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "ANNULEE",
        cancelledAt: new Date(),
        cancellationReason: motif,
        cancelledById: session.user.id,
      },
    });
    // Ce que la commande avait sorti du stock n'a jamais quitté le comptoir :
    // sans cela, une commande fantôme laisserait un manquant permanent.
    await annulerSortiesDeVente(tx, orderId);
  });

  revalidatePath("/comptabilite/journee");
  revalidatePath("/comptabilite");
  revalidatePath("/commandes");
  revalidatePath("/caisse");
  revalidatePath("/dashboard");
  revalidatePath("/stock");
  return { ok: true as const };
}

export async function deleteOrder(orderId: string) {
  await requireRole(["ADMIN"]);

  const payment = await prisma.payment.findUnique({ where: { orderId } });
  if (payment) return refus("Impossible de supprimer une commande déjà encaissée");

  // Les sorties de stock de la commande partent avec elle (cascade) : ce qui
  // n'a jamais été vendu ne doit pas rester décompté.
  await prisma.order.delete({ where: { id: orderId } });
  revalidatePath("/commandes");
  revalidatePath("/dashboard");
  revalidatePath("/stock");
}

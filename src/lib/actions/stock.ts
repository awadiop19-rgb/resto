"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { premierMessage, refus } from "@/lib/actions/resultat";
import { formatQuantite } from "@/lib/stock";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/** Le stock est un registre comptable : sa tenue reste à l'administration et à la comptabilité. */
async function requireComptable() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "COMPTABILITE")) {
    throw new Error("Non autorisé");
  }
  return session;
}

function revalider() {
  revalidatePath("/stock");
  revalidatePath("/produits");
  revalidatePath("/comptabilite");
  revalidatePath("/depenses");
}

// ------------------------------------------------------------------ Produits

const productSchema = z.object({
  name: z.string().trim().min(1, "Nom requis"),
  unit: z.enum(["KG", "LITRE", "UNITE"]),
  category: z.string().trim().min(1, "Catégorie requise"),
  seuilAlerte: z.number().min(0, "Le seuil ne peut pas être négatif"),
  active: z.boolean(),
});

export type ProductInput = z.infer<typeof productSchema>;

export async function createProduct(input: ProductInput) {
  await requireComptable();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const data = parsed.data;

  const existant = await prisma.product.findUnique({ where: { name: data.name } });
  if (existant) return refus(`Le produit « ${data.name} » existe déjà`);

  await prisma.product.create({ data });
  revalider();
}

export async function updateProduct(id: string, input: ProductInput) {
  await requireComptable();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const data = parsed.data;

  const homonyme = await prisma.product.findUnique({ where: { name: data.name } });
  if (homonyme && homonyme.id !== id) return refus(`Le produit « ${data.name} » existe déjà`);

  // L'unité fixe le sens de tous les mouvements déjà enregistrés : la changer
  // transformerait 3 litres en 3 kilos dans l'historique.
  const produit = await prisma.product.findUnique({ where: { id } });
  if (!produit) return refus("Produit introuvable");
  if (produit.unit !== data.unit) {
    const mouvements = await prisma.stockMovement.count({ where: { productId: id } });
    if (mouvements > 0) {
      return refus(
        "Impossible de changer l'unité d'un produit qui a déjà des mouvements. Créez un nouveau produit."
      );
    }
  }

  await prisma.product.update({ where: { id }, data });
  revalider();
}

export async function toggleProductActive(id: string, active: boolean) {
  await requireComptable();
  await prisma.product.update({ where: { id }, data: { active } });
  revalider();
}

export async function deleteProduct(id: string) {
  await requireComptable();

  // Supprimer un produit mouvementé effacerait des achats déjà comptabilisés.
  const mouvements = await prisma.stockMovement.count({ where: { productId: id } });
  if (mouvements > 0) {
    return refus(
      `Ce produit a ${mouvements} mouvement(s) enregistré(s). Désactivez-le plutôt que de le supprimer.`
    );
  }

  await prisma.product.delete({ where: { id } });
  revalider();
}

// --------------------------------------------------------------- Mouvements

const mouvementSchema = z.object({
  productId: z.string().min(1, "Produit requis"),
  type: z.enum(["ACHAT", "SORTIE", "AJUSTEMENT"]),
  /** Toujours saisie en positif : c'est le type qui décide du sens. */
  quantity: z.number().positive("La quantité doit être positive"),
  /** L'ajustement seul peut retirer du stock avec une quantité saisie en positif. */
  sensNegatif: z.boolean().optional(),
  unitPrice: z.number().min(0).optional(),
  supplier: z.string().trim().optional(),
  note: z.string().trim().optional(),
  date: z.string().min(1, "Date requise"),
});

export type MouvementInput = z.infer<typeof mouvementSchema>;

/**
 * Enregistre un mouvement de stock. Un achat crée aussi la dépense correspondante :
 * une seule saisie alimente le stock et le résultat comptable, sans risque de
 * double comptage.
 */
export async function enregistrerMouvement(input: MouvementInput) {
  const session = await requireComptable();
  const parsed = mouvementSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const data = parsed.data;

  const produit = await prisma.product.findUnique({ where: { id: data.productId } });
  if (!produit) return refus("Produit introuvable");
  if (!produit.active && data.type !== "AJUSTEMENT") {
    return refus(`Le produit « ${produit.name} » est désactivé`);
  }

  if (data.type === "ACHAT" && (data.unitPrice == null || data.unitPrice <= 0)) {
    return refus("Le prix unitaire d'achat est requis");
  }

  const delta =
    data.type === "ACHAT"
      ? data.quantity
      : data.type === "SORTIE"
        ? -data.quantity
        : data.sensNegatif
          ? -data.quantity
          : data.quantity;

  // Un stock négatif ne veut rien dire : il signale une saisie manquante en
  // amont, qu'un ajustement d'inventaire doit corriger explicitement.
  if (delta < 0) {
    const solde = await prisma.stockMovement.aggregate({
      where: { productId: produit.id },
      _sum: { quantity: true },
    });
    const stock = solde._sum.quantity ?? 0;
    if (stock + delta < 0) {
      return refus(
        `Stock insuffisant : il reste ${formatQuantite(stock, produit.unit)} de ${produit.name}. ` +
          `Corrigez d'abord par un ajustement d'inventaire.`
      );
    }
  }

  const date = new Date(data.date);
  const montant = data.type === "ACHAT" ? data.quantity * (data.unitPrice ?? 0) : null;

  await prisma.$transaction(async (tx) => {
    const expense =
      montant != null
        ? await tx.expense.create({
            data: {
              label: `Achat ${produit.name} — ${formatQuantite(data.quantity, produit.unit)}`,
              amount: montant,
              category: produit.category,
              date,
              userId: session.user.id,
            },
          })
        : null;

    await tx.stockMovement.create({
      data: {
        productId: produit.id,
        type: data.type,
        quantity: delta,
        unitPrice: data.type === "ACHAT" ? data.unitPrice : null,
        supplier: data.supplier || null,
        note: data.note || null,
        date,
        userId: session.user.id,
        expenseId: expense?.id ?? null,
      },
    });
  });

  revalider();
}

const correctionSchema = z.object({
  id: z.string().min(1),
  /** Saisie en positif : le sens du mouvement d'origine est conservé. */
  quantity: z.number().positive("La quantité doit être positive"),
  unitPrice: z.number().min(0).optional(),
  // Cinq caractères au moins : un « x » passerait le contrôle sans rien
  // expliquer à qui relira le registre.
  motif: z.string().trim().min(5, "Expliquez le motif de la correction").max(300),
});

export type CorrectionInput = z.infer<typeof correctionSchema>;

/**
 * Correction d'une saisie de stock par la comptabilité.
 *
 * Une quantité mal frappée fausse le solde jusqu'au prochain inventaire, et pour
 * un achat, elle fausse aussi le résultat comptable. La corriger par un
 * ajustement inverse laisserait deux lignes contradictoires dans un registre qui
 * doit se lire comme un historique ; la saisie est donc rectifiée sur place, et
 * ses valeurs d'origine conservées.
 *
 * Le sens du mouvement ne change pas : une entrée reste une entrée. Requalifier
 * un achat en sortie ferait apparaître ou disparaître une dépense, ce qui n'est
 * plus une correction de frappe mais une autre écriture — à saisir comme telle.
 */
export async function corrigerMouvement(input: CorrectionInput) {
  const session = await requireComptable();
  const parsed = correctionSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const data = parsed.data;

  const mouvement = await prisma.stockMovement.findUnique({
    where: { id: data.id },
    include: { product: true },
  });
  if (!mouvement) return refus("Mouvement introuvable");

  // Une sortie de vente n'est pas une saisie : elle reflète des articles
  // commandés. La rectifier ici ferait diverger le stock de ce qui a été vendu —
  // c'est la commande qu'il faut corriger.
  if (mouvement.orderId) {
    return refus(
      "Cette sortie provient d'une commande : corrigez la commande, le stock suivra."
    );
  }

  if (mouvement.type === "ACHAT" && (data.unitPrice == null || data.unitPrice <= 0)) {
    return refus("Le prix unitaire d'achat est requis");
  }

  // Le signe vient du mouvement d'origine, jamais de la saisie : c'est ce qui
  // garantit qu'une correction ne retourne pas une entrée en sortie.
  const nouveauDelta = mouvement.quantity < 0 ? -data.quantity : data.quantity;
  const nouveauPrix = mouvement.type === "ACHAT" ? (data.unitPrice ?? null) : mouvement.unitPrice;

  if (nouveauDelta === mouvement.quantity && nouveauPrix === mouvement.unitPrice) {
    return refus("Cette correction ne change rien à la saisie");
  }

  // Réduire une entrée déjà consommée rendrait le solde négatif : l'historique
  // décrirait un stock qui n'a jamais pu exister.
  const solde = await prisma.stockMovement.aggregate({
    where: { productId: mouvement.productId },
    _sum: { quantity: true },
  });
  const apres = (solde._sum.quantity ?? 0) - mouvement.quantity + nouveauDelta;
  if (apres < 0) {
    return refus(
      `Correction impossible : le stock de ${mouvement.product.name} deviendrait négatif ` +
        `(${formatQuantite(apres, mouvement.product.unit)}). Passez par un ajustement d'inventaire.`
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.stockMovement.update({
      where: { id: mouvement.id },
      data: {
        quantity: nouveauDelta,
        unitPrice: nouveauPrix,
        // Ne se renseignent qu'une fois : deux corrections successives ne
        // doivent pas effacer la trace de la saisie initiale.
        originalQuantity: mouvement.originalQuantity ?? mouvement.quantity,
        originalUnitPrice: mouvement.originalUnitPrice ?? mouvement.unitPrice,
        correctionNote: data.motif,
        correctedById: session.user.id,
        correctedAt: new Date(),
      },
    });

    // La dépense engendrée par l'achat suit la correction. Sans cela, le stock
    // et le résultat comptable, nés d'une même saisie, se mettraient à diverger.
    if (mouvement.expenseId && mouvement.type === "ACHAT") {
      await tx.expense.update({
        where: { id: mouvement.expenseId },
        data: {
          amount: data.quantity * (data.unitPrice ?? 0),
          label: `Achat ${mouvement.product.name} — ${formatQuantite(data.quantity, mouvement.product.unit)}`,
        },
      });
    }
  });

  revalider();
  return { ok: true as const };
}

export async function supprimerMouvement(id: string) {
  await requireComptable();

  const mouvement = await prisma.stockMovement.findUnique({
    where: { id },
    include: { product: true },
  });
  if (!mouvement) return refus("Mouvement introuvable");

  if (mouvement.orderId) {
    return refus(
      "Cette sortie provient d'une commande : annulez la commande, le stock suivra."
    );
  }

  // Retirer une entrée déjà consommée rendrait le solde négatif : l'historique
  // décrirait alors un stock qui n'a jamais pu exister.
  if (mouvement.quantity > 0) {
    const solde = await prisma.stockMovement.aggregate({
      where: { productId: mouvement.productId },
      _sum: { quantity: true },
    });
    if ((solde._sum.quantity ?? 0) - mouvement.quantity < 0) {
      return refus(
        `Cette entrée a déjà été consommée : la supprimer rendrait le stock de ${mouvement.product.name} négatif.`
      );
    }
  }

  // Annuler un achat doit aussi retirer la dépense qu'il avait engendrée, sinon
  // le résultat comptable garde une charge sans contrepartie en stock.
  await prisma.$transaction(async (tx) => {
    await tx.stockMovement.delete({ where: { id } });
    if (mouvement.expenseId) {
      await tx.expense.delete({ where: { id: mouvement.expenseId } });
    }
  });

  revalider();
}

"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { premierMessage, refus } from "@/lib/actions/resultat";
import { supprimerPhoto } from "@/lib/photos-menu-fichiers";
import { CATEGORIES_PRODUIT } from "@/lib/stock";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") throw new Error("Non autorisé");
  return session;
}

const menuItemSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  description: z.string().optional(),
  price: z.number().positive("Le prix doit être positif"),
  categoryId: z.string().min(1, "Catégorie requise"),
  available: z.boolean().default(true),
});

export async function createMenuItem(input: z.infer<typeof menuItemSchema>) {
  await requireAdmin();
  const parsed = menuItemSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const data = parsed.data;
  await prisma.menuItem.create({ data });
  revalidatePath("/menu");
}

export async function updateMenuItem(id: string, input: z.infer<typeof menuItemSchema>) {
  await requireAdmin();
  const parsed = menuItemSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const data = parsed.data;
  await prisma.menuItem.update({ where: { id }, data });
  revalidatePath("/menu");
}

export async function deleteMenuItem(id: string) {
  await requireAdmin();

  // Un plat déjà commandé est référencé par l'historique : le supprimer
  // effacerait des lignes de commandes encaissées.
  const commandes = await prisma.orderItem.count({ where: { menuItemId: id } });
  if (commandes > 0) {
    return refus(
      `Ce plat figure dans ${commandes} commande(s). Rendez-le indisponible plutôt que de le supprimer.`
    );
  }

  const article = await prisma.menuItem.findUnique({
    where: { id },
    select: { imageUrl: true },
  });

  await prisma.menuItem.delete({ where: { id } });
  // Sa photo n'a plus personne pour la réclamer : elle resterait sur le volume
  // sans que rien n'y mène jamais.
  await supprimerPhoto(article?.imageUrl ?? null);
  revalidatePath("/menu");
}

export async function toggleAvailability(id: string, available: boolean) {
  await requireAdmin();
  await prisma.menuItem.update({ where: { id }, data: { available } });
  revalidatePath("/menu");
}

const liaisonSchema = z.object({
  menuItemId: z.string().min(1),
  /** Nul : l'article n'est plus suivi en stock, sans que rien ne soit détruit. */
  productId: z.string().min(1).nullable(),
  quantiteParVente: z.number().positive("La quantité par vente doit être positive"),
});

/**
 * Relie un article du menu au produit qu'il vend tel quel.
 *
 * Le lien est posé article par article, jamais déduit d'un nom ou d'une
 * catégorie : renommer « Coca » ne doit pas décrocher silencieusement un stock,
 * et un même bidon peut alimenter deux articles à des contenances différentes.
 * C'est `quantiteParVente` qui les distingue — 1 pour une bouteille, 0,33 pour
 * un verre tiré d'un litre.
 */
export async function lierAuStock(input: z.infer<typeof liaisonSchema>) {
  await requireAdmin();
  const parsed = liaisonSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const { menuItemId, productId, quantiteParVente } = parsed.data;

  if (productId) {
    const produit = await prisma.product.findUnique({ where: { id: productId } });
    if (!produit) return refus("Produit de stock introuvable");
    if (!produit.active) return refus(`Le produit « ${produit.name} » est désactivé`);
  }

  await prisma.menuItem.update({
    where: { id: menuItemId },
    data: { productId, quantiteParVente: productId ? quantiteParVente : 1 },
  });

  revalidatePath("/menu");
  revalidatePath("/stock");
  return { ok: true as const };
}

/**
 * Crée le produit de stock qui manque à un article, et l'y relie.
 *
 * Sans ce raccourci, suivre une carte de boissons demanderait de créer chaque
 * produit ailleurs puis de le retrouver par son nom, article après article — un
 * travail que personne ne finit, et un suivi qui n'existe donc jamais.
 */
export async function creerProduitPourArticle(menuItemId: string) {
  await requireAdmin();

  const article = await prisma.menuItem.findUnique({
    where: { id: menuItemId },
    include: { category: { select: { name: true } } },
  });
  if (!article) return refus("Article introuvable");
  if (article.productId) return refus("Cet article est déjà suivi en stock");

  const nom = article.name.trim();
  const existant = await prisma.product.findUnique({ where: { name: nom } });
  if (existant) {
    // Le produit est déjà là : le relier vaut mieux que refuser, et mieux qu'un
    // doublon qui scinderait le stock en deux soldes incomplets.
    await prisma.menuItem.update({ where: { id: menuItemId }, data: { productId: existant.id } });
  } else {
    // Un article revendu tel quel se compte en pièces : c'est ce que le
    // gestionnaire ira compter dans le frigo. La catégorie du menu n'est reprise
    // que si le stock la connaît : « Jus locaux » n'y existe pas, et une valeur
    // hors liste se perdrait au premier passage dans la fiche produit.
    const categorie = CATEGORIES_PRODUIT.includes(article.category.name)
      ? article.category.name
      : "Autre";
    const produit = await prisma.product.create({
      data: { name: nom, unit: "UNITE", category: categorie },
    });
    await prisma.menuItem.update({ where: { id: menuItemId }, data: { productId: produit.id } });
  }

  revalidatePath("/menu");
  revalidatePath("/produits");
  revalidatePath("/stock");
  return { ok: true as const };
}

export async function createCategory(name: string) {
  await requireAdmin();
  if (!name.trim()) return refus("Nom de catégorie requis");
  await prisma.menuCategory.create({ data: { name: name.trim() } });
  revalidatePath("/menu");
}

export async function deleteCategory(id: string) {
  await requireAdmin();

  const plats = await prisma.menuItem.count({ where: { categoryId: id } });
  if (plats > 0) {
    return refus(`Cette catégorie contient ${plats} plat(s). Videz-la avant de la supprimer.`);
  }

  await prisma.menuCategory.delete({ where: { id } });
  revalidatePath("/menu");
}

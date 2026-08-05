/**
 * Ce qu'une vente retire du stock.
 *
 * Certains articles du menu ne sont pas cuisinés : une bouteille, un jus, une
 * gâterie sont revendus tels qu'ils ont été achetés. Le client les consomme
 * directement, donc la vente les sort du stock d'elle-même — sans quoi la
 * comptabilité devrait ressaisir à la main ce que la caisse sait déjà, et le
 * solde ne vaudrait que jusqu'au premier oubli.
 *
 * Les plats restent à l'écart : leurs ingrédients sortent vers la cuisine par
 * lots, et une part de mafé ne se convertit pas en kilos de riz.
 *
 * Le mouvement engendré est piloté par la commande. Il naît avec elle, se refait
 * quand on modifie ses articles, disparaît quand elle est annulée ou supprimée.
 * C'est ce qui garantit que le stock décrit ce qui a réellement été vendu.
 */
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { refus, type Refus } from "@/lib/actions/resultat";
import { formatQuantite } from "@/lib/stock";

/** Client Prisma ou transaction : les sorties s'écrivent avec la commande. */
type Db = Prisma.TransactionClient | typeof prisma;

export type LigneVendue = { menuItemId: string; quantity: number };

type SortieAEcrire = {
  productId: string;
  /** Delta signé, donc négatif : c'est ce que le registre attend. */
  quantity: number;
  note: string;
};

/**
 * Les sorties qu'entraîne une liste d'articles vendus, ou le refus qui explique
 * pourquoi la commande ne peut pas être prise.
 *
 * `commandeId` désigne la commande en cours de modification : ses propres sorties
 * sont ignorées dans le calcul du solde, puisqu'elles vont être refaites. Sans
 * cela, remplacer deux Coca par deux Coca se heurterait à un stock qu'on
 * compterait deux fois.
 */
export async function sortiesDeVente(
  lignes: LigneVendue[],
  options: { commandeId?: string } = {}
): Promise<SortieAEcrire[] | Refus> {
  const articles = await prisma.menuItem.findMany({
    where: { id: { in: lignes.map((l) => l.menuItemId) }, productId: { not: null } },
    select: {
      id: true,
      name: true,
      quantiteParVente: true,
      product: { select: { id: true, name: true, unit: true, active: true } },
    },
  });
  if (articles.length === 0) return [];

  // Un même produit peut être vendu par plusieurs articles — un jus tiré du même
  // bidon en 1 L et en petit modèle. C'est le besoin cumulé qui doit tenir dans
  // le stock, pas chaque ligne prise isolément.
  const besoins = new Map<string, { produit: (typeof articles)[number]["product"]; quantite: number }>();
  for (const ligne of lignes) {
    const article = articles.find((a) => a.id === ligne.menuItemId);
    if (!article?.product) continue;
    const besoin = besoins.get(article.product.id);
    const quantite = ligne.quantity * article.quantiteParVente;
    if (besoin) besoin.quantite += quantite;
    else besoins.set(article.product.id, { produit: article.product, quantite });
  }

  const soldes = await prisma.stockMovement.groupBy({
    by: ["productId"],
    where: {
      productId: { in: [...besoins.keys()] },
      // Les sorties de la commande qu'on refait ne comptent pas : elles sont sur
      // le point d'être remplacées par celles qu'on calcule ici. Le cas « sans
      // commande » est écrit à part : `orderId <> x` est faux pour un NULL en
      // SQL, ce qui écarterait du solde tous les achats et sorties saisis à la
      // main — l'essentiel du stock.
      ...(options.commandeId
        ? { OR: [{ orderId: null }, { orderId: { not: options.commandeId } }] }
        : {}),
    },
    _sum: { quantity: true },
  });

  const sorties: SortieAEcrire[] = [];
  for (const { produit, quantite } of besoins.values()) {
    if (!produit) continue;
    if (!produit.active) {
      return refus(`Le produit « ${produit.name} » est désactivé : il ne peut plus être vendu`);
    }
    const disponible = soldes.find((s) => s.productId === produit.id)?._sum.quantity ?? 0;
    if (disponible < quantite) {
      // Le message dit ce qui reste, pas seulement que ça ne passe pas : le
      // caissier a un client devant lui et doit pouvoir proposer autre chose.
      return refus(
        disponible <= 0
          ? `${produit.name} est en rupture de stock.`
          : `Stock insuffisant : il ne reste que ${formatQuantite(disponible, produit.unit)} de ${produit.name}.`
      );
    }
    sorties.push({
      productId: produit.id,
      quantity: -quantite,
      note: `Vendu au client`,
    });
  }

  return sorties;
}

/**
 * Écrit les sorties d'une commande. À appeler dans la transaction qui crée ou
 * met à jour la commande : le stock et la vente doivent tenir ou échouer
 * ensemble.
 *
 * L'auteur est le caissier qui a pris la commande. Une commande passée en ligne
 * n'en a pas : personne ne l'a saisie, et c'est la commande elle-même qui répond
 * du mouvement.
 */
export async function ecrireSortiesDeVente(
  db: Db,
  commandeId: string,
  sorties: SortieAEcrire[],
  auteurId: string | null,
  date: Date
) {
  if (sorties.length === 0) return;
  await db.stockMovement.createMany({
    data: sorties.map((sortie) => ({
      productId: sortie.productId,
      type: "SORTIE" as const,
      quantity: sortie.quantity,
      note: sortie.note,
      orderId: commandeId,
      userId: auteurId,
      date,
    })),
  });
}

/**
 * Rend au stock ce qu'une commande en avait sorti — annulation, ou articles
 * refaits. Les mouvements sont supprimés plutôt que contrebalancés : la vente
 * n'a pas eu lieu, et deux lignes qui s'annulent ne diraient rien de plus au
 * lecteur du registre que leur absence.
 */
export async function annulerSortiesDeVente(db: Db, commandeId: string) {
  await db.stockMovement.deleteMany({ where: { orderId: commandeId } });
}

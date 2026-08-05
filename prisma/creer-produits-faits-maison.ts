// Crée les produits préparés par la maison — jus pressés, thiakry, lakh — les
// approvisionne d'une première production, et relie chaque article du menu au
// produit qu'il vend.
//
// Chaque contenance est un stock distinct : on prépare vingt bouteilles d'un
// litre et vingt petits modèles, comptés séparément parce qu'on les remplit
// séparément. Le produit porte donc le nom exact de l'article, et une vente en
// retire une pièce.
//
// Ces produits n'ont pas de prix d'achat : leurs ingrédients ont déjà été
// achetés et passés en dépense. Leur entrée en stock est une production, jamais
// un achat, sous peine de compter deux fois la même charge.
//
// Le script est rejouable : il ne crée que ce qui manque, ne relie que ce qui ne
// l'est pas, et ne rentre le stock initial que si le produit n'a aucun mouvement
// — relancer ne le gonfle pas.
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

/** Ce que la maison prépare, et la categorie de stock sous laquelle le ranger. */
const FAITS_MAISON: { article: string; categorie: string }[] = [
  { article: "Thiakry", categorie: "Autre" },
  { article: "Lakh", categorie: "Autre" },
  { article: "Jus bissap rouge 1L", categorie: "Boissons" },
  { article: "Jus bissap rouge PM", categorie: "Boissons" },
  { article: "Jus bissap blanc 1L", categorie: "Boissons" },
  { article: "Jus bissap blanc PM", categorie: "Boissons" },
  { article: "Jus bouye 1L", categorie: "Boissons" },
  { article: "Jus bouye PM", categorie: "Boissons" },
  { article: "Jus fraise 1L", categorie: "Boissons" },
  { article: "Jus fraise PM", categorie: "Boissons" },
  { article: "Jus Orange GM", categorie: "Boissons" },
  { article: "Jus orange PM", categorie: "Boissons" },
  { article: "Jus menthe GM", categorie: "Boissons" },
  { article: "Jus menthe PM", categorie: "Boissons" },
];

/** Ce qu'il y a en reserve au moment ou le suivi commence. */
const STOCK_INITIAL = 20;

async function main() {
  const auteur = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!auteur) throw new Error("Aucun administrateur : le mouvement n'aurait pas d'auteur.");

  // Les noms du menu portent parfois un espace de tete ou de fin : on compare
  // sur le nom nettoye, sinon rien ne correspond.
  const articles = await prisma.menuItem.findMany({ select: { id: true, name: true, productId: true } });
  const parNom = new Map(articles.map((a) => [a.name.trim().toLowerCase(), a]));

  let crees = 0;
  let approvisionnes = 0;
  let relies = 0;
  const introuvables: string[] = [];

  for (const { article, categorie } of FAITS_MAISON) {
    const menuItem = parNom.get(article.trim().toLowerCase());
    if (!menuItem) {
      introuvables.push(article);
      continue;
    }

    const nom = article.trim();
    let produit = await prisma.product.findUnique({ where: { name: nom } });
    if (!produit) {
      produit = await prisma.product.create({
        data: { name: nom, unit: "UNITE", category: categorie, faitMaison: true },
      });
      crees += 1;
      console.log(`Produit cree : ${nom} (fait maison)`);
    } else if (!produit.faitMaison) {
      produit = await prisma.product.update({
        where: { id: produit.id },
        data: { faitMaison: true },
      });
      console.log(`Produit existant marque fait maison : ${nom}`);
    }

    // Le stock initial n'entre que dans un produit vierge : relancer le script
    // ne doit pas ajouter vingt bouteilles a chaque passage.
    const mouvements = await prisma.stockMovement.count({ where: { productId: produit.id } });
    if (mouvements === 0) {
      await prisma.stockMovement.create({
        data: {
          productId: produit.id,
          type: "PRODUCTION",
          quantity: STOCK_INITIAL,
          note: "Stock de depart",
          userId: auteur.id,
        },
      });
      approvisionnes += 1;
    }

    if (!menuItem.productId) {
      await prisma.menuItem.update({
        where: { id: menuItem.id },
        data: { productId: produit.id, quantiteParVente: 1 },
      });
      relies += 1;
    }
  }

  if (introuvables.length > 0) {
    console.log(`\nArticles non trouves au menu : ${introuvables.join(", ")}`);
  }
  console.log(
    `\nTermine. ${crees} produit(s) cree(s), ${approvisionnes} approvisionne(s) a ${STOCK_INITIAL}, ${relies} article(s) relie(s).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// Relie les articles revendus tels quels au produit de stock dont ils sortent,
// pour que la vente décompte le stock d'elle-même (voir src/lib/stock-vente.ts).
//
// Deux façons de tenir un stock cohabitent ici :
//   - la pièce, pour ce qui est acheté et revendu à l'identique — une bouteille
//     de Coca, un muffin ;
//   - le litre, pour les jus préparés maison, où le 1L et le petit modèle
//     puisent dans le même bidon. Le PM en retire 0,25 L : c'est ce que dit son
//     prix, le quart de celui du litre.
//
// Le script est rejouable : il retrouve les produits par leur nom et ne crée que
// ce qui manque. Les articles déjà reliés sont laissés tels quels — un lien
// ajusté à la main ne doit pas être écrasé au prochain passage.
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import type { StockUnit } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

type Liaison = {
  /** Nom du produit de stock, créé s'il n'existe pas encore. */
  produit: string;
  unit: StockUnit;
  categorie: string;
  /** Articles du menu qui vendent ce produit, et ce qu'une vente en retire. */
  articles: { article: string; parVente: number }[];
};

const LIAISONS: Liaison[] = [
  // --- Boissons achetées en bouteille : une vente, une pièce.
  { produit: "Coca Cola", unit: "UNITE", categorie: "Boissons", articles: [{ article: "Coca Cola", parVente: 1 }] },
  { produit: "Fanta", unit: "UNITE", categorie: "Boissons", articles: [{ article: "Fanta", parVente: 1 }] },
  { produit: "Sprite", unit: "UNITE", categorie: "Boissons", articles: [{ article: "Sprite", parVente: 1 }] },
  {
    produit: "Eau minérale 1L",
    unit: "UNITE",
    categorie: "Boissons",
    articles: [{ article: "Eau minéral 1L", parVente: 1 }],
  },
  {
    produit: "Eau minérale PM",
    unit: "UNITE",
    categorie: "Boissons",
    articles: [{ article: "Eau minérale PM", parVente: 1 }],
  },

  // --- Jus maison : un bidon par parfum, deux contenances qui y puisent.
  {
    produit: "Jus bissap rouge",
    unit: "LITRE",
    categorie: "Boissons",
    articles: [
      { article: "Jus bissap rouge 1L", parVente: 1 },
      { article: "Jus bissap rouge PM", parVente: 0.25 },
    ],
  },
  {
    produit: "Jus bissap blanc",
    unit: "LITRE",
    categorie: "Boissons",
    articles: [
      { article: "Jus bissap blanc 1L", parVente: 1 },
      { article: "Jus bissap blanc PM", parVente: 0.25 },
    ],
  },
  {
    produit: "Jus bouye",
    unit: "LITRE",
    categorie: "Boissons",
    articles: [
      { article: "Jus bouye 1L", parVente: 1 },
      { article: "Jus bouye PM", parVente: 0.25 },
    ],
  },
  {
    produit: "Jus gingembre",
    unit: "LITRE",
    categorie: "Boissons",
    articles: [
      { article: "Jus gingembre 1L", parVente: 1 },
      { article: "Jus gingembre PM", parVente: 0.25 },
    ],
  },
  // Préparé comme les jus, et vendu au prix du litre : il se compte donc au
  // litre lui aussi, même s'il n'a qu'une contenance à la carte aujourd'hui.
  {
    produit: "Cocktail de fruits",
    unit: "LITRE",
    categorie: "Boissons",
    articles: [{ article: "Cocktail de fruits", parVente: 1 }],
  },

  // --- Gâteries : achetées prêtes, comptées à la pièce.
  { produit: "Cake nature", unit: "UNITE", categorie: "Autre", articles: [{ article: "Cake nature", parVente: 1 }] },
  { produit: "Muffins", unit: "UNITE", categorie: "Autre", articles: [{ article: "Muffins", parVente: 1 }] },
  { produit: "Thiakry", unit: "UNITE", categorie: "Autre", articles: [{ article: "Thiakry", parVente: 1 }] },
  { produit: "Lakh", unit: "UNITE", categorie: "Autre", articles: [{ article: "Lakh", parVente: 1 }] },
  { produit: "Tiramisu", unit: "UNITE", categorie: "Autre", articles: [{ article: "Tiramisu", parVente: 1 }] },
];

// Les articles de « Boissons Naturelles » font doublon avec ceux de « Jus
// locaux » et sont tous indisponibles : les relier créerait des stocks que
// personne n'alimenterait. Leur historique de ventes reste intact.
const CATEGORIES_IGNOREES = ["Boissons Naturelles"];

async function main() {
  // Les noms du menu portent parfois un espace de tête ou de fin (« Fanta »,
  // « Eau minérale PM  ») : on compare sur le nom nettoyé, sinon rien ne matche.
  const articles = await prisma.menuItem.findMany({
    include: { category: { select: { name: true } } },
  });
  const parNom = new Map<string, (typeof articles)[number][]>();
  for (const article of articles) {
    if (CATEGORIES_IGNOREES.includes(article.category.name)) continue;
    const cle = article.name.trim().toLowerCase();
    parNom.set(cle, [...(parNom.get(cle) ?? []), article]);
  }

  let produitsCrees = 0;
  let liens = 0;
  const introuvables: string[] = [];

  for (const liaison of LIAISONS) {
    const cibles = liaison.articles.flatMap(({ article, parVente }) => {
      const trouves = parNom.get(article.trim().toLowerCase());
      if (!trouves?.length) {
        introuvables.push(article);
        return [];
      }
      return trouves.map((menuItem) => ({ menuItem, parVente }));
    });
    if (cibles.length === 0) continue;

    let produit = await prisma.product.findUnique({ where: { name: liaison.produit } });
    if (!produit) {
      produit = await prisma.product.create({
        data: { name: liaison.produit, unit: liaison.unit, category: liaison.categorie },
      });
      produitsCrees += 1;
      console.log(`Produit créé : ${produit.name} (${produit.unit})`);
    }

    for (const { menuItem, parVente } of cibles) {
      if (menuItem.productId) {
        console.log(`  = « ${menuItem.name.trim()} » est déjà relié, laissé tel quel`);
        continue;
      }
      await prisma.menuItem.update({
        where: { id: menuItem.id },
        data: { productId: produit.id, quantiteParVente: parVente },
      });
      liens += 1;
      console.log(`  → « ${menuItem.name.trim()} » retire ${parVente} ${produit.unit} de ${produit.name}`);
    }
  }

  if (introuvables.length > 0) {
    console.log(`\nArticles non trouvés au menu : ${introuvables.join(", ")}`);
  }
  console.log(`\nTerminé. ${produitsCrees} produit(s) créé(s), ${liens} article(s) relié(s).`);
  console.log("Les stocks sont à zéro : saisissez un achat par produit dans /stock.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

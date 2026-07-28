import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

// Nom exact du plat (tel qu'en base) -> chemin de la vraie photo dans /public/dishes
const imageByName: Record<string, string> = {
  "Boisson gazeuse coca cola": "/dishes/boisson-coca-cola.jpg",
  "Boisson gazeuse fanta": "/dishes/boisson-fanta.png",
  "Boisson gazeuse sprite": "/dishes/boisson-sprite.jpg",
  "Cocktail de fruits": "/dishes/cocktail-fruits.jpg",
  "Jus de bissap grand format": "/dishes/bissap-naturel.jpg",
  "Jus de bissap petit format": "/dishes/bissap-naturel.jpg",
  "Jus de bouye grand format": "/dishes/jus-bouye.jpg",
  "Jus de bouye petit format": "/dishes/jus-bouye.jpg",
  "Jus de gingembre grand format": "/dishes/jus-gingembre.jpeg",
  "Jus de gingembre petit format": "/dishes/jus-gingembre.jpeg",
  Lakh: "/dishes/lakh.jpg",
  Nems: "/dishes/nems.webp",
  Rissoles: "/dishes/rissoles.jpg",
  Burger: "/dishes/burger.jpg",
  Chawarma: "/dishes/chawarma.webp",
  Fataya: "/dishes/fataya.webp",
  "Fataya complet": "/dishes/fataya.webp",
  "Fataya simple": "/dishes/fataya.webp",
  "Hot dogs": "/dishes/hot-dogs.jpg",
  "Mini pizza": "/dishes/mini-pizza.webp",
  Tacos: "/dishes/tacos.jpg",
  "Amir bœuf": "/dishes/amir-boeuf.webp",
  "Amir mixte": "/dishes/amir-mixte.webp",
  "Amir poulet": "/dishes/amir-poulet.jpeg",
  "Amir poulet pané": "/dishes/amir-poulet-pane.avif",
  Beefsteak: "/dishes/steak-frites.jpg",
  "Couscous poulet": "/dishes/couscous-poulet.webp",
  "Couscous yapp": "/dishes/couscous-yapp.webp",
  "Demi poulet": "/dishes/demi-poulet.jpeg",
  "Domoda boulette poisson": "/dishes/domoda-boulette-poisson.jpg",
  "Domoda boulette viande": "/dishes/domoda-boulette-viande.png",
  "Domoda poisson": "/dishes/domoda-poisson.jpg",
  "Domoda viande": "/dishes/domoda-viande.jpg",
  Firire: "/dishes/firire.jpg",
  Kaldou: "/dishes/kaldou.jpg",
  "Mbakhalou saloum": "/dishes/mbakhalou-saloum.jpg",
  "Soupe kandja": "/dishes/soupe-kandja.jpg",
  "Soupe yapp": "/dishes/soupe-yapp.jpg",
  "Thiebou djeun blanc": "/dishes/thiebou-djeun-blanc.avif",
  "Thiebou djeun diaga": "/dishes/thiebou-djeun-diaga.webp",
  "Thiebou djeun rouge": "/dishes/thiebou-djeun-rouge.webp",
  "Thiebou yapp boeuf": "/dishes/thiebou-yapp-boeuf.jpg",
  "Thiebou yapp poulet": "/dishes/thiebou-yapp-poulet.jpg",
  Thiou: "/dishes/thiou.jpg",
  "Thiéré poisson": "/dishes/thiere-poisson.webp",
  "Thiéré yapp": "/dishes/thiere-yapp.webp",
  "Vermicelle poulet": "/dishes/vermicelle-poulet.jpg",
  "Vermicelle yapp": "/dishes/vermicelle-yapp.webp",
  "Yassa poisson": "/dishes/yassa-poisson.jpg",
  "Yassa poulet": "/dishes/yassa-poulet-item.jpg",
};

async function main() {
  const allItems = await prisma.menuItem.findMany({
    select: { id: true, name: true },
  });
  const byLowerName = new Map(allItems.map((i) => [i.name.toLowerCase(), i]));

  let updated = 0;
  for (const [name, imageUrl] of Object.entries(imageByName)) {
    let result = await prisma.menuItem.updateMany({
      where: { name },
      data: { imageUrl },
    });
    if (result.count === 0) {
      // Repli : correspondance insensible à la casse (utile si la casse
      // en base diffère légèrement du nom attendu). SQLite ne supporte pas
      // `mode: "insensitive"`, donc on compare côté JS.
      const match = byLowerName.get(name.toLowerCase());
      if (match) {
        result = await prisma.menuItem.updateMany({
          where: { id: match.id },
          data: { imageUrl },
        });
      }
    }
    if (result.count > 0) {
      updated += result.count;
      console.log(`OK  ${name} -> ${imageUrl} (${result.count})`);
    } else {
      console.log(`--  ${name} : aucun item trouvé avec ce nom`);
    }
  }
  console.log(`Terminé. ${updated} item(s) mis à jour.`);

  const remaining = await prisma.menuItem.findMany({
    where: { imageUrl: null },
    select: { name: true },
  });
  if (remaining.length > 0) {
    console.log("Items sans image :");
    for (const item of remaining) console.log(`  - ${item.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

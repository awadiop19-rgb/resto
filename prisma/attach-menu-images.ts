/**
 * Associe à chaque plat du menu sa photo dans /public/dishes.
 *
 * La correspondance est explicite (nom du plat -> fichier) et non devinée : les
 * noms en base contiennent des espaces parasites, des accents et des variantes de
 * casse. Le rapprochement est donc insensible à la casse, aux accents et aux
 * espaces de bord.
 *
 * Idempotent : relancer le script ne change que ce qui diffère.
 *
 * Local       : npx tsx prisma/attach-menu-images.ts
 * Production  : DATABASE_URL=file:/data/dev.db npx tsx prisma/attach-menu-images.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const imageByName: Record<string, string> = {
  // ---- Boissons ----
  "Coca Cola": "/dishes/boisson-coca-cola.jpg",
  Fanta: "/dishes/boisson-fanta.png",
  Sprite: "/dishes/boisson-sprite.jpg",
  "Cocktail de fruits": "/dishes/cocktail-fruits.jpg",
  "Eau minéral 1L": "/dishes/eau-minerale.png",
  "Eau minérale PM": "/dishes/eau-minerale.png",

  // ---- Boissons Naturelles ----
  "Jus de bissap rouge 1L": "/dishes/jus-bissap-rouge-1l.webp",
  "Jus de bissap rouge PM": "/dishes/jus-bissap-rouge-pm.webp",
  "Jus de bouye 1L": "/dishes/jus-bouye-1l.webp",
  "Jus de bouye PM": "/dishes/jus-bouye-pm.webp",
  "Jus de gingembre 1L": "/dishes/jus-gingembre.jpeg",

  // ---- Jus locaux ----
  "Jus bissap blanc 1L": "/dishes/jus-bissap-blanc-1l.webp",
  "Jus bissap blanc PM": "/dishes/jus-bissap-blanc-pm.webp",
  "Jus bissap rouge 1L": "/dishes/jus-bissap-rouge-1l.webp",
  "Jus bissap rouge PM": "/dishes/jus-bissap-rouge-pm.webp",
  "Jus bouye 1L": "/dishes/jus-bouye-1l.webp",
  "Jus bouye PM": "/dishes/jus-bouye-pm.webp",
  "Jus gingembre 1L": "/dishes/jus-gingembre.jpeg",
  "Jus gingembre PM": "/dishes/jus-gingembre.jpeg",

  // ---- Entrées ----
  Nems: "/dishes/nems.webp",
  Pastels: "/dishes/pastels.jpg",
  Rissoles: "/dishes/rissoles.jpg",

  // ---- Desserts ----
  Lakh: "/dishes/lakh.jpg",
  Thiakry: "/dishes/thiakry.jpg",

  // ---- Fast-Food ----
  Burger: "/dishes/burger.jpg",
  Chawarma: "/dishes/chawarma.webp",
  Fataya: "/dishes/fataya.webp",
  "Fataya complet": "/dishes/fataya.webp",
  "Fataya simple": "/dishes/fataya.webp",
  "Hot dogs": "/dishes/hot-dogs.jpg",
  "Mini pizza": "/dishes/mini-pizza.webp",
  Tacos: "/dishes/tacos.jpg",

  // ---- Nos Spécialités ----
  "Amir bœuf": "/dishes/amir-boeuf.webp",
  "Amir mixte": "/dishes/amir-mixte.webp",
  "Amir poulet": "/dishes/amir-poulet.jpeg",
  "Amir poulet pané": "/dishes/amir-poulet-pane.avif",

  // ---- Plats ----
  Beefsteak: "/dishes/steak-frites.jpg",
  "Steak Frites": "/dishes/steak-frites.jpg",
  "Couscous poulet": "/dishes/couscous-poulet.webp",
  "Couscous yapp": "/dishes/couscous-yapp.webp",
  "Demi poulet": "/dishes/demi-poulet.jpeg",
  "Domoda boulette poisson": "/dishes/domoda-boulette-poisson.jpg",
  "Domoda boulette viande": "/dishes/domoda-boulette-viande.png",
  "Domoda poisson": "/dishes/domoda-poisson.jpg",
  "Domoda viande": "/dishes/domoda-viande.jpg",
  Firire: "/dishes/firire.jpg",
  Kaldou: "/dishes/kaldou.jpg",
  Mafé: "/dishes/mafe.webp",
  "Mbakhalou saloum": "/dishes/mbakhalou-saloum.jpg",
  "Poulet Yassa": "/dishes/yassa-poulet-plat.jpg",
  "Soupe kandja": "/dishes/soupe-kandja.jpg",
  "Soupe yapp": "/dishes/soupe-yapp.jpg",
  "Thiebou djeun diaga": "/dishes/thiebou-djeun-diaga.webp",
  "Thiebou djeun rouge": "/dishes/thiebou-djeun-rouge.webp",
  "Thiebou guinar (poulet)": "/dishes/thiebou-yapp-poulet.jpg",
  Thiéboudieune: "/dishes/thiebou-djeun-rouge.webp",
  Thiou: "/dishes/thiou.jpg",
  "Thiéré poisson": "/dishes/thiere-poisson.webp",
  "Thiéré yapp / guinar": "/dishes/thiere-yapp.webp",
  "Vermicelle poulet": "/dishes/vermicelle-poulet.jpg",
  "Vermicelle yapp": "/dishes/vermicelle-yapp.webp",
  "Yassa poisson": "/dishes/yassa-poisson.jpg",
  "Yassa poulet": "/dishes/yassa-poulet-item.jpg",
};

/** Ignore casse, accents, ligature œ et espaces de bord. */
function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/gi, "oe")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function main() {
  const items = await prisma.menuItem.findMany({ select: { id: true, name: true, imageUrl: true } });

  const byNormalized = new Map<string, typeof items>();
  for (const item of items) {
    const key = normalize(item.name);
    byNormalized.set(key, [...(byNormalized.get(key) ?? []), item]);
  }

  let modifies = 0;
  let inchanges = 0;
  const sansCorrespondance: string[] = [];

  for (const [name, imageUrl] of Object.entries(imageByName)) {
    const matches = byNormalized.get(normalize(name));
    if (!matches || matches.length === 0) {
      sansCorrespondance.push(name);
      continue;
    }
    for (const item of matches) {
      if (item.imageUrl === imageUrl) {
        inchanges++;
        continue;
      }
      await prisma.menuItem.update({ where: { id: item.id }, data: { imageUrl } });
      modifies++;
      console.log(`MAJ  ${item.name.padEnd(28)} ${item.imageUrl ?? "(aucune)"} -> ${imageUrl}`);
    }
  }

  console.log(`\n${modifies} plat(s) mis à jour, ${inchanges} déjà à jour.`);

  if (sansCorrespondance.length > 0) {
    console.log("\nEntrées du mapping sans plat correspondant en base :");
    for (const name of sansCorrespondance) console.log(`  - ${name}`);
  }

  const restants = await prisma.menuItem.findMany({
    where: { imageUrl: null },
    select: { name: true, category: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  if (restants.length > 0) {
    console.log(`\n${restants.length} plat(s) toujours sans photo :`);
    for (const item of restants) console.log(`  - [${item.category.name}] ${item.name}`);
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

// Fusionne les items de menu en doublon qui ne diffèrent que par des espaces
// de début/fin dans le nom (ex: "Lakh" et "Lakh "). Conserve l'item "propre"
// (sans espace) comme référence, réaffecte les commandes existantes vers lui,
// récupère son image si l'un des doublons en avait une, puis supprime le(s)
// doublon(s).
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const allItems = await prisma.menuItem.findMany({
    orderBy: { createdAt: "asc" },
  });

  const groups = new Map<string, typeof allItems>();
  for (const item of allItems) {
    const key = item.name.trim().toLowerCase();
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  let mergedGroups = 0;
  let deletedItems = 0;

  for (const [key, group] of groups) {
    if (group.length < 2) continue;

    const canonical =
      group.find((item) => item.name === item.name.trim()) ?? group[0];
    const duplicates = group.filter((item) => item.id !== canonical.id);

    console.log(`Doublon détecté pour "${key}" : garde "${canonical.name}" (${canonical.id})`);

    for (const duplicate of duplicates) {
      if (!canonical.imageUrl && duplicate.imageUrl) {
        await prisma.menuItem.update({
          where: { id: canonical.id },
          data: { imageUrl: duplicate.imageUrl },
        });
        canonical.imageUrl = duplicate.imageUrl;
        console.log(`  -> image récupérée depuis "${duplicate.name}" (${duplicate.id})`);
      }

      const reassigned = await prisma.orderItem.updateMany({
        where: { menuItemId: duplicate.id },
        data: { menuItemId: canonical.id },
      });
      if (reassigned.count > 0) {
        console.log(`  -> ${reassigned.count} ligne(s) de commande réaffectée(s)`);
      }

      await prisma.menuItem.delete({ where: { id: duplicate.id } });
      deletedItems += 1;
      console.log(`  -> supprimé "${duplicate.name}" (${duplicate.id})`);
    }

    mergedGroups += 1;
  }

  console.log(`Terminé. ${mergedGroups} groupe(s) fusionné(s), ${deletedItems} doublon(s) supprimé(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * Rapatrie la base de production dans `dev.db`, pour travailler sur des données
 * réelles sans toucher au serveur.
 *
 * La copie passe par un `VACUUM INTO` exécuté sur la machine : copier le fichier
 * pendant que l'application écrit dedans donnerait un instantané incohérent, le
 * journal WAL restant de côté. La base locale existante est sauvegardée avant
 * d'être remplacée, jamais écrasée en silence.
 *
 * Lecture seule côté production : rien n'y est modifié, seul un fichier
 * temporaire y est créé puis supprimé.
 *
 *   npx tsx prisma/copier-bd-prod.ts
 */
import { execFileSync } from "node:child_process";
import { existsSync, renameSync, statSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const APP = "resto-saveuramir";
const DISTANT = "/data/_snapshot.db";
const LOCAL = "dev.db";

/** flyctl n'est pas toujours dans le PATH : son emplacement d'installation sert de repli. */
function flyctl() {
  const candidats = [
    "flyctl",
    path.join(homedir(), ".fly", "bin", process.platform === "win32" ? "flyctl.exe" : "flyctl"),
  ];
  for (const candidat of candidats) {
    try {
      execFileSync(candidat, ["version"], { stdio: "ignore" });
      return candidat;
    } catch {
      continue;
    }
  }
  throw new Error("flyctl introuvable : installez-le ou ajoutez-le au PATH.");
}

/**
 * `flyctl ssh` sort parfois en code 1 alors que la commande distante a réussi
 * (« The handle is invalid » à la fermeture du canal sous Windows). On récupère
 * donc la sortie sans se fier au code de retour : la réussite se vérifie plus
 * loin sur le résultat lui-même.
 */
function fly(bin: string, args: string[]) {
  try {
    return execFileSync(bin, [...args, "-a", APP], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (erreur) {
    const sortie = (erreur as { stdout?: string }).stdout;
    if (typeof sortie === "string") return sortie;
    throw erreur;
  }
}

const bin = flyctl();

console.log("Instantané de la base de production…");
// Le VACUUM lit la base ouverte et écrit une copie cohérente à côté.
const script = [
  "const fs=require('fs');",
  "const db=require('better-sqlite3')('/data/dev.db',{readonly:true});",
  `try{fs.unlinkSync('${DISTANT}')}catch(e){}`,
  `db.exec("VACUUM INTO '${DISTANT}'");`,
  `console.log(fs.statSync('${DISTANT}').size)`,
].join("");
const sortie = fly(bin, ["ssh", "console", "-C", `node -e ${JSON.stringify(script)}`]);
const octets = Number(sortie.trim().split(/\s+/).pop());
if (!Number.isFinite(octets) || octets <= 0) {
  throw new Error(`Instantané distant non créé. Sortie de flyctl :\n${sortie}`);
}
console.log(`  ${octets} octets`);

// La base locale peut contenir des essais en cours : on la met de côté, datée.
if (existsSync(LOCAL)) {
  const horodatage = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const sauvegarde = `${LOCAL}.avant-${horodatage}`;
  renameSync(LOCAL, sauvegarde);
  console.log(`Base locale sauvegardée : ${sauvegarde}`);
}
// Les fichiers annexes décrivent l'ancienne base : les garder la corromprait.
for (const annexe of [`${LOCAL}-journal`, `${LOCAL}-wal`, `${LOCAL}-shm`]) {
  if (existsSync(annexe)) unlinkSync(annexe);
}

console.log("Téléchargement…");
fly(bin, ["ssh", "sftp", "get", DISTANT, `./${LOCAL}`]);
// Le code de retour de flyctl n'est pas fiable ici : c'est la taille du fichier
// reçu qui atteste du transfert.
if (!existsSync(LOCAL) || statSync(LOCAL).size !== octets) {
  throw new Error(
    `Transfert incomplet : ${existsSync(LOCAL) ? statSync(LOCAL).size : 0} octets reçus sur ${octets}.`
  );
}

console.log("Nettoyage du serveur…");
fly(bin, ["ssh", "console", "-C", `rm -f ${DISTANT}`]);

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:./${LOCAL}` }) });

async function controler() {
  const [{ integrity_check }] = await prisma.$queryRawUnsafe<{ integrity_check: string }[]>(
    "PRAGMA integrity_check"
  );
  if (integrity_check !== "ok") throw new Error("La copie est corrompue : ne l'utilisez pas.");

  console.log(`\n${LOCAL} — ${statSync(LOCAL).size} octets, intègre.`);
  const compte = {
    User: await prisma.user.count(),
    MenuItem: await prisma.menuItem.count(),
    Order: await prisma.order.count(),
    Payment: await prisma.payment.count(),
    Product: await prisma.product.count(),
    StockMovement: await prisma.stockMovement.count(),
    Expense: await prisma.expense.count(),
  };
  for (const [table, n] of Object.entries(compte)) console.log(`  ${table.padEnd(15)} ${n}`);

  console.log(
    "\nRappel : cette base contient des données clients réelles. Elle reste locale (dev.db est ignoré par git)."
  );
}

controler().finally(() => prisma.$disconnect());

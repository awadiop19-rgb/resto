import { prisma } from "@/lib/prisma";
import {
  completerHoraires,
  jourISO,
  messageFermeture,
  type Fermeture,
  type Reglages,
} from "@/lib/horaires";

/**
 * Lecture en base des reglages d'ouverture.
 *
 * Separee de `horaires.ts`, qui reste pur : la page de reglage est un composant
 * client, et un import de Prisma dans le meme module entrainerait
 * `better-sqlite3` jusque dans le paquet du navigateur.
 */
export async function getReglages(): Promise<Reglages> {
  const [horaires, fermetures] = await Promise.all([
    prisma.openingHour.findMany(),
    // Les fermetures passees ne pesent pas sur la decision : seules celles qui
    // courent encore sont lues. La page de reglage, elle, les demande toutes.
    prisma.exceptionalClosure.findMany({
      where: { endDate: { gte: jourISO(new Date()) } },
      orderBy: { startDate: "asc" },
    }),
  ]);

  return {
    horaires: completerHoraires(
      horaires.map((h) => ({
        weekday: h.weekday,
        closed: h.closed,
        opensAt: h.opensAt,
        closesAt: h.closesAt,
      })),
    ),
    fermetures: fermetures.map(versFermeture),
  };
}

function versFermeture(f: {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
}): Fermeture {
  return { id: f.id, startDate: f.startDate, endDate: f.endDate, reason: f.reason };
}

/** Toutes les fermetures, passees comprises — pour la page de reglage. */
export async function getToutesFermetures(): Promise<Fermeture[]> {
  const fermetures = await prisma.exceptionalClosure.findMany({
    orderBy: { startDate: "desc" },
  });
  return fermetures.map(versFermeture);
}

/**
 * Barriere serveur de la commande en ligne : renvoie le motif du refus, ou
 * `null` si la voie est libre. L'interface se ferme d'elle-meme, mais une action
 * serveur reste joignable par un POST direct : c'est ici que la fermeture est
 * reellement tenue.
 */
export async function blocageCommandeEnLigne(maintenant = new Date()) {
  return messageFermeture(await getReglages(), maintenant);
}

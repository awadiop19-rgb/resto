import { prisma } from "@/lib/prisma";
import type { QuartierOption } from "@/lib/quartiers";

// Accès base uniquement : les helpers réutilisés côté navigateur vivent dans
// `quartiers.ts`, pour ne pas embarquer Prisma dans le bundle client.
export type { QuartierOption };

/**
 * Quartiers proposables à la commande : uniquement ceux des zones actives.
 * Désactiver une zone suspend donc la livraison sur tous ses quartiers.
 */
export async function getQuartiersLivrables(): Promise<QuartierOption[]> {
  const quartiers = await prisma.quartier.findMany({
    where: { zone: { active: true } },
    include: { zone: { select: { name: true, fee: true } } },
    orderBy: [{ zone: { name: "asc" } }, { name: "asc" }],
  });

  return quartiers.map((q) => ({
    id: q.id,
    name: q.name,
    zoneName: q.zone.name,
    fee: q.zone.fee,
  }));
}

/**
 * Tarif applicable à un quartier, lu en base au moment de la commande.
 * Le montant retourné est ensuite figé sur la commande.
 */
export async function tarifDuQuartier(quartierId: string) {
  const quartier = await prisma.quartier.findUnique({
    where: { id: quartierId },
    include: { zone: true },
  });
  if (!quartier) throw new Error("Quartier introuvable");
  if (!quartier.zone.active) {
    throw new Error(`Nous ne livrons pas actuellement à ${quartier.name}`);
  }
  return { fee: quartier.zone.fee, quartier };
}

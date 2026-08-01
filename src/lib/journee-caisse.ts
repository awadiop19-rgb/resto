import { differenceInCalendarDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/client";

/**
 * Heure de bascule de la journée d'exploitation.
 *
 * Un service qui se termine après minuit appartient encore à la journée de la
 * veille. Sans ce décalage, un caissier encore en poste à 00h30 serait considéré
 * en retard et bloqué en plein service.
 */
export const HEURE_DEBUT_JOURNEE = 6;

/** Début de la journée d'exploitation en cours. */
export function debutJourneeExploitation(maintenant = new Date()) {
  const debut = new Date(maintenant);
  debut.setHours(HEURE_DEBUT_JOURNEE, 0, 0, 0);
  if (maintenant < debut) debut.setDate(debut.getDate() - 1);
  return debut;
}

/**
 * Bornes de la journée d'exploitation d'une date : 6h ce jour-là → 6h le lendemain.
 * Une commande prise à 00h30 appartient donc au service de la veille, comme la
 * caisse qui l'encaisse.
 */
export function borneJournee(date: Date) {
  const debut = new Date(date);
  debut.setHours(HEURE_DEBUT_JOURNEE, 0, 0, 0);
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + 1);
  return { debut, fin };
}

/** Seuls ces rôles peuvent détenir une caisse, donc être en retard de clôture. */
function peutTenirUneCaisse(role: Role) {
  return role === "CAISSIER" || role === "ADMIN";
}

export type CaisseEnRetard = Awaited<ReturnType<typeof getCaissesNonFermees>>[number];

/**
 * Caisses laissées ouvertes sur une journée d'exploitation antérieure.
 * La caisse du jour en cours n'en fait jamais partie : elle est normale.
 */
export async function getCaissesNonFermees(userId: string) {
  const caisses = await prisma.cashRegister.findMany({
    where: {
      cashierId: userId,
      status: "OUVERTE",
      openedAt: { lt: debutJourneeExploitation() },
    },
    include: {
      payments: { select: { amount: true, method: true } },
      expenses: { select: { amount: true } },
    },
    orderBy: { openedAt: "asc" },
  });

  const maintenant = new Date();

  return caisses.map((caisse) => {
    const totalCash = caisse.payments
      .filter((p) => p.method === "CASH")
      .reduce((s, p) => s + p.amount, 0);
    const totalWave = caisse.payments
      .filter((p) => p.method === "WAVE")
      .reduce((s, p) => s + p.amount, 0);
    // Ce qui est sorti du tiroir pour une dépense n'y est plus : sans cette
    // déduction, le rattrapage réclamerait des espèces déjà dépensées.
    const sorties = caisse.expenses.reduce((s, e) => s + e.amount, 0);
    return {
      id: caisse.id,
      openedAt: caisse.openedAt,
      openingFloat: caisse.openingFloat,
      nombrePaiements: caisse.payments.length,
      totalCash,
      totalWave,
      sorties,
      especesAttendues: caisse.openingFloat + totalCash - sorties,
      jourLabel: format(caisse.openedAt, "EEEE d MMMM yyyy", { locale: fr }),
      // Calculé côté serveur : l'heure du poste client ne fait pas foi.
      joursEcoules: Math.max(1, differenceInCalendarDays(maintenant, caisse.openedAt)),
    };
  });
}

export function messageBlocage(caisses: { jourLabel: string }[]) {
  const jours = caisses.map((c) => c.jourLabel).join(", ");
  return `Caisse non clôturée du ${jours}. Clôturez-la avant de reprendre votre service.`;
}

/**
 * Barrière serveur : un caissier en retard de clôture ne peut plus travailler.
 * Seule la clôture de la caisse en retard reste possible.
 *
 * Renvoie le motif du blocage, ou `null` si la voie est libre. Un message rendu
 * plutôt que levé : voir `@/lib/actions/resultat`.
 */
export async function blocageCaisse(userId: string, role: Role) {
  if (!peutTenirUneCaisse(role)) return null;

  const retard = await getCaissesNonFermees(userId);
  return retard.length > 0 ? messageBlocage(retard) : null;
}

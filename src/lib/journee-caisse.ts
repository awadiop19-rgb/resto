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
    include: { payments: { select: { amount: true, method: true } } },
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
    return {
      id: caisse.id,
      openedAt: caisse.openedAt,
      openingFloat: caisse.openingFloat,
      nombrePaiements: caisse.payments.length,
      totalCash,
      totalWave,
      especesAttendues: caisse.openingFloat + totalCash,
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
 */
export async function assertCaisseAJour(userId: string, role: Role) {
  if (!peutTenirUneCaisse(role)) return;

  const retard = await getCaissesNonFermees(userId);
  if (retard.length > 0) throw new Error(messageBlocage(retard));
}

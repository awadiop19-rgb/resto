"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { premierMessage, refus } from "@/lib/actions/resultat";
import { MINUTES_PAR_JOUR, NOMS_JOURS } from "@/lib/horaires";

const horaireSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    closed: z.boolean(),
    opensAt: z.number().int().min(0).max(MINUTES_PAR_JOUR - 1),
    closesAt: z.number().int().min(0).max(MINUTES_PAR_JOUR),
  })
  // Une fermeture placee avant l'ouverture donnerait une plage vide : le jour
  // paraitrait ouvert dans le reglage et refuserait toutes les commandes. Le
  // service ne franchit pas minuit, la contrainte peut donc rester stricte.
  .refine((h) => h.closed || h.closesAt > h.opensAt, {
    message: "L'heure de fermeture doit suivre l'heure d'ouverture",
  });

const enregistrerSchema = z.object({
  horaires: z.array(horaireSchema).length(7, "Les sept jours sont attendus"),
});

/**
 * Enregistre la semaine entiere d'un coup.
 *
 * Les sept jours sont ecrits ensemble plutot qu'un a un : la page se lit comme
 * une semaine, et un enregistrement partiel laisserait des jours anciens a cote
 * de jours neufs sans que rien ne le signale a l'ecran.
 */
async function exigerAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN") throw new Error("Non autorisé");
  return session;
}

export async function enregistrerHoraires(input: z.infer<typeof enregistrerSchema>) {
  const session = await exigerAdmin();

  const parsed = enregistrerSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));

  const jours = parsed.data.horaires.map((h) => h.weekday);
  if (new Set(jours).size !== 7) return refus("Chaque jour doit apparaître une seule fois");

  const invalide = parsed.data.horaires.find((h) => !h.closed && h.closesAt <= h.opensAt);
  if (invalide) {
    return refus(`${NOMS_JOURS[invalide.weekday]} : la fermeture doit suivre l'ouverture`);
  }

  await prisma.$transaction(
    parsed.data.horaires.map((h) =>
      prisma.openingHour.upsert({
        where: { weekday: h.weekday },
        create: { ...h, updatedById: session.user.id },
        update: { ...h, updatedById: session.user.id },
      }),
    ),
  );

  rafraichir();
  return { ok: true as const };
}

/**
 * La page publique lit ces reglages pour s'ouvrir ou se fermer : sans cela, un
 * changement ne se verrait qu'au prochain rendu.
 */
function rafraichir() {
  revalidatePath("/horaires");
  revalidatePath("/commander");
  revalidatePath("/");
}

const JOUR_ISO = /^\d{4}-\d{2}-\d{2}$/;

const fermetureSchema = z
  .object({
    startDate: z.string().regex(JOUR_ISO, "Date de début invalide"),
    endDate: z.string().regex(JOUR_ISO, "Date de fin invalide"),
    reason: z.string().trim().max(120).optional(),
  })
  // Dates ISO : leur ordre alphabetique est leur ordre chronologique.
  .refine((f) => f.endDate >= f.startDate, {
    message: "La date de fin doit suivre la date de début",
    path: ["endDate"],
  });

/**
 * Declare une fermeture exceptionnelle — jour ferie, conges, fermeture technique.
 *
 * Une date passee reste acceptee : on ferme parfois apres coup, et refuser la
 * saisie ne rouvrirait pas le restaurant pour autant.
 */
export async function ajouterFermeture(input: z.infer<typeof fermetureSchema>) {
  const session = await exigerAdmin();

  const parsed = fermetureSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const { startDate, endDate, reason } = parsed.data;

  // Deux fermetures qui se chevauchent ne changeraient rien au resultat, mais
  // donneraient deux lignes a supprimer pour rouvrir un meme jour.
  const chevauche = await prisma.exceptionalClosure.findFirst({
    where: { startDate: { lte: endDate }, endDate: { gte: startDate } },
  });
  if (chevauche) {
    return refus(
      `Une fermeture couvre déjà cette période (du ${chevauche.startDate} au ${chevauche.endDate}). Supprimez-la d'abord.`,
    );
  }

  await prisma.exceptionalClosure.create({
    data: { startDate, endDate, reason: reason || null, createdById: session.user.id },
  });

  rafraichir();
  return { ok: true as const };
}

export async function supprimerFermeture(id: string) {
  await exigerAdmin();
  await prisma.exceptionalClosure.deleteMany({ where: { id } });
  rafraichir();
  return { ok: true as const };
}

"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { premierMessage, refus } from "@/lib/actions/resultat";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") throw new Error("Non autorisé");
  return session;
}

function revalider() {
  revalidatePath("/livraisons/zones");
  revalidatePath("/commander");
  revalidatePath("/commandes");
}

const zoneSchema = z.object({
  name: z.string().trim().min(1, "Nom de zone requis").max(60),
  fee: z.number().min(0, "Le tarif ne peut pas être négatif"),
});

export async function creerZone(input: z.infer<typeof zoneSchema>) {
  await requireAdmin();
  const parsed = zoneSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const data = parsed.data;

  const existante = await prisma.deliveryZone.findUnique({ where: { name: data.name } });
  if (existante) return refus("Une zone porte déjà ce nom");

  await prisma.deliveryZone.create({ data });
  revalider();
}

export async function modifierZone(id: string, input: z.infer<typeof zoneSchema>) {
  await requireAdmin();
  const parsed = zoneSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const data = parsed.data;

  const doublon = await prisma.deliveryZone.findFirst({
    where: { name: data.name, NOT: { id } },
  });
  if (doublon) return refus("Une zone porte déjà ce nom");

  await prisma.deliveryZone.update({ where: { id }, data });
  revalider();
}

export async function activerZone(id: string, active: boolean) {
  await requireAdmin();
  await prisma.deliveryZone.update({ where: { id }, data: { active } });
  revalider();
}

export async function supprimerZone(id: string) {
  await requireAdmin();

  const quartiers = await prisma.quartier.count({ where: { zoneId: id } });
  if (quartiers > 0) {
    return refus(
      "Cette zone contient encore des quartiers. Déplacez-les ou supprimez-les d'abord.",
    );
  }

  await prisma.deliveryZone.delete({ where: { id } });
  revalider();
}

const quartierSchema = z.object({
  name: z.string().trim().min(1, "Nom du quartier requis").max(80),
  zoneId: z.string().min(1, "Choisissez une zone"),
});

export async function creerQuartier(input: z.infer<typeof quartierSchema>) {
  await requireAdmin();
  const parsed = quartierSchema.safeParse(input);
  if (!parsed.success) return refus(premierMessage(parsed.error));
  const data = parsed.data;

  const zone = await prisma.deliveryZone.findUnique({ where: { id: data.zoneId } });
  if (!zone) return refus("Zone introuvable");

  const existant = await prisma.quartier.findUnique({ where: { name: data.name } });
  if (existant) {
    return refus("Ce quartier est déjà rattaché à une zone");
  }

  await prisma.quartier.create({ data });
  revalider();
}

/** Déplacer un quartier d'une zone à l'autre en change le tarif pour les futures commandes. */
export async function deplacerQuartier(id: string, zoneId: string) {
  await requireAdmin();

  const zone = await prisma.deliveryZone.findUnique({ where: { id: zoneId } });
  if (!zone) return refus("Zone introuvable");

  await prisma.quartier.update({ where: { id }, data: { zoneId } });
  revalider();
}

export async function supprimerQuartier(id: string) {
  await requireAdmin();

  // Les commandes gardent leur quartier en référence : le supprimer les casserait.
  const commandes = await prisma.order.count({ where: { quartierId: id } });
  if (commandes > 0) {
    return refus(
      `Impossible de supprimer : ${commandes} commande(s) ont été livrées dans ce quartier.`,
    );
  }

  await prisma.quartier.delete({ where: { id } });
  revalider();
}

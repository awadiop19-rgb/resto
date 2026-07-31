"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { normaliserReference } from "@/lib/reference-commande";

const declarationSchema = z.object({
  reference: z.string().min(1),
  waveReference: z.string().trim().max(60).optional(),
});

/**
 * Le client signale avoir payé par Wave depuis le site.
 *
 * Action volontairement publique : le client n'a pas de compte. Elle ne marque
 * PAS la commande comme encaissée — elle pose un drapeau que la caisse voit,
 * pour qu'elle vérifie la réception dans Wave puis encaisse réellement. Une
 * fausse déclaration ne fait donc entrer aucune commande dans le circuit.
 */
export async function declarerPaiementWave(input: z.infer<typeof declarationSchema>) {
  const data = declarationSchema.parse(input);
  const reference = normaliserReference(data.reference);

  const commande = await prisma.order.findUnique({
    where: { reference },
    select: { id: true, payment: { select: { id: true } }, status: true },
  });
  if (!commande) throw new Error("Commande introuvable");
  if (commande.status === "ANNULEE") throw new Error("Cette commande a été annulée");
  if (commande.payment) throw new Error("Cette commande est déjà réglée");

  await prisma.order.update({
    where: { id: commande.id },
    data: {
      waveDeclaredAt: new Date(),
      waveReference: data.waveReference?.trim() || null,
    },
  });

  revalidatePath("/caisse");
  revalidatePath("/suivi");
}

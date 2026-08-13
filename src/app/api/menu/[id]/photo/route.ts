import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { enregistrerPhoto, supprimerPhoto } from "@/lib/photos-menu-fichiers";

/**
 * Envoi et retrait de la photo d'un article du menu.
 *
 * Une route plutôt qu'une action serveur : les actions sont plafonnées à 1 Mo de
 * corps de requête, ce qu'une photo de téléphone dépasse toujours. Le plafond
 * réel est celui de `enregistrerPhoto`, annoncé au comptoir avant l'envoi.
 *
 * Le comptoir tient la carte à jour parce qu'il est devant : c'est lui qui voit
 * le plat sortir de cuisine et qui entend le client demander à quoi il ressemble.
 * Il ne touche ni au prix ni à la composition — la photo seule.
 */
const ROLES_AUTORISES = ["ADMIN", "CAISSIER"];

async function autoriser() {
  const session = await auth();
  if (!session?.user) return { erreur: "Non authentifié", statut: 401 as const };
  if (!ROLES_AUTORISES.includes(session.user.role)) {
    return { erreur: "Non autorisé", statut: 403 as const };
  }
  return null;
}

/** Les pages qui montrent la carte en images, publiques comme internes. */
function rafraichirLesCartes() {
  revalidatePath("/");
  revalidatePath("/menu");
  revalidatePath("/menu/photos");
  revalidatePath("/commandes");
}

export async function POST(requete: Request, contexte: { params: Promise<{ id: string }> }) {
  const refus = await autoriser();
  if (refus) return Response.json({ erreur: refus.erreur }, { status: refus.statut });

  const { id } = await contexte.params;
  const article = await prisma.menuItem.findUnique({
    where: { id },
    select: { id: true, imageUrl: true },
  });
  if (!article) return Response.json({ erreur: "Article introuvable" }, { status: 404 });

  const formulaire = await requete.formData().catch(() => null);
  const fichier = formulaire?.get("photo");
  if (!(fichier instanceof File)) {
    return Response.json({ erreur: "Aucune photo reçue" }, { status: 400 });
  }

  const photo = await enregistrerPhoto(fichier);
  if ("erreur" in photo) return Response.json({ erreur: photo.erreur }, { status: 400 });

  await prisma.menuItem.update({ where: { id }, data: { imageUrl: photo.url } });

  // L'ancienne n'est effacée qu'une fois la nouvelle en base : si la mise à jour
  // échouait, l'article pointerait vers un fichier qui n'existe plus.
  await supprimerPhoto(article.imageUrl);

  rafraichirLesCartes();
  return Response.json(photo);
}

export async function DELETE(_requete: Request, contexte: { params: Promise<{ id: string }> }) {
  const refus = await autoriser();
  if (refus) return Response.json({ erreur: refus.erreur }, { status: refus.statut });

  const { id } = await contexte.params;
  const article = await prisma.menuItem.findUnique({
    where: { id },
    select: { id: true, imageUrl: true },
  });
  if (!article) return Response.json({ erreur: "Article introuvable" }, { status: 404 });

  await prisma.menuItem.update({ where: { id }, data: { imageUrl: null } });
  await supprimerPhoto(article.imageUrl);

  rafraichirLesCartes();
  return Response.json({ url: null });
}

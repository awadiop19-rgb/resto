import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/page-container";
import { PhotosManager } from "./photos-manager";
import { COTE_MAX, TAILLE_MAX_OCTETS, formatOctets } from "@/lib/photos-menu";

export const dynamic = "force-dynamic";

/**
 * Les photos de la carte, tenues depuis le comptoir.
 *
 * L'écran ne montre que ce qui touche à l'image : ni prix, ni disponibilité, ni
 * suivi de stock — tout cela reste sur /menu, à l'administration. Le caissier
 * photographie le plat et l'envoie, c'est tout ce qu'il a à faire ici.
 */
export default async function PhotosMenuPage() {
  const categories = await prisma.menuCategory.findMany({
    include: {
      items: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, imageUrl: true, available: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Photos du menu</h1>
          <p className="text-sm text-slate-500">
            Une photo par plat, telle qu&apos;elle apparaît sur la carte en ligne et sur la tablette de
            prise de commande. {formatOctets(TAILLE_MAX_OCTETS)} au maximum par fichier : chaque
            photo est ensuite réduite à {COTE_MAX} px et recompressée par le serveur, pour que la
            carte reste rapide à charger.
          </p>
        </div>

        <PhotosManager categories={categories} />
      </div>
    </PageContainer>
  );
}

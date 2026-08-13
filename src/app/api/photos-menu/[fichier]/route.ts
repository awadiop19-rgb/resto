import { lirePhoto } from "@/lib/photos-menu-fichiers";

/**
 * Sert une photo du menu depuis le volume.
 *
 * Elle ne peut pas être servie en statique : elle est écrite après le build, sur
 * un disque que Next ne connaît pas. Cette route est publique — la carte du
 * restaurant l'est aussi, et une photo de thiéboudiène ne se protège pas.
 *
 * Le cache est définitif parce que le nom l'est : changer la photo d'un plat
 * écrit un nouveau fichier sous un nouveau nom, jamais le même sous l'ancien.
 */
export async function GET(_requete: Request, contexte: { params: Promise<{ fichier: string }> }) {
  const { fichier } = await contexte.params;
  const octets = await lirePhoto(fichier);
  if (!octets) return new Response("Photo introuvable", { status: 404 });

  return new Response(new Uint8Array(octets), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(octets.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

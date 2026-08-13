import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { refus, type Refus } from "@/lib/actions/resultat";
import {
  COTE_MAX,
  NOM_FICHIER,
  PREFIXE_PHOTOS,
  QUALITE_WEBP,
  TAILLE_MAX_OCTETS,
  formatOctets,
} from "@/lib/photos-menu";

/**
 * Les photos du menu sur le disque, et le travail fait dessus à l'arrivée.
 *
 * Elles ne vont pas dans `public/` : ce dossier est figé dans l'image Docker au
 * build, et tout ce qu'on y déposerait en production disparaîtrait au prochain
 * déploiement. Elles vont sur le volume, à côté de la base — le seul endroit de
 * la machine qui survit à un redéploiement, et le seul qui soit sauvegardé.
 */
function dossierPhotos() {
  return process.env.PHOTOS_MENU_DIR ?? path.join(process.cwd(), "photos-menu");
}

/** Nom de fichier → chemin, en refusant tout nom que nous n'avons pas écrit. */
function cheminPhoto(nom: string) {
  if (!NOM_FICHIER.test(nom)) return null;
  return path.join(dossierPhotos(), nom);
}

/**
 * Recompresse la photo reçue : orientation redressée, côté long ramené à
 * `COTE_MAX`, sortie en WebP.
 *
 * `rotate()` sans argument applique l'orientation EXIF puis l'efface. Sans lui,
 * une photo prise en tenant le téléphone de travers s'afficherait couchée sur la
 * carte : le capteur enregistre toujours dans le même sens et note la rotation à
 * part, et cette note se perd à la recompression.
 *
 * L'agrandissement est interdit : une petite image reste petite plutôt que de
 * devenir une grande image floue et lourde.
 */
async function normaliser(entree: Buffer) {
  const { data, info } = await sharp(entree, { failOn: "error" })
    .rotate()
    .resize({ width: COTE_MAX, height: COTE_MAX, fit: "inside", withoutEnlargement: true })
    .webp({ quality: QUALITE_WEBP })
    .toBuffer({ resolveWithObject: true });

  return { octets: data, largeur: info.width, hauteur: info.height };
}

export type PhotoEnregistree = {
  url: string;
  /** Poids du fichier reçu, et poids de celui qui a été gardé. */
  tailleOrigine: number;
  taille: number;
  largeur: number;
  hauteur: number;
};

/**
 * Vérifie, recompresse et écrit la photo. Rend l'URL à ranger dans `imageUrl`.
 *
 * Le nom est tiré au sort à chaque envoi, jamais dérivé de l'article : la photo
 * est ainsi servie avec un cache définitif, et remplacer celle d'un plat ne
 * laisse pas les navigateurs afficher l'ancienne pendant une semaine.
 */
export async function enregistrerPhoto(fichier: File): Promise<PhotoEnregistree | Refus> {
  if (fichier.size === 0) return refus("Fichier vide");
  if (fichier.size > TAILLE_MAX_OCTETS) {
    return refus(
      `Photo trop lourde (${formatOctets(fichier.size)}) : ${formatOctets(TAILLE_MAX_OCTETS)} au maximum.`
    );
  }

  const entree = Buffer.from(await fichier.arrayBuffer());

  // Le type annoncé par le navigateur ne prouve rien : c'est le décodage qui
  // tranche. Un PDF renommé en .jpg échoue ici, et nulle part ailleurs.
  let photo;
  try {
    photo = await normaliser(entree);
  } catch {
    return refus("Fichier illisible : envoyez une photo (JPEG, PNG ou WebP).");
  }

  const nom = `${randomUUID()}.webp`;
  await mkdir(dossierPhotos(), { recursive: true });
  await writeFile(path.join(dossierPhotos(), nom), photo.octets);

  return {
    url: `${PREFIXE_PHOTOS}${nom}`,
    tailleOrigine: fichier.size,
    taille: photo.octets.byteLength,
    largeur: photo.largeur,
    hauteur: photo.hauteur,
  };
}

/**
 * Efface le fichier d'une photo remplacée ou retirée.
 *
 * Ne touche qu'aux photos envoyées depuis l'application : les images livrées
 * avec le site (`/dishes/…`) appartiennent au dépôt, et un article qui en porte
 * encore une doit pouvoir y revenir. Un fichier déjà absent n'est pas une
 * erreur — le but est qu'il ne soit plus là.
 */
export async function supprimerPhoto(url: string | null) {
  if (!url?.startsWith(PREFIXE_PHOTOS)) return;
  const chemin = cheminPhoto(url.slice(PREFIXE_PHOTOS.length));
  if (!chemin) return;
  await unlink(chemin).catch(() => {});
}

/** Contenu d'une photo, ou `null` si ce nom ne désigne rien chez nous. */
export async function lirePhoto(nom: string) {
  const chemin = cheminPhoto(nom);
  if (!chemin) return null;
  return readFile(chemin).catch(() => null);
}

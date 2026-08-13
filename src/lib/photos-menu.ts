/**
 * Ce qu'une photo de plat a le droit d'être.
 *
 * Les valeurs vivent ici, sans dépendance à Node : le comptoir s'en sert pour
 * refuser un fichier trop lourd avant de l'envoyer — inutile de pousser 12 Mo
 * sur une connexion de téléphone pour se faire répondre non — et le serveur pour
 * refuser pour de bon, car un contrôle fait dans le navigateur n'engage personne.
 *
 * La photo reçue n'est jamais stockée telle quelle : elle est recompressée en
 * WebP et ramenée à `COTE_MAX`. Un appareil moderne sort du 4000 px et 5 Mo pour
 * une vignette qui s'affiche sur 400 px ; c'est la page publique du restaurant
 * qui paierait la différence, et le disque du serveur avec.
 */

/** Poids maximal du fichier envoyé, avant recompression. */
export const TAILLE_MAX_OCTETS = 8 * 1024 * 1024;

/** Côté le plus long de la photo enregistrée, en pixels. */
export const COTE_MAX = 1200;

/** Qualité WebP : au-delà, le poids grimpe sans que l'œil y gagne. */
export const QUALITE_WEBP = 78;

/**
 * Ce que le sélecteur de fichier propose. La vérification sérieuse du format se
 * fait au décodage, côté serveur : une extension ne prouve rien.
 */
export const TYPES_ACCEPTES = "image/*";

/** Préfixe des photos servies par l'application, par opposition à `/dishes/…`. */
export const PREFIXE_PHOTOS = "/api/photos-menu/";

/** Un nom de fichier écrit par nous, et rien d'autre : pas de `../` en chemin. */
export const NOM_FICHIER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

/** « 3,4 Mo », « 812 Ko » — pour dire au caissier ce qu'il vient d'envoyer. */
export function formatOctets(octets: number) {
  if (octets >= 1024 * 1024) return `${(octets / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
  return `${Math.max(1, Math.round(octets / 1024))} Ko`;
}

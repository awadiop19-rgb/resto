import { randomInt } from "node:crypto";

/**
 * Alphabet sans les caractères qui se confondent quand on lit un code au
 * téléphone : ni 0/O, ni 1/I/L.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LONGUEUR = 6;

/**
 * Référence publique d'une commande, tirée au hasard.
 *
 * Un numéro séquentiel se devine : il suffirait d'essayer 1, 2, 3… pour lire le
 * nom, le téléphone et l'adresse de tous les clients. Avec 31^6 combinaisons,
 * une référence ne se trouve pas par tâtonnement.
 */
export function genererReference() {
  let reference = "";
  for (let i = 0; i < LONGUEUR; i++) {
    reference += ALPHABET[randomInt(ALPHABET.length)];
  }
  return reference;
}

/** Normalise une saisie client : espaces, tirets et minuscules sont tolérés. */
export function normaliserReference(saisie: string) {
  return saisie.replace(/[\s-]/g, "").toUpperCase();
}

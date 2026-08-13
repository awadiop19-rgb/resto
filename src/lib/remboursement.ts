/**
 * D'ou sort l'argent rendu au client quand la comptabilite annule une commande
 * deja encaissee.
 *
 * Module sans acces base : l'ecran annonce la poche avant de valider, l'action
 * serveur la determine a nouveau — c'est elle qui fait foi.
 *
 * Le paiement d'origine n'est jamais efface. Sa recette a ete comptee le jour ou
 * elle a eu lieu, souvent versee et verifiee depuis ; la reecrire creuserait
 * dans un versement clos un ecart que plus personne ne pourrait expliquer.
 * L'argent ressort donc au jour ou il est rendu, comme toute sortie de caisse.
 */

/** Categorie des depenses nees d'un remboursement, et d'elles seules. */
export const CATEGORIE_REMBOURSEMENT = "Remboursement client";

export type PocheRemboursement = "TIROIR" | "COFFRE" | "WAVE";

/**
 * La poche ne se choisit pas, elle se constate : on ne peut rendre l'argent que
 * la ou il se trouve.
 *
 * Tant que la caisse qui a encaisse n'est pas versee, les especes sont dans son
 * tiroir et nulle part ailleurs — les faire sortir du coffre lui ferait payer un
 * argent qu'il n'a pas encore recu, et le versement du soir arriverait ensuite
 * en trop. Une fois la caisse versee, c'est le coffre qui les detient. Un
 * paiement Wave, lui, n'a jamais touche de tiroir.
 */
export function pocheDuRemboursement(
  method: "CASH" | "WAVE",
  caisseEncoreOuverte: boolean
): PocheRemboursement {
  if (method === "WAVE") return "WAVE";
  return caisseEncoreOuverte ? "TIROIR" : "COFFRE";
}

export const POCHE_LABELS: Record<PocheRemboursement, string> = {
  TIROIR: "le tiroir du caissier, qui ne l'a pas encore versé",
  COFFRE: "les espèces du coffre",
  WAVE: "le compte Wave",
};

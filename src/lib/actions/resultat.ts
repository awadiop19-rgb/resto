/**
 * Comment une action serveur refuse une opération.
 *
 * Dans un build de production, Next.js masque le message des erreurs *levées*
 * par une action serveur : le client ne reçoit qu'un texte générique et un
 * digest. « Ouvrez votre caisse avant d'encaisser » devient alors illisible.
 * Seule une valeur de retour traverse la frontière intacte, donc un refus
 * attendu se retourne, il ne se lève pas.
 *
 * `throw` reste réservé à ce qui ne doit jamais arriver depuis l'interface —
 * défaut d'autorisation en tête : là, masquer le détail est souhaitable.
 */
export type Refus = { erreur: string };

export function refus(message: string): Refus {
  return { erreur: message };
}

function estRefus(valeur: unknown): valeur is Refus {
  return typeof valeur === "object" && valeur !== null && "erreur" in valeur;
}

/**
 * Côté client : retransforme un refus en exception, là où le `catch` qui affiche
 * le message se trouve déjà. Les appels gardent leur forme habituelle.
 */
export function assurerSucces<T>(resultat: T | Refus): T {
  if (estRefus(resultat)) throw new Error(resultat.erreur);
  return resultat;
}

/**
 * Premier message d'un échec de validation Zod, en clair. `parse` lèverait une
 * ZodError dont le message serait masqué comme les autres.
 */
export function premierMessage(erreur: { issues: { message: string }[] }) {
  return erreur.issues[0]?.message ?? "Données invalides";
}

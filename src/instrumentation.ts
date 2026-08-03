/**
 * Le serveur travaille en GMT, quel que soit le fuseau de la machine qui
 * l'exécute.
 *
 * Le restaurant est à Dakar, qui est à GMT toute l'année : c'est donc le fuseau
 * du métier, et celui dans lequel les dates saisies au jour (`<input
 * type="date">`) sont déjà enregistrées. Sans cette contrainte, `startOfMonth`
 * ou `startOfDay` se caleraient sur l'horloge du serveur : une machine de
 * développement à GMT−4 ferait basculer le 1er du mois dans le mois précédent,
 * et les totaux différeraient de ceux de la production.
 *
 * `register` s'exécute une fois, avant la première requête. Écrire dans
 * `process.env.TZ` reconfigure l'horloge du processus (Node ≥ 16) : toutes les
 * dates créées ensuite sont lues en GMT. Le conteneur pose déjà `TZ` de son
 * côté — ceci couvre le développement local et rend la règle explicite dans le
 * code plutôt que cachée dans une image.
 */
export function register() {
  process.env.TZ = "UTC";
}

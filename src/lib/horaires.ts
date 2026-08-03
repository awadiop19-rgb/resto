/**
 * Heures d'ouverture de la commande en ligne.
 *
 * Le restaurant sert de 8h a 23h du lundi au samedi. Passe cette plage, le site
 * public continue d'afficher la carte — on ne cache pas un menu parce qu'il est
 * tard — mais il n'accepte plus de commande : personne en cuisine ne la verrait
 * avant le lendemain, et le client attendrait un appel qui ne viendrait pas.
 *
 * Rien ici ne touche au service en salle. Un client attable a 23h30 doit
 * toujours pouvoir etre encaisse, et un caissier saisir sa commande.
 *
 * L'heure lue est celle du serveur, fixe a GMT — le fuseau de Dakar (voir
 * `fly.toml`). L'horloge du visiteur ne fait jamais foi : elle est reglable, et
 * un telephone mal regle ouvrirait la commande a une heure ou personne
 * n'attend derriere.
 *
 * Donnees et calculs purs, sans acces base : la page de reglage est un composant
 * client, et importer Prisma ici entrainerait `better-sqlite3` dans le paquet du
 * navigateur. La lecture en base vit dans `horaires-data.ts`.
 */

/** Minutes ecoulees depuis minuit, la forme sous laquelle les heures sont stockees. */
export const MINUTES_PAR_JOUR = 24 * 60;

export type Horaire = {
  /** 0 = dimanche … 6 = samedi, comme `Date.getDay()`. */
  weekday: number;
  closed: boolean;
  opensAt: number;
  closesAt: number;
};

/** Du lundi au samedi, 8h – 23h. Le dimanche est ferme. */
export const HORAIRES_PAR_DEFAUT: Horaire[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  closed: weekday === 0,
  opensAt: 8 * 60,
  closesAt: 23 * 60,
}));

export const NOMS_JOURS = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
] as const;

/** L'ordre d'affichage commence au lundi : une semaine de restaurant finit le dimanche. */
export const JOURS_AFFICHES = [1, 2, 3, 4, 5, 6, 0] as const;

/** `510` → `08:30`. */
export function formatHeure(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** `08:30` → `510`, ou `null` si la saisie n'est pas une heure du jour. */
export function parseHeure(valeur: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(valeur.trim());
  if (!m) return null;
  const heures = Number(m[1]);
  const minutes = Number(m[2]);
  if (heures > 23 || minutes > 59) return null;
  return heures * 60 + minutes;
}

/**
 * Complete les jours absents par leur valeur par defaut.
 *
 * La table est vide tant que personne n'a ouvert la page de reglage : un
 * restaurant sans horaire enregistre doit rester ouvert aux heures habituelles,
 * pas refuser toutes les commandes.
 */
export function completerHoraires(enregistres: Horaire[]): Horaire[] {
  return HORAIRES_PAR_DEFAUT.map(
    (defaut) => enregistres.find((h) => h.weekday === defaut.weekday) ?? defaut,
  );
}

function horaireDuJour(horaires: Horaire[], jour: number) {
  return horaires.find((h) => h.weekday === jour) ?? HORAIRES_PAR_DEFAUT[jour];
}

function minutesDeLaJournee(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Le jour de calendrier d'une date, en `YYYY-MM-DD`, tel que le lit le serveur.
 *
 * Construit a la main plutot que par `toISOString()`, qui convertit d'abord en
 * UTC : un 15 aout a 01h deviendrait le 14 sur un serveur en avance, et la
 * fermeture sauterait d'un jour.
 */
export function jourISO(date: Date) {
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mois}-${jour}`;
}

/** Une fermeture exceptionnelle : jour ferie, conges, fermeture technique. */
export type Fermeture = {
  id: string;
  /** Bornes incluses, en `YYYY-MM-DD`. */
  startDate: string;
  endDate: string;
  reason: string | null;
};

/**
 * Les deux reglages vont toujours ensemble : une grille hebdomadaire seule
 * repondrait « ouvert » un jour de Tabaski. Les passer d'un bloc rend l'oubli
 * impossible plutot que seulement improbable.
 */
export type Reglages = { horaires: Horaire[]; fermetures: Fermeture[] };

/** La fermeture exceptionnelle couvrant ce jour, s'il y en a une. */
export function fermetureDuJour(fermetures: Fermeture[], date: Date) {
  const jour = jourISO(date);
  // Les bornes sont des dates ISO : leur ordre alphabetique est leur ordre
  // chronologique, la comparaison de texte suffit donc.
  return fermetures.find((f) => f.startDate <= jour && jour <= f.endDate) ?? null;
}

/** Sommes-nous dans la plage d'ouverture ? La minute de fermeture est exclue : a 23h00 pile, c'est ferme. */
export function estOuvert({ horaires, fermetures }: Reglages, maintenant = new Date()) {
  // La fermeture exceptionnelle prime : elle est decidee expressement pour ce
  // jour-la, la grille hebdomadaire ne fait que decrire l'ordinaire.
  if (fermetureDuJour(fermetures, maintenant)) return false;

  const jour = horaireDuJour(horaires, maintenant.getDay());
  if (jour.closed) return false;
  const minutes = minutesDeLaJournee(maintenant);
  return minutes >= jour.opensAt && minutes < jour.closesAt;
}

/**
 * Combien de jours en avant `prochaineOuverture` accepte de chercher.
 *
 * Une semaine suffisait tant que seule la grille hebdomadaire fermait ; des
 * conges annuels durent davantage. Au-dela de deux mois, c'est que le restaurant
 * ferme pour de bon, et aucune date n'est a promettre.
 */
const HORIZON_JOURS = 62;

/**
 * Prochain moment ou la commande rouvre, pour l'annoncer au client plutot que de
 * le laisser revenir au hasard.
 */
export function prochaineOuverture(
  { horaires, fermetures }: Reglages,
  maintenant = new Date(),
): Date | null {
  for (let dans = 0; dans < HORIZON_JOURS; dans++) {
    const date = new Date(maintenant);
    date.setDate(date.getDate() + dans);
    if (fermetureDuJour(fermetures, date)) continue;

    const jour = horaireDuJour(horaires, date.getDay());
    if (jour.closed) continue;
    // Aujourd'hui ne compte que si l'ouverture est encore devant nous.
    if (dans === 0 && minutesDeLaJournee(maintenant) >= jour.opensAt) continue;
    date.setHours(Math.floor(jour.opensAt / 60), jour.opensAt % 60, 0, 0);
    return date;
  }
  return null;
}

/**
 * La semaine en quelques lignes : les jours qui se suivent et se ressemblent
 * sont reunis en une plage.
 *
 * Sept lignes identiques dans un pied de page se lisent moins bien qu'un
 * « Lundi – Samedi 08:00 – 23:00 » : l'oeil y voit la regle au lieu de la
 * reconstituer. Le regroupement suit l'ordre d'affichage, du lundi au dimanche,
 * et ne saute pas par-dessus un jour different.
 */
export function resumerSemaine(horaires: Horaire[]) {
  const lignes: { libelle: string; heures: string; jours: number[] }[] = [];

  for (const weekday of JOURS_AFFICHES) {
    const jour = horaireDuJour(horaires, weekday);
    const heures = jour.closed
      ? "Fermé"
      : `${formatHeure(jour.opensAt)} – ${formatHeure(jour.closesAt)}`;

    const precedente = lignes[lignes.length - 1];
    if (precedente && precedente.heures === heures) {
      precedente.jours.push(weekday);
      const premier = NOMS_JOURS[precedente.jours[0]];
      precedente.libelle = `${premier} – ${NOMS_JOURS[weekday]}`;
    } else {
      lignes.push({ libelle: NOMS_JOURS[weekday], heures, jours: [weekday] });
    }
  }

  return lignes;
}

const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

/** `2026-08-15` → `samedi 15 août`. */
export function formatJour(iso: string) {
  const [annee, mois, jour] = iso.split("-").map(Number);
  const date = new Date(annee, mois - 1, jour);
  return `${NOMS_JOURS[date.getDay()].toLowerCase()} ${jour} ${MOIS[mois - 1]}`;
}

/** `2026-08-15` → `15/08/2026`, pour les listes ou la date compte plus que le jour. */
export function formatJourCourt(iso: string) {
  const [annee, mois, jour] = iso.split("-");
  return `${jour}/${mois}/${annee}`;
}

/** « lundi a 08:00 », « demain a 08:00 », « a 08:00 » — selon la distance. */
function quand(ouverture: Date, maintenant: Date) {
  const jourMeme = ouverture.toDateString() === maintenant.toDateString();
  if (jourMeme) return `à ${formatHeure(minutesDeLaJournee(ouverture))}`;

  const demain = new Date(maintenant);
  demain.setDate(demain.getDate() + 1);
  if (ouverture.toDateString() === demain.toDateString()) {
    return `demain à ${formatHeure(minutesDeLaJournee(ouverture))}`;
  }

  // Au-dela d'une semaine, le seul nom du jour devient ambigu : « mardi » ne dit
  // pas lequel. La date entiere prend alors le relais.
  const joursDEcart = Math.round(
    (new Date(ouverture).setHours(0, 0, 0, 0) - new Date(maintenant).setHours(0, 0, 0, 0)) /
      86_400_000,
  );
  const jour =
    joursDEcart < 7
      ? NOMS_JOURS[ouverture.getDay()].toLowerCase()
      : `le ${formatJour(jourISO(ouverture))}`;
  return `${jour} à ${formatHeure(minutesDeLaJournee(ouverture))}`;
}

/**
 * Message affiche au client quand la commande est fermee, ou `null` si elle est
 * ouverte. Rendu plutot que leve : voir `@/lib/actions/resultat`.
 */
export function messageFermeture(reglages: Reglages, maintenant = new Date()) {
  if (estOuvert(reglages, maintenant)) return null;

  const ouverture = prochaineOuverture(reglages, maintenant);
  const reprise = ouverture
    ? ` Nous rouvrons ${quand(ouverture, maintenant)}.`
    : " Appelez-nous au +221 71 150 81 22.";

  // Une fermeture exceptionnelle se nomme : « fermé pour le moment » un jour de
  // Tabaski laisserait croire a un oubli d'horaire ou a une panne.
  const exceptionnelle = fermetureDuJour(reglages.fermetures, maintenant);
  if (exceptionnelle) {
    const motif = exceptionnelle.reason?.trim();
    return `Nous sommes exceptionnellement fermés${motif ? ` — ${motif}` : ""}.${reprise}`;
  }

  return `La commande en ligne est fermée pour le moment.${reprise}`;
}

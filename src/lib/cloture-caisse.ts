import { especesDisponibles } from "@/lib/depenses-caisse";
import { formatFCFA } from "@/lib/format";

/**
 * Contrôles de cohérence d'une clôture de caisse.
 *
 * Module sans accès à la base : le formulaire du comptoir applique les mêmes
 * règles avant l'envoi, l'action serveur reste la seule qui fasse foi.
 *
 * Ils naissent du versement du 4 août 2026, où un caissier a déclaré le total
 * encaissé (espèces + Wave) au lieu des espèces du tiroir, en justifiant l'écart
 * par une note qui ne faisait que répéter le montant. Rien ne l'a arrêté.
 */

/** En deçà, une note ne raconte rien — un montant recopié, un mot jeté. */
export const LONGUEUR_MINIMALE_MOTIF = 10;

/** Chiffres, ponctuation et symboles monétaires : ce qui reste ne dit rien. */
const CARACTERES_SANS_EXPLICATION = /[\d\s.,;:!?'’"+\-–—/()]|fcfa|cfa|f/gi;

type Cloture = {
  /** Espèces comptées dans le tiroir par le caissier. */
  declaredAmount: number;
  openingFloat: number;
  totalCash: number;
  /** Encaissements Wave : jamais dans le tiroir, ils ne se comptent pas. */
  totalWave: number;
  /** Espèces sorties du tiroir pour des dépenses courantes. */
  sorties: number;
};

/**
 * Montants qui trahissent un total encaissé recopié à la place du comptage.
 *
 * Deux formes selon que le caissier a pensé ou non à déduire ses dépenses. Sans
 * Wave sur le service, aucune des deux ne se distingue de l'attendu : la règle
 * ne s'applique pas.
 */
function montantsAvecWaveInclus({ openingFloat, totalCash, totalWave, sorties }: Cloture) {
  if (totalWave <= 0) return [];
  const attendu = especesDisponibles({ openingFloat, totalCash, sorties });
  return [attendu + totalWave, attendu + totalWave + sorties];
}

/**
 * Motif de refus de la clôture, ou `null` si elle peut aboutir.
 *
 * L'ordre compte : on nomme d'abord l'erreur qu'on sait reconnaître, sans quoi
 * le caissier irait justifier dans la note un écart qui n'existe pas.
 */
export function refusCloture(cloture: Cloture, note?: string | null) {
  const { declaredAmount, openingFloat, totalCash, totalWave, sorties } = cloture;
  const attendu = especesDisponibles({ openingFloat, totalCash, sorties });

  // Un tiroir qui contient au franc près l'attendu plus le Wave du service,
  // ce n'est pas une coïncidence : c'est la saisie qui est fausse.
  if (montantsAvecWaveInclus(cloture).includes(declaredAmount)) {
    return (
      `Les ${formatFCFA(totalWave)} encaissés sur Wave ne sont pas dans le tiroir : ` +
      `ne comptez que les espèces. Vous devriez trouver ${formatFCFA(attendu)}.`
    );
  }

  const difference = declaredAmount - attendu;
  if (difference === 0) return null;

  const motif = (note ?? "").trim();
  if (!motif) {
    return "Un écart de caisse a été constaté : indiquez son motif dans la note";
  }
  if (motif.replace(CARACTERES_SANS_EXPLICATION, "").length === 0) {
    return "La note doit expliquer l'écart, pas recopier un montant : dites ce qui s'est passé.";
  }
  if (motif.length < LONGUEUR_MINIMALE_MOTIF) {
    return `Détaillez le motif de l'écart en quelques mots (${LONGUEUR_MINIMALE_MOTIF} caractères au moins).`;
  }
  return null;
}

/**
 * Excédent qui ressemble au total Wave sans lui être égal : un simple soupçon,
 * signalé au caissier avant qu'il ne valide, jamais opposé à lui. Une erreur de
 * rendu de monnaie le même soir suffirait à décaler le compte de quelques francs
 * et bloquer là-dessus fermerait la caisse à personne.
 */
export function excedentRessembleAuWave(cloture: Cloture) {
  const { declaredAmount, openingFloat, totalCash, totalWave, sorties } = cloture;
  if (totalWave <= 0) return false;
  const difference = declaredAmount - especesDisponibles({ openingFloat, totalCash, sorties });
  if (difference <= 0) return false;
  return Math.abs(difference - totalWave) <= totalWave * 0.1 + sorties;
}

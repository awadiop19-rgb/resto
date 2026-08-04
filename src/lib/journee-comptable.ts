import { differenceInCalendarDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { debutJourneeExploitation } from "@/lib/journee-caisse";
import { totalCommande } from "@/lib/total-commande";

/**
 * Vue comptable de la journée d'exploitation en cours.
 *
 * La comptabilité ne voit habituellement que les caisses clôturées (voir
 * `getComptabilite`) : tant qu'un caissier n'a pas versé, son activité est
 * invisible. Ce module comble ce trou en exposant, caissier par caissier, ce qui
 * est encaissé mais pas encore remis, et ce qui reste à encaisser.
 *
 * Les montants qui en sortent sont indicatifs et ne constituent pas une recette :
 * seule la clôture d'une caisse fait foi. Rien ici n'écrit en base.
 */

/** Un encaissement, tel qu'il apparaît dans le détail d'une caisse. */
export type EncaissementLigne = {
  id: string;
  paidAt: Date;
  method: "CASH" | "WAVE";
  amount: number;
  reference: string | null;
  tableNumber: number | null;
  customerName: string | null;
  type: "SUR_PLACE" | "A_EMPORTER" | "LIVRAISON";
  /** Renseignée si la comptabilité a rectifié le mode saisi par le caissier. */
  correction: {
    modeOrigine: "CASH" | "WAVE";
    motif: string | null;
    auteur: string | null;
    date: Date;
  } | null;
};

export type CaisseJournee = {
  id: string;
  ouverte: boolean;
  openedAt: Date;
  closedAt: Date | null;
  openingFloat: number;
  nombreEncaissements: number;
  totalCash: number;
  totalWave: number;
  total: number;
  /**
   * Part encaissée pendant la journée en cours. Diffère du total pour une caisse
   * ouverte depuis un service antérieur : son contenu est toujours en circulation,
   * mais il n'a pas été encaissé aujourd'hui et ne doit pas gonfler le flux du jour.
   */
  totalDuJour: number;
  nombreDuJour: number;
  /** Ce que le tiroir devrait contenir : fond + espèces encaissées − sorties. */
  especesEnTiroir: number;
  /** Espèces sorties du tiroir pour des dépenses courantes pendant le service. */
  sortiesCaisse: number;
  depensesCaisse: { id: string; label: string; category: string; amount: number; date: Date }[];
  /** Ouverte lors d'un service antérieur : son jour d'ouverture doit être affiché. */
  ouverteAvantLaJournee: boolean;
  /** Caisse restée ouverte sur une journée antérieure : à relancer. */
  enRetard: boolean;
  joursEcoules: number;
  jourLabel: string;
  // Renseignés à la clôture seulement.
  declaredAmount: number | null;
  expectedCash: number | null;
  difference: number | null;
  /** Montant retenu par la comptabilité : la correction prime sur la déclaration. */
  retenu: number | null;
  corrected: boolean;
  note: string | null;
  encaissements: EncaissementLigne[];
};

export type CaissierJournee = {
  cashierId: string;
  cashierName: string;
  caisses: CaisseJournee[];
  nombreEncaissements: number;
  totalCash: number;
  totalWave: number;
  total: number;
  /** Espèces encaissées sur des caisses encore ouvertes : pas encore remises. */
  especesEnAttente: number;
  especesEnTiroir: number;
  aUneCaisseOuverte: boolean;
  aUneCaisseEnRetard: boolean;
};

/** Une commande retirée de la journée par la comptabilité, avec sa justification. */
export type CommandeAnnulee = {
  id: string;
  createdAt: Date;
  cancelledAt: Date;
  reference: string | null;
  tableNumber: number | null;
  customerName: string | null;
  type: "SUR_PLACE" | "A_EMPORTER" | "LIVRAISON";
  source: "INTERNE" | "EN_LIGNE";
  montant: number;
  motif: string | null;
  /** `null` si le compte a été supprimé depuis : le motif, lui, demeure. */
  auteur: string | null;
};

export type CommandeAEncaisser = {
  id: string;
  createdAt: Date;
  reference: string | null;
  tableNumber: number | null;
  customerName: string | null;
  type: "SUR_PLACE" | "A_EMPORTER" | "LIVRAISON";
  source: "INTERNE" | "EN_LIGNE";
  status: string;
  montant: number;
  /** Le client dit avoir payé par Wave : la caisse doit vérifier puis encaisser. */
  waveDeclaredAt: Date | null;
  waveReference: string | null;
};

export type JourneeComptable = Awaited<ReturnType<typeof getJourneeComptable>>;

export async function getJourneeComptable() {
  const debut = debutJourneeExploitation();
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + 1);

  const [caissesBrutes, impayees, nombreImpayeesAnterieures, plusAncienneImpayee, annulees] =
    await Promise.all([
      // Trois familles de caisses concernent la journée. Un service qui déborde
      // sur le lendemain est fréquent : s'en tenir à la date d'ouverture ferait
      // disparaître de la vue un versement pourtant reçu aujourd'hui.
      prisma.cashRegister.findMany({
        where: {
          OR: [
            // Ouverte aujourd'hui, quel que soit son sort.
            { openedAt: { gte: debut, lt: fin } },
            // Ouverte plus tôt et toujours pas clôturée : l'argent circule encore.
            { status: "OUVERTE", openedAt: { lt: debut } },
            // Ouverte plus tôt mais versée aujourd'hui : la recette arrive ce jour.
            { status: "FERMEE", closedAt: { gte: debut, lt: fin } },
          ],
        },
        include: {
          cashier: { select: { id: true, name: true } },
          expenses: { select: { id: true, label: true, category: true, amount: true, date: true } },
          payments: {
            include: {
              methodCorrectedBy: { select: { name: true } },
              order: {
                select: {
                  reference: true,
                  tableNumber: true,
                  customerName: true,
                  type: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { openedAt: "asc" },
      }),
      prisma.order.findMany({
        where: {
          status: { not: "ANNULEE" },
          payment: null,
          createdAt: { gte: debut },
        },
        include: { items: { select: { quantity: true, unitPrice: true } } },
        orderBy: { createdAt: "asc" },
      }),
      // Les impayées plus anciennes ne sont pas détaillées : elles relèvent du
      // rattrapage, pas du suivi du jour. Un décompte suffit à les signaler.
      prisma.order.count({
        where: { status: { not: "ANNULEE" }, payment: null, createdAt: { lt: debut } },
      }),
      prisma.order.findFirst({
        where: { status: { not: "ANNULEE" }, payment: null, createdAt: { lt: debut } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      // Ce qui a été retiré de la journée, et pourquoi. Une annulation qui
      // disparaîtrait de l'écran serait une preuve que personne ne lit.
      prisma.order.findMany({
        where: { cancelledAt: { gte: debut, lt: fin } },
        include: {
          items: { select: { quantity: true, unitPrice: true } },
          cancelledBy: { select: { name: true } },
        },
        orderBy: { cancelledAt: "desc" },
      }),
    ]);

  // ------------------------------------------------------------------ Caisses

  const caisses: (CaisseJournee & { cashierId: string; cashierName: string })[] =
    caissesBrutes.map((caisse) => {
      const totalCash = caisse.payments
        .filter((p) => p.method === "CASH")
        .reduce((s, p) => s + p.amount, 0);
      const totalWave = caisse.payments
        .filter((p) => p.method === "WAVE")
        .reduce((s, p) => s + p.amount, 0);
      const sorties = caisse.expenses.reduce((s, e) => s + e.amount, 0);
      const ouverte = caisse.status === "OUVERTE";
      const ouverteAvantLaJournee = caisse.openedAt < debut;
      const enRetard = ouverte && ouverteAvantLaJournee;
      const duJour = caisse.payments.filter((p) => p.createdAt >= debut);
      // La journée d'exploitation, pas la date du calendrier : une caisse ouverte
      // à 00h30 relève du service de la veille. Sans cela, une caisse en retard
      // s'annoncerait « antérieure » sous la date d'aujourd'hui.
      const journeeOuverture = debutJourneeExploitation(caisse.openedAt);

      return {
        cashierId: caisse.cashier.id,
        cashierName: caisse.cashier.name,
        id: caisse.id,
        ouverte,
        openedAt: caisse.openedAt,
        closedAt: caisse.closedAt,
        openingFloat: caisse.openingFloat,
        nombreEncaissements: caisse.payments.length,
        totalCash,
        totalWave,
        total: totalCash + totalWave,
        totalDuJour: duJour.reduce((s, p) => s + p.amount, 0),
        nombreDuJour: duJour.length,
        // Ce qui est sorti du tiroir n'y est plus : l'omettre ferait attendre au
        // comptable des espèces qui ont déjà servi à régler une dépense.
        especesEnTiroir: caisse.openingFloat + totalCash - sorties,
        sortiesCaisse: sorties,
        depensesCaisse: caisse.expenses,
        ouverteAvantLaJournee,
        enRetard,
        // Calculé côté serveur : l'heure du poste client ne fait pas foi.
        joursEcoules: Math.max(0, differenceInCalendarDays(debut, journeeOuverture)),
        jourLabel: format(journeeOuverture, "EEEE d MMMM", { locale: fr }),
        declaredAmount: caisse.declaredAmount,
        expectedCash: caisse.expectedCash,
        difference: caisse.difference,
        retenu: ouverte ? null : (caisse.correctedAmount ?? caisse.declaredAmount ?? 0),
        corrected: caisse.correctedAmount != null,
        note: caisse.note,
        encaissements: caisse.payments.map((p) => ({
          id: p.id,
          paidAt: p.createdAt,
          method: p.method,
          amount: p.amount,
          reference: p.order.reference,
          tableNumber: p.order.tableNumber,
          customerName: p.order.customerName,
          type: p.order.type,
          // `methodCorrectedAt` porte la correction : `originalMethod` seul ne
          // dirait pas si elle a eu lieu quand le mode d'origine est réécrit.
          correction:
            p.methodCorrectedAt && p.originalMethod
              ? {
                  modeOrigine: p.originalMethod,
                  motif: p.methodCorrectionNote,
                  auteur: p.methodCorrectedBy?.name ?? null,
                  date: p.methodCorrectedAt,
                }
              : null,
        })),
      };
    });

  // ---------------------------------------------------------------- Caissiers

  const parCaissier = new Map<string, CaissierJournee>();
  for (const caisse of caisses) {
    const entree = parCaissier.get(caisse.cashierId) ?? {
      cashierId: caisse.cashierId,
      cashierName: caisse.cashierName,
      caisses: [],
      nombreEncaissements: 0,
      totalCash: 0,
      totalWave: 0,
      total: 0,
      especesEnAttente: 0,
      especesEnTiroir: 0,
      aUneCaisseOuverte: false,
      aUneCaisseEnRetard: false,
    };

    entree.caisses.push(caisse);
    entree.nombreEncaissements += caisse.nombreEncaissements;
    entree.totalCash += caisse.totalCash;
    entree.totalWave += caisse.totalWave;
    entree.total += caisse.total;
    if (caisse.ouverte) {
      entree.aUneCaisseOuverte = true;
      entree.especesEnAttente += caisse.totalCash;
      entree.especesEnTiroir += caisse.especesEnTiroir;
    }
    if (caisse.enRetard) entree.aUneCaisseEnRetard = true;

    parCaissier.set(caisse.cashierId, entree);
  }

  // Ceux qui ont encore une caisse ouverte d'abord : c'est là que se trouve
  // l'argent non versé, donc ce que la comptabilité doit regarder en premier.
  const caissiers = Array.from(parCaissier.values()).sort((a, b) => {
    if (a.aUneCaisseEnRetard !== b.aUneCaisseEnRetard) return a.aUneCaisseEnRetard ? -1 : 1;
    if (a.aUneCaisseOuverte !== b.aUneCaisseOuverte) return a.aUneCaisseOuverte ? -1 : 1;
    return b.total - a.total;
  });

  // ----------------------------------------------------------- À encaisser

  const commandesAEncaisser: CommandeAEncaisser[] = impayees.map((commande) => ({
    id: commande.id,
    createdAt: commande.createdAt,
    reference: commande.reference,
    tableNumber: commande.tableNumber,
    customerName: commande.customerName,
    type: commande.type,
    source: commande.source,
    status: commande.status,
    montant: totalCommande(commande.items, commande.deliveryFee),
    waveDeclaredAt: commande.waveDeclaredAt,
    waveReference: commande.waveReference,
  }));

  const commandesAnnulees: CommandeAnnulee[] = annulees.map((commande) => ({
    id: commande.id,
    createdAt: commande.createdAt,
    cancelledAt: commande.cancelledAt!,
    reference: commande.reference,
    tableNumber: commande.tableNumber,
    customerName: commande.customerName,
    type: commande.type,
    source: commande.source,
    montant: totalCommande(commande.items, commande.deliveryFee),
    motif: commande.cancellationReason,
    auteur: commande.cancelledBy?.name ?? null,
  }));

  const totalAEncaisser = commandesAEncaisser.reduce((s, c) => s + c.montant, 0);
  const waveAVerifier = commandesAEncaisser.filter((c) => c.waveDeclaredAt != null);

  // ------------------------------------------------------------------ Synthèse

  const caissesOuvertes = caisses.filter((c) => c.ouverte);
  const caissesFermees = caisses.filter((c) => !c.ouverte);

  return {
    debut,
    fin,
    jourLabel: format(debut, "EEEE d MMMM yyyy", { locale: fr }),
    caissiers,
    commandesAEncaisser,
    commandesAnnulees,
    totalAnnule: commandesAnnulees.reduce((s, c) => s + c.montant, 0),
    totalAEncaisser,
    nombreWaveAVerifier: waveAVerifier.length,
    montantWaveAVerifier: waveAVerifier.reduce((s, c) => s + c.montant, 0),
    impayeesAnterieures: {
      nombre: nombreImpayeesAnterieures,
      // Le jour d'exploitation de la plus ancienne : c'est là qu'il faut aller.
      jour: plusAncienneImpayee
        ? format(debutJourneeExploitation(plusAncienneImpayee.createdAt), "yyyy-MM-dd")
        : null,
    },
    // Encaissé pendant la journée, versé ou non. N'est pas une recette comptable.
    // Exclut ce qu'une caisse en retard a encaissé les jours précédents : ce
    // montant reste en circulation, mais il n'est pas un flux d'aujourd'hui.
    totalEncaisse: caisses.reduce((s, c) => s + c.totalDuJour, 0),
    nombreEncaissements: caisses.reduce((s, c) => s + c.nombreDuJour, 0),
    // Recette déjà remise, fond de caisse déduit. Les sorties d'espèces sont
    // réintégrées : elles sont déjà comptées en dépenses, les retrancher ici
    // amputerait la recette une seconde fois.
    dejaVerse: caissesFermees.reduce(
      (s, c) => s + (c.retenu ?? 0) - c.openingFloat + c.sortiesCaisse,
      0
    ),
    // Espèces encaissées sur des caisses encore ouvertes : attendues au versement.
    especesEnAttente: caissesOuvertes.reduce((s, c) => s + c.totalCash, 0),
    // Ce qui devrait physiquement se trouver dans les tiroirs à cet instant.
    especesEnTiroir: caissesOuvertes.reduce((s, c) => s + c.especesEnTiroir, 0),
    waveEnAttente: caissesOuvertes.reduce((s, c) => s + c.totalWave, 0),
    nombreCaissesOuvertes: caissesOuvertes.length,
    nombreCaissesFermees: caissesFermees.length,
    caissesEnRetard: caisses.filter((c) => c.enRetard),
  };
}

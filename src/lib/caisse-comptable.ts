import { prisma } from "@/lib/prisma";

/**
 * Caisse tenue par la comptabilité : les espèces qui dorment dans le coffre.
 *
 * À ne pas confondre avec le tiroir d'un caissier (`CashRegister`), qui ouvre le
 * matin et se vide le soir. Celle-ci ne se ferme jamais : elle reçoit les
 * versements du soir, paie les achats du lendemain, et ce qu'elle garde passe
 * d'un mois sur l'autre.
 *
 * Elle ne se filtre donc pas par période — un solde n'a de sens qu'à l'instant
 * où on le regarde. Il se reconstruit à partir du dernier comptage :
 *
 *     comptage + versements reçus − fonds de caisse confiés − dépenses réglées
 *
 * Deux précisions sur cette formule, qui la rendent juste plutôt que plausible :
 *
 * - Ce qu'un versement fait entrer dans le coffre est le tiroir **entier**, fond
 *   de caisse compris. C'est donc le montant retenu qui compte ici, pas la
 *   recette nette — celle-ci mesure ce que la journée a rapporté, ce qui est une
 *   autre question. Le fond, lui, est ressorti à l'ouverture : il est déduit au
 *   moment où il sort, jamais au moment où il rentre, sous peine de l'ôter deux
 *   fois.
 * - Une dépense réglée depuis le tiroir d'un caissier n'a jamais touché le
 *   coffre : le caissier l'a payée avec les espèces qu'il avait en main, et son
 *   versement du soir en est d'autant plus léger. La compter ici l'amputerait
 *   une seconde fois.
 *
 * Reste une hypothèse, faute que la dépense porte son mode de règlement : la
 * comptabilité paie en espèces, prises dans le coffre. C'est l'usage de la
 * maison ; le jour où un virement s'y ajoutera, c'est cette ligne qu'il faudra
 * reprendre.
 */

export type MouvementCaisse = {
  id: string;
  date: Date;
  libelle: string;
  detail: string | null;
  /** Signé : positif = entrée dans le coffre, négatif = sortie. */
  montant: number;
  /** Disponible après ce mouvement, pour lire le coffre ligne à ligne. */
  solde: number;
};

export type ComptageCaisse = {
  id: string;
  countedAt: Date;
  amount: number;
  note: string | null;
  auteur: string;
  createdAt: Date;
};

export type CaisseComptable = Awaited<ReturnType<typeof getCaisseComptable>>;

export async function getCaisseComptable() {
  const comptagesBruts = await prisma.cashCount.findMany({
    include: { user: { select: { name: true } } },
    orderBy: { countedAt: "desc" },
  });

  const comptages: ComptageCaisse[] = comptagesBruts.map((c) => ({
    id: c.id,
    countedAt: c.countedAt,
    amount: c.amount,
    note: c.note,
    auteur: c.user.name,
    createdAt: c.createdAt,
  }));

  const dernier = comptages[0];

  // Sans comptage d'amorçage, la caisse n'a pas d'origine. Additionner les
  // versements depuis le premier jour donnerait un disponible faux de tout ce
  // que le coffre contenait déjà : mieux vaut ne rien annoncer que d'annoncer un
  // chiffre que personne ne peut recouper.
  if (!dernier) {
    return { amorcee: false as const, comptages };
  }

  const depuis = dernier.countedAt;

  const [ouvertures, cloturees, depenses] = await Promise.all([
    // Fonds de caisse confiés depuis le comptage : sortis du coffre, ils n'y
    // reviendront qu'à la clôture, fondus dans le montant versé. Une caisse
    // ouverte *avant* le comptage a sorti son fond avant qu'on ne compte : il
    // manque déjà au montant compté, le redéduire creuserait un trou fictif.
    prisma.cashRegister.findMany({
      where: { openedAt: { gte: depuis } },
      select: { id: true, openedAt: true, openingFloat: true, cashier: { select: { name: true } } },
    }),
    prisma.cashRegister.findMany({
      where: { status: "FERMEE", closedAt: { gte: depuis } },
      select: {
        id: true,
        closedAt: true,
        declaredAmount: true,
        correctedAmount: true,
        cashier: { select: { name: true } },
      },
    }),
    // Les dépenses réglées depuis un tiroir portent leur caisse : elles sont
    // sorties de là, pas du coffre.
    prisma.expense.findMany({
      where: { date: { gte: depuis }, cashRegisterId: null },
      select: { id: true, date: true, label: true, category: true, amount: true },
    }),
  ]);

  const fondsConfies = ouvertures.reduce((s, c) => s + c.openingFloat, 0);
  const versementsRecus = cloturees.reduce(
    (s, c) => s + (c.correctedAmount ?? c.declaredAmount ?? 0),
    0
  );
  const depensesReglees = depenses.reduce((s, e) => s + e.amount, 0);
  const disponible = dernier.amount + versementsRecus - fondsConfies - depensesReglees;

  // ------------------------------------------------------------- Livre de caisse

  const lignes = [
    ...cloturees.map((c) => ({
      id: `versement-${c.id}`,
      // Une caisse fermée a forcément une date de clôture ; la garde n'est là
      // que pour le typage.
      date: c.closedAt ?? depuis,
      libelle: `Versement de ${c.cashier.name}`,
      detail: "Tiroir remis à la comptabilité, fond de caisse compris",
      montant: c.correctedAmount ?? c.declaredAmount ?? 0,
    })),
    ...ouvertures
      .filter((c) => c.openingFloat > 0)
      .map((c) => ({
        id: `fond-${c.id}`,
        date: c.openedAt,
        libelle: `Fond de caisse confié à ${c.cashier.name}`,
        detail: "Rentrera dans le versement du soir",
        montant: -c.openingFloat,
      })),
    ...depenses.map((e) => ({
      id: `depense-${e.id}`,
      date: e.date,
      libelle: e.label,
      detail: e.category,
      montant: -e.amount,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  let solde = dernier.amount;
  const mouvements: MouvementCaisse[] = lignes.map((l) => {
    solde += l.montant;
    return { ...l, solde };
  });

  return {
    amorcee: true as const,
    comptages,
    dernier,
    versementsRecus,
    nombreVersements: cloturees.length,
    fondsConfies,
    depensesReglees,
    nombreDepenses: depenses.length,
    disponible,
    mouvements,
  };
}

import { format } from "date-fns";
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

/**
 * Ce qui a bougé dans le coffre sur un intervalle `[depuis, jusqua[`.
 *
 * Une seule fonction pour toute l'arithmétique du coffre : le disponible et le
 * report d'un mois répondent à la même question posée à deux instants. Deux
 * calculs séparés finiraient par diverger sur un détail — le fond de caisse, ou
 * la dépense réglée au comptoir — et l'écran contredirait l'autre.
 *
 * `jusqua` omis vaut « jusqu'à maintenant » : la borne reste ouverte.
 */
async function mouvementsCoffre(depuis: Date, jusqua?: Date) {
  const borne = jusqua ? { gte: depuis, lt: jusqua } : { gte: depuis };

  const [ouvertures, cloturees, depenses] = await Promise.all([
    // Fonds de caisse confiés sur l'intervalle : sortis du coffre, ils n'y
    // reviendront qu'à la clôture, fondus dans le montant versé. Une caisse
    // ouverte *avant* le début de l'intervalle a sorti son fond avant qu'on ne
    // compte : il manque déjà au montant de départ, le redéduire creuserait un
    // trou fictif.
    prisma.cashRegister.findMany({
      where: { openedAt: borne },
      select: { id: true, openedAt: true, openingFloat: true, cashier: { select: { name: true } } },
    }),
    prisma.cashRegister.findMany({
      where: { status: "FERMEE", closedAt: borne },
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
      where: { date: borne, cashRegisterId: null },
      select: { id: true, date: true, label: true, category: true, amount: true },
    }),
  ]);

  const fondsConfies = ouvertures.reduce((s, c) => s + c.openingFloat, 0);
  const versementsRecus = cloturees.reduce(
    (s, c) => s + (c.correctedAmount ?? c.declaredAmount ?? 0),
    0
  );
  const depensesReglees = depenses.reduce((s, e) => s + e.amount, 0);

  return {
    ouvertures,
    cloturees,
    depenses,
    fondsConfies,
    versementsRecus,
    depensesReglees,
    /** Ce que l'intervalle a ajouté au coffre, négatif s'il l'a vidé. */
    variation: versementsRecus - fondsConfies - depensesReglees,
  };
}

/**
 * Espèces au coffre à un instant donné, reconstruites depuis le dernier comptage
 * qui le précède. `null` tant qu'aucun comptage n'a amorcé la caisse avant cet
 * instant : sans origine, le total ne s'appuierait sur rien.
 */
export async function getSoldeCoffreAu(instant: Date) {
  const comptage = await prisma.cashCount.findFirst({
    where: { countedAt: { lte: instant } },
    orderBy: { countedAt: "desc" },
    include: { user: { select: { name: true } } },
  });
  if (!comptage) return null;

  const { variation } = await mouvementsCoffre(comptage.countedAt, instant);
  return { comptage, solde: comptage.amount + variation };
}

/**
 * Le compte Wave, seconde poche de la trésorerie.
 *
 * L'argent Wave va directement au compte marchand du restaurant : il n'entre
 * jamais au coffre, et le versement du soir n'en porte rien — le tiroir d'un
 * caissier ne contient que des espèces. Ignorer cette poche donne une image
 * fausse d'un mois qui encaisse beaucoup en Wave : le coffre se vide au rythme
 * des achats pendant qu'une part des recettes s'accumule ailleurs, et le seul
 * coffre donne à voir une maison exsangue alors que l'argent est là.
 *
 * Le compte ne se compte pas comme le coffre : personne n'y touche, donc rien
 * n'en sort et son solde est le cumul de ce qui y est entré. Ce cumul ne part
 * pourtant pas d'un relevé mais du premier encaissement enregistré : c'est ce
 * que l'application a vu passer, non le solde du compte, qui pouvait déjà
 * contenir quelque chose avant qu'elle n'existe. L'écran doit le dire ainsi.
 */
export async function getCompteWave(debut: Date, jusqua: Date) {
  const [avant, pendant] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { method: "WAVE", createdAt: { lt: debut } },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { method: "WAVE", createdAt: { gte: debut, lt: jusqua } },
    }),
  ]);

  // Le mode retenu est celui qui fait foi aujourd'hui : une touche mal appuyée
  // par le caissier puis corrigée par la comptabilité a déplacé l'encaissement
  // d'une poche à l'autre, et c'est la correction qui dit où l'argent est.
  const report = avant._sum.amount ?? 0;
  const encaisse = pendant._sum.amount ?? 0;

  return { report, encaisse, solde: report + encaisse };
}

export type TresorerieDuMois = NonNullable<Awaited<ReturnType<typeof getTresorerieDuMois>>>;

/**
 * Avec quel argent le mois a réglé ses premiers achats, et ce qu'il en reste.
 *
 * Un mois qui démarre sur une réserve ne se lit pas comme un mois qui démarre à
 * zéro : les achats des premiers jours sortent d'un argent que le mois n'a pas
 * encore gagné. Le résultat comptable, lui, ne bouge pas — une charge reste
 * rattachée au mois où elle est engagée — mais il cesse de se lire comme un trou
 * dès qu'on voit ce qui l'a financé.
 *
 * La trésorerie tient en deux poches qui ne se comportent pas de la même façon,
 * et les additionner sans les distinguer effacerait justement ce qui explique le
 * mois : le coffre est la seule où le mois puise, le compte Wave ne fait que se
 * remplir. Un mois peut donc vider le premier tout en gagnant de l'argent, si
 * ses recettes rentrent d'un côté et ses achats sortent de l'autre.
 *
 * `null` tant qu'aucun comptage n'a précédé le début du mois : sans coffre
 * connu au départ, il n'y a rien à raconter.
 */
export async function getTresorerieDuMois(debut: Date, fin: Date, maintenant = new Date()) {
  // Un mois en cours s'arrête à aujourd'hui : projeter le coffre jusqu'au 31
  // ferait apparaître un solde à une date où rien n'a encore été encaissé.
  const borne = maintenant < fin ? maintenant : fin;

  const ouverture = await getSoldeCoffreAu(debut);
  if (!ouverture) return null;

  const [cloture, mouvements, wave] = await Promise.all([
    getSoldeCoffreAu(borne),
    mouvementsCoffre(debut, borne),
    getCompteWave(debut, borne),
  ]);

  const soldeActuel = cloture?.solde ?? ouverture.solde;

  // ------------------------------------------------- Le creux du mois
  //
  // Cumul des seuls mouvements du mois, en partant de zéro : il dit de combien
  // le mois a dépensé plus qu'il n'a encaissé, indépendamment de ce que le
  // coffre contenait. Son point le plus bas est le moment où le mois s'est le
  // plus appuyé sur le report — sans lui, le coffre y aurait été à découvert
  // d'autant.
  //
  // Le cumul se fait par jour et non mouvement par mouvement : une dépense est
  // datée au jour, un versement à l'heure de clôture, si bien qu'à l'intérieur
  // d'une journée les achats du matin passent tous avant la remise du soir. Un
  // creux mesuré à la ligne ne serait qu'un artefact de cette datation.
  const parJour = new Map<string, number>();
  const ajouter = (date: Date, montant: number) => {
    const cle = format(date, "yyyy-MM-dd");
    parJour.set(cle, (parJour.get(cle) ?? 0) + montant);
  };
  for (const c of mouvements.cloturees) {
    if (c.closedAt) ajouter(c.closedAt, c.correctedAmount ?? c.declaredAmount ?? 0);
  }
  for (const c of mouvements.ouvertures) ajouter(c.openedAt, -c.openingFloat);
  for (const e of mouvements.depenses) ajouter(e.date, -e.amount);

  let cumul = 0;
  let creux: { date: Date; montant: number } | null = null;
  for (const [cle, net] of Array.from(parJour.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    cumul += net;
    if (cumul < 0 && (creux == null || -cumul > creux.montant)) {
      creux = { date: new Date(`${cle}T00:00:00.000Z`), montant: -cumul };
    }
  }

  const coffre = {
    /** Comptage sur lequel s'appuie le report, pour que le chiffre se vérifie. */
    comptage: ouverture.comptage,
    report: ouverture.solde,
    solde: soldeActuel,
    /** Ce que le mois a prélevé sur le report, négatif s'il l'a au contraire regarni. */
    entame: ouverture.solde - soldeActuel,
    creux,
    /**
     * Un coffre ne peut pas contenir moins que rien. S'il y descend, ce n'est
     * pas la maison qui est à sec : c'est le calcul qui a perdu le fil, faute
     * d'un comptage récent ou parce qu'un achat a été réglé autrement qu'en
     * espèces prises au coffre. Le signaler vaut mieux que d'afficher un
     * négatif comme s'il se constatait.
     */
    impossible: soldeActuel < 0,
  };

  return {
    coffre,
    wave,
    /** Les deux poches réunies : ce que le mois avait, et ce qu'il lui reste. */
    report: coffre.report + wave.report,
    solde: coffre.solde + wave.solde,
  };
}

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

  const {
    ouvertures,
    cloturees,
    depenses,
    fondsConfies,
    versementsRecus,
    depensesReglees,
    variation,
  } = await mouvementsCoffre(depuis);

  const disponible = dernier.amount + variation;

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

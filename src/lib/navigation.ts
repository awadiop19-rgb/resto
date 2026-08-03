/**
 * Carte de navigation, par role.
 *
 * Les destinations sont groupees par metier plutot qu'alignees a plat. Un
 * administrateur en a quatorze : presentees d'un seul tenant, elles se
 * ressemblent toutes et il faut les lire une a une pour trouver la bonne. Sous
 * un titre — Service, Argent, Reserve — le regard descend d'abord au groupe.
 *
 * `onglets` est la version telephone : les quatre destinations que ce role
 * ouvre reellement dans sa journee, atteignables au pouce. Le reste vit derriere
 * « Plus », jamais perdu mais jamais dans le chemin.
 *
 * Donnees pures, sans acces base : le rail est un composant client, qui a besoin
 * de connaitre la page courante.
 */

export type NomIcone =
  | "tableau"
  | "commandes"
  | "livraisons"
  | "menu"
  | "caisse"
  | "versements"
  | "depenses"
  | "stock"
  | "produits"
  | "comptabilite"
  | "journee"
  | "mois"
  | "utilisateurs"
  | "profil";

export type LienNav = { href: string; label: string; icone: NomIcone };
export type GroupeNav = { titre: string; liens: LienNav[] };
export type Navigation = { groupes: GroupeNav[]; onglets: LienNav[] };

const PROFIL: LienNav = { href: "/profil", label: "Mon profil", icone: "profil" };

export const NAVIGATION: Record<string, Navigation> = {
  ADMIN: {
    groupes: [
      {
        titre: "Pilotage",
        liens: [{ href: "/dashboard", label: "Tableau de bord", icone: "tableau" }],
      },
      {
        titre: "Service",
        liens: [
          { href: "/commandes", label: "Commandes", icone: "commandes" },
          { href: "/livraisons", label: "Livraisons", icone: "livraisons" },
          { href: "/menu", label: "Menu", icone: "menu" },
        ],
      },
      {
        titre: "Argent",
        liens: [
          { href: "/caisse", label: "Caisse", icone: "caisse" },
          { href: "/caisse/versements", label: "Versements", icone: "versements" },
          { href: "/depenses", label: "Dépenses", icone: "depenses" },
        ],
      },
      {
        titre: "Réserve",
        liens: [
          { href: "/stock", label: "Stock", icone: "stock" },
          { href: "/produits", label: "Produits", icone: "produits" },
        ],
      },
      {
        titre: "Comptabilité",
        liens: [
          { href: "/comptabilite", label: "Comptabilité", icone: "comptabilite" },
          { href: "/comptabilite/journee", label: "Journée en cours", icone: "journee" },
          { href: "/comptabilite/mois", label: "Le mois", icone: "mois" },
        ],
      },
      {
        titre: "Administration",
        liens: [
          { href: "/utilisateurs", label: "Utilisateurs", icone: "utilisateurs" },
          PROFIL,
        ],
      },
    ],
    onglets: [
      { href: "/commandes", label: "Commandes", icone: "commandes" },
      { href: "/caisse", label: "Caisse", icone: "caisse" },
      { href: "/depenses", label: "Dépenses", icone: "depenses" },
      { href: "/comptabilite", label: "Compta", icone: "comptabilite" },
    ],
  },

  COMPTABILITE: {
    groupes: [
      {
        titre: "Comptabilité",
        liens: [
          { href: "/comptabilite", label: "Tableau de bord", icone: "comptabilite" },
          { href: "/comptabilite/journee", label: "Journée en cours", icone: "journee" },
          { href: "/comptabilite/mois", label: "Le mois", icone: "mois" },
        ],
      },
      {
        titre: "Argent",
        liens: [
          { href: "/depenses", label: "Dépenses", icone: "depenses" },
          { href: "/caisse/versements", label: "Versements", icone: "versements" },
        ],
      },
      {
        titre: "Réserve",
        liens: [
          { href: "/stock", label: "Stock", icone: "stock" },
          { href: "/produits", label: "Produits", icone: "produits" },
        ],
      },
      { titre: "Compte", liens: [PROFIL] },
    ],
    onglets: [
      { href: "/comptabilite", label: "Compta", icone: "comptabilite" },
      { href: "/comptabilite/journee", label: "Journée", icone: "journee" },
      { href: "/comptabilite/mois", label: "Le mois", icone: "mois" },
      { href: "/depenses", label: "Dépenses", icone: "depenses" },
    ],
  },

  CAISSIER: {
    groupes: [
      {
        titre: "Service",
        liens: [
          { href: "/caisse", label: "Caisse", icone: "caisse" },
          { href: "/commandes", label: "Commandes", icone: "commandes" },
          { href: "/livraisons", label: "Livraisons", icone: "livraisons" },
        ],
      },
      { titre: "Compte", liens: [PROFIL] },
    ],
    onglets: [
      { href: "/caisse", label: "Caisse", icone: "caisse" },
      { href: "/commandes", label: "Commandes", icone: "commandes" },
      { href: "/livraisons", label: "Livraisons", icone: "livraisons" },
      PROFIL,
    ],
  },

  SERVEUR: {
    groupes: [
      {
        titre: "Service",
        liens: [
          { href: "/commandes", label: "Commandes", icone: "commandes" },
          { href: "/menu", label: "Menu", icone: "menu" },
        ],
      },
      { titre: "Compte", liens: [PROFIL] },
    ],
    onglets: [
      { href: "/commandes", label: "Commandes", icone: "commandes" },
      { href: "/menu", label: "Menu", icone: "menu" },
      PROFIL,
    ],
  },

  CUISINE: {
    groupes: [
      {
        titre: "Service",
        liens: [{ href: "/commandes", label: "Commandes", icone: "commandes" }],
      },
      { titre: "Compte", liens: [PROFIL] },
    ],
    onglets: [{ href: "/commandes", label: "Commandes", icone: "commandes" }, PROFIL],
  },

  LIVREUR: {
    groupes: [
      {
        titre: "Livraisons",
        liens: [{ href: "/mes-livraisons", label: "Mes livraisons", icone: "livraisons" }],
      },
      { titre: "Compte", liens: [PROFIL] },
    ],
    onglets: [
      { href: "/mes-livraisons", label: "Mes livraisons", icone: "livraisons" },
      PROFIL,
    ],
  },
};

/** Toutes les destinations d'un role, a plat — pour le panneau « Plus ». */
export function tousLesLiens(navigation: Navigation) {
  return navigation.groupes.flatMap((g) => g.liens);
}

/**
 * La page courante, pour l'etat actif. Le prefixe ne suffit pas : `/caisse`
 * serait actif en meme temps que `/caisse/versements`. On prend donc le lien le
 * plus long qui corresponde, jamais deux a la fois.
 */
export function lienActif(liens: LienNav[], chemin: string) {
  return liens
    .filter((l) => chemin === l.href || chemin.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

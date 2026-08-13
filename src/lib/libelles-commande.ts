import type {
  DeliveryStatus,
  OrderSource,
  OrderStatus,
  OrderType,
} from "@/generated/prisma/client";

/** D'où vient la commande : du site, ou d'un employé au comptoir. */
export const SOURCE_LABELS: Record<OrderSource, string> = {
  EN_LIGNE: "En ligne",
  INTERNE: "Sur place",
};

/** Comment elle est servie. */
export const TYPE_LABELS: Record<OrderType, string> = {
  SUR_PLACE: "Sur place",
  A_EMPORTER: "À emporter",
  LIVRAISON: "Livraison",
};

export const TYPE_CLASSES: Record<OrderType, string> = {
  SUR_PLACE: "bg-slate-100 text-slate-700",
  A_EMPORTER: "bg-sky-100 text-sky-800",
  LIVRAISON: "bg-orange-100 text-orange-800",
};

export const DELIVERY_LABELS: Record<DeliveryStatus, string> = {
  A_ASSIGNER: "À affecter",
  ASSIGNEE: "Livreur affecté",
  EN_ROUTE: "En route",
  LIVREE: "Livrée",
  ECHOUEE: "Échec de livraison",
};

export const DELIVERY_CLASSES: Record<DeliveryStatus, string> = {
  A_ASSIGNER: "bg-amber-100 text-amber-800",
  ASSIGNEE: "bg-sky-100 text-sky-800",
  EN_ROUTE: "bg-orange-100 text-orange-800",
  LIVREE: "bg-emerald-100 text-emerald-800",
  ECHOUEE: "bg-red-100 text-red-800",
};

export type EtapeSuivi = { cle: string; libelle: string; faite: boolean };

/**
 * Étapes montrées au client sur la page de suivi. La préparation et la livraison
 * sont deux temps distincts : une commande à emporter s'arrête au retrait.
 */
export function etapesSuivi(
  type: OrderType,
  status: OrderStatus,
  deliveryStatus: DeliveryStatus | null,
): EtapeSuivi[] {
  const etapes = [
    { cle: "recue", libelle: "Commande reçue" },
    { cle: "preparation", libelle: "En préparation" },
    { cle: "prete", libelle: type === "LIVRAISON" ? "Prête à partir" : "Prête à retirer" },
    ...(type === "LIVRAISON"
      ? [
          { cle: "route", libelle: "En route vers vous" },
          { cle: "livree", libelle: "Livrée" },
        ]
      : [{ cle: "servie", libelle: "Retirée" }]),
  ];

  let atteinte = 0;
  if (status === "EN_PREPARATION") atteinte = 1;
  if (status === "PRETE") atteinte = 2;
  if (status === "SERVIE") atteinte = etapes.length - 1;
  // Une livraison en échec ne doit pas paraître terminée, même si la cuisine
  // a déjà marqué la commande comme servie.
  if (deliveryStatus === "ASSIGNEE") atteinte = Math.max(atteinte, 2);
  if (deliveryStatus === "EN_ROUTE") atteinte = 3;
  if (deliveryStatus === "ECHOUEE") atteinte = 3;
  if (deliveryStatus === "LIVREE") atteinte = 4;

  return etapes.map((etape, index) => ({ ...etape, faite: index <= atteinte }));
}

/**
 * Comment désigner une commande en une colonne, ou dans le libellé d'une
 * dépense : ce que celui qui la relira reconnaîtra. La référence d'abord, parce
 * que c'est elle que le client donne au comptoir.
 */
export function libelleCourtCommande(commande: {
  reference: string | null;
  tableNumber: number | null;
  customerName: string | null;
}) {
  if (commande.reference) return commande.reference;
  if (commande.tableNumber != null) return `Table ${commande.tableNumber}`;
  return commande.customerName ?? "Commande";
}

/** Masque un numéro pour l'affichage public : 77 123 45 67 -> 77 ••• •• 67 */
export function masquerTelephone(numero: string | null) {
  if (!numero) return null;
  const chiffres = numero.replace(/\s/g, "");
  if (chiffres.length < 4) return "•••";
  return `${chiffres.slice(0, 2)} ••• •• ${chiffres.slice(-2)}`;
}

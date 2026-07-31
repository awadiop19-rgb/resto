type LigneCommande = { unitPrice: number; quantity: number };

/** Montant des articles seuls, hors livraison. */
export function sousTotal(items: LigneCommande[]) {
  return items.reduce((somme, ligne) => somme + ligne.unitPrice * ligne.quantity, 0);
}

/**
 * Montant réellement dû par le client : les articles plus, le cas échéant, les
 * frais de livraison figés sur la commande.
 */
export function totalCommande(items: LigneCommande[], deliveryFee: number | null | undefined) {
  return sousTotal(items) + (deliveryFee ?? 0);
}

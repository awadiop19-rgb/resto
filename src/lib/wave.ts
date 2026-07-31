/**
 * Paiement Wave du restaurant.
 *
 * Le lien vient du QR marchand fourni par Wave : c'est la même destination que
 * celle imprimée sur le QR affiché au comptoir. Il ne s'agit pas d'un secret —
 * il permet uniquement de payer le restaurant, jamais d'accéder à son compte.
 *
 * Le QR statique ne transporte pas de montant : le client saisit lui-même la
 * somme dans Wave. C'est pourquoi le montant à payer est affiché en grand à
 * côté, et rappelé sur l'écran de suivi.
 */
export const WAVE_LIEN_PAIEMENT = "https://pay.wave.com/m/M_sn_C5Th3vNlkwwr/c/sn/?src=p";

/** QR extrait du PDF marchand, à 720 px : assez net pour être scanné à l'écran. */
export const WAVE_QR_IMAGE = "/paiement/wave-qr.png";

/**
 * Le restaurant vit à GMT, et le serveur y est calé (`instrumentation.ts`). Les
 * dates, elles, se rendent souvent dans le navigateur : sans fuseau impose, une
 * dépense du 3 août enregistrée à minuit GMT s'affiche « 02/08 » depuis un pays
 * à l'ouest, et l'écran contredit la caisse. Une date est ici un fait du
 * restaurant, pas un instant relatif à qui la regarde.
 */
const FUSEAU = "UTC";

/** Jour seul : 03/08/2026. */
export function formatDate(value: Date | string | number) {
  return new Date(value).toLocaleDateString("fr-FR", { timeZone: FUSEAU });
}

/** Jour et heure : 03/08/2026 19:42:04. */
export function formatDateHeure(value: Date | string | number) {
  return new Date(value).toLocaleString("fr-FR", { timeZone: FUSEAU });
}

/** Heure de service, à la minute : 19:42. */
export function formatHeure(value: Date | string | number) {
  return new Date(value).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FUSEAU,
  });
}

/** Heure à la seconde : 19:42:04. */
export function formatHeurePrecise(value: Date | string | number) {
  return new Date(value).toLocaleTimeString("fr-FR", { timeZone: FUSEAU });
}

export function formatFCFA(value: number) {
  return `${value.toLocaleString("fr-FR")} F`;
}

// Écart de caisse : le signe porte le sens (− = manquant, + = excédent).
export function formatSignedFCFA(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toLocaleString("fr-FR")} F`;
}

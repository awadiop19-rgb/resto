export function formatFCFA(value: number) {
  return `${value.toLocaleString("fr-FR")} F`;
}

// Écart de caisse : le signe porte le sens (− = manquant, + = excédent).
export function formatSignedFCFA(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toLocaleString("fr-FR")} F`;
}

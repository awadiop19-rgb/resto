/**
 * Types et helpers de quartiers utilisables côté navigateur.
 *
 * Séparé de `zones-livraison.ts`, qui accède à la base : importer ce dernier
 * depuis un composant client entraînerait Prisma et better-sqlite3 dans le
 * bundle, et le build échoue sur `fs`.
 */
export type QuartierOption = {
  id: string;
  name: string;
  zoneName: string;
  fee: number;
};

/** Regroupe les quartiers par zone, pour un <select> à optgroup. */
export function grouperParZone(quartiers: QuartierOption[]) {
  const groupes = new Map<string, { zoneName: string; fee: number; quartiers: QuartierOption[] }>();
  for (const quartier of quartiers) {
    const groupe = groupes.get(quartier.zoneName) ?? {
      zoneName: quartier.zoneName,
      fee: quartier.fee,
      quartiers: [],
    };
    groupe.quartiers.push(quartier);
    groupes.set(quartier.zoneName, groupe);
  }
  return Array.from(groupes.values());
}

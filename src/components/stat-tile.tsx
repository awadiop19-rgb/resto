const TONES = {
  neutre: "text-slate-900",
  bon: "text-[#0ca30c]",
  alerte: "text-[#b47400]",
  critique: "text-[#d03b3b]",
} as const;

export type StatTone = keyof typeof TONES;

/**
 * Une valeur seule se lit mieux en tuile qu'en graphique à une barre.
 *
 * L'étiquette est d'autant plus petite et espacée que la valeur est grosse :
 * c'est l'écart entre les deux qui fait voir le chiffre avant de lire ce qu'il
 * mesure. Les montants passent à chasse fixe pour que deux tuiles voisines
 * alignent leurs unités.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = "neutre",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: StatTone;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <p className={`montant mt-1.5 text-2xl font-bold tracking-tight ${TONES[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

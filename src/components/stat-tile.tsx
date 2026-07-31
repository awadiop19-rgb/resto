const TONES = {
  neutre: "text-slate-900",
  bon: "text-[#0ca30c]",
  alerte: "text-[#b47400]",
  critique: "text-[#d03b3b]",
} as const;

export type StatTone = keyof typeof TONES;

/**
 * Une valeur seule se lit mieux en tuile qu'en graphique à une barre.
 * Chiffres proportionnels : `tabular-nums` est réservé aux colonnes alignées.
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
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${TONES[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

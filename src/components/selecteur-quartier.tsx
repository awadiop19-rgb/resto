"use client";

import { formatFCFA } from "@/lib/format";
import { grouperParZone, type QuartierOption } from "@/lib/quartiers";

/**
 * Le client ne saisit pas son quartier en clair : il le choisit dans la liste
 * configurée, ce qui détermine la zone et donc le tarif de livraison.
 */
export function SelecteurQuartier({
  quartiers,
  valeur,
  onChange,
  compact = false,
}: {
  quartiers: QuartierOption[];
  valeur: string;
  onChange: (quartierId: string) => void;
  compact?: boolean;
}) {
  const groupes = grouperParZone(quartiers);
  const choisi = quartiers.find((q) => q.id === valeur);

  if (quartiers.length === 0) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Aucune zone de livraison n&apos;est configurée pour le moment.
      </p>
    );
  }

  return (
    <div>
      <label
        className="mb-1 block text-sm text-slate-600"
        htmlFor="selecteur-quartier"
      >
        Quartier de livraison <span className="text-red-500">*</span>
      </label>
      <select
        id="selecteur-quartier"
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        className={
          compact
            ? "w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            : "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
        }
      >
        <option value="">Choisissez votre quartier…</option>
        {groupes.map((groupe) => (
          <optgroup key={groupe.zoneName} label={`${groupe.zoneName} — ${formatFCFA(groupe.fee)}`}>
            {groupe.quartiers.map((quartier) => (
              <option key={quartier.id} value={quartier.id}>
                {quartier.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {choisi && (
        <p className="mt-1 text-xs text-slate-500">
          Zone {choisi.zoneName} · frais de livraison{" "}
          <span className="font-semibold text-slate-800">{formatFCFA(choisi.fee)}</span>
        </p>
      )}
    </div>
  );
}

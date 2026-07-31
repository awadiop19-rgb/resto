"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PERIODE_LABELS, PERIODE_PRESETS, type PeriodePreset } from "@/lib/periode";

/**
 * Une seule barre de filtre au-dessus de tout ce qu'elle cadre : tous les
 * graphiques de la page se recalculent sur la même tranche.
 */
export function PeriodFilter({
  preset,
  debut,
  fin,
  label,
}: {
  preset: PeriodePreset;
  debut: string;
  fin: string;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [customDebut, setCustomDebut] = useState(debut);
  const [customFin, setCustomFin] = useState(fin);

  function go(query: string) {
    startTransition(() => {
      router.push(`${pathname}${query}`);
    });
  }

  function selectPreset(value: PeriodePreset) {
    if (value === "perso") {
      go(`?debut=${customDebut}&fin=${customFin}`);
      return;
    }
    go(value === "mois" ? pathname : `?periode=${value}`);
  }

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-3 transition-opacity ${
        isPending ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {PERIODE_PRESETS.filter((p) => p !== "perso").map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => selectPreset(p)}
              aria-pressed={preset === p}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                preset === p
                  ? "bg-black font-medium text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {PERIODE_LABELS[p]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-2 border-l border-slate-100 pl-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500" htmlFor="periode-debut">
              Du
            </label>
            <input
              id="periode-debut"
              type="date"
              value={customDebut}
              onChange={(e) => setCustomDebut(e.target.value)}
              className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500" htmlFor="periode-fin">
              Au
            </label>
            <input
              id="periode-fin"
              type="date"
              value={customFin}
              onChange={(e) => setCustomFin(e.target.value)}
              className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => selectPreset("perso")}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Appliquer
          </button>
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Période analysée : <span className="font-medium text-slate-700">{label}</span>
      </p>
    </div>
  );
}

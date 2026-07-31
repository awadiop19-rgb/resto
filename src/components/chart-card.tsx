"use client";

import { useId, useState } from "react";

export type ChartTable = {
  headers: string[];
  rows: (string | number)[][];
};

/**
 * Enveloppe d'un graphique. Chaque graphique a son jumeau tableau : une infobulle
 * ne doit jamais être le seul moyen de lire une valeur, et un lecteur qui ne
 * distingue pas deux teintes retrouve les chiffres ici.
 */
export function ChartCard({
  title,
  hint,
  table,
  isEmpty,
  emptyLabel = "Aucune donnée sur cette période.",
  children,
}: {
  title: string;
  hint?: string;
  table: ChartTable;
  isEmpty?: boolean;
  emptyLabel?: string;
  children: React.ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  const panelId = useId();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
        </div>
        {!isEmpty && (
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            aria-expanded={showTable}
            aria-controls={panelId}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
          >
            {showTable ? "Voir le graphique" : "Voir les données"}
          </button>
        )}
      </div>

      <div id={panelId}>
        {isEmpty ? (
          <p className="py-10 text-center text-sm text-slate-400">{emptyLabel}</p>
        ) : showTable ? (
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-sm tabular-nums">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-xs uppercase text-slate-400">
                  {table.headers.map((header) => (
                    <th key={header} className="pb-2 pr-3 font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, index) => (
                  <tr key={index} className="border-t border-slate-100">
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="py-1.5 pr-3">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

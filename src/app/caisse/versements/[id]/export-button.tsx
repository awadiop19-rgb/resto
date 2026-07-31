"use client";

import { downloadCsv } from "@/lib/csv";

export type LigneEncaissement = {
  heure: string;
  commande: string;
  articles: string;
  mode: string;
  montant: number;
};

export function ExportVersementButton({
  filename,
  entete,
  lignes,
}: {
  filename: string;
  entete: (string | number)[][];
  lignes: LigneEncaissement[];
}) {
  function exportCsv() {
    const rows: (string | number)[][] = [
      ...entete,
      [],
      ["Heure", "Commande", "Articles", "Mode de paiement", "Montant (F)"],
      ...lignes.map((l) => [l.heure, l.commande, l.articles, l.mode, l.montant]),
    ];
    downloadCsv(filename, rows);
  }

  return (
    <button
      type="button"
      onClick={exportCsv}
      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
    >
      Exporter CSV
    </button>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { correctCashRegister } from "@/lib/actions/caisse";
import { assurerSucces } from "@/lib/actions/resultat";
import { downloadCsv } from "@/lib/csv";
import { formatSignedFCFA } from "@/lib/format";
import type { CashRegisterStatus } from "@/generated/prisma/client";

type CashRegister = {
  id: string;
  status: CashRegisterStatus;
  openedAt: Date;
  closedAt: Date | null;
  openingFloat: number;
  totalCash: number | null;
  totalWave: number | null;
  declaredAmount: number | null;
  expectedCash: number | null;
  difference: number | null;
  note: string | null;
  correctedAmount: number | null;
  correctionNote: string | null;
  correctedAt: Date | null;
  cashier: { name: string };
  correctedBy: { name: string } | null;
};

export function VersementsManager({ cashRegisters }: { cashRegisters: CashRegister[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cashierFilter, setCashierFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [correctedAmount, setCorrectedAmount] = useState("");
  const [correctionNote, setCorrectionNote] = useState("");

  const cashiers = useMemo(
    () => Array.from(new Set(cashRegisters.map((c) => c.cashier.name))).sort(),
    [cashRegisters],
  );

  const filtered = cashierFilter
    ? cashRegisters.filter((c) => c.cashier.name === cashierFilter)
    : cashRegisters;

  function exportCsv() {
    const rows: (string | number)[][] = [
      [
        "Caissier",
        "Ouverture",
        "Fermeture",
        "Fond de caisse",
        "Total Cash",
        "Total Wave",
        "Espèces attendues",
        "Montant déclaré",
        "Écart",
        "Motif de l'écart",
        "Statut",
        "Montant corrigé",
        "Motif correction",
      ],
      ...filtered.map((c) => [
        c.cashier.name,
        new Date(c.openedAt).toLocaleString("fr-FR"),
        c.closedAt ? new Date(c.closedAt).toLocaleString("fr-FR") : "",
        c.openingFloat,
        c.totalCash ?? "",
        c.totalWave ?? "",
        c.expectedCash ?? "",
        c.declaredAmount ?? "",
        c.difference ?? "",
        c.note ?? "",
        c.status,
        c.correctedAmount ?? "",
        c.correctionNote ?? "",
      ]),
    ];
    downloadCsv(`versements_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  function startCorrection(cashRegister: CashRegister) {
    setError(null);
    setEditingId(cashRegister.id);
    setCorrectedAmount(String(cashRegister.correctedAmount ?? cashRegister.declaredAmount ?? 0));
    setCorrectionNote("");
  }

  function cancelCorrection() {
    setEditingId(null);
    setCorrectedAmount("");
    setCorrectionNote("");
  }

  function submitCorrection(id: string) {
    setError(null);
    if (correctedAmount === "" || Number.isNaN(Number(correctedAmount))) {
      setError("Montant corrigé invalide");
      return;
    }
    if (!correctionNote.trim()) {
      setError("Indiquez le motif de la correction");
      return;
    }
    startTransition(async () => {
      try {
        assurerSucces(
          await correctCashRegister({
            id,
            correctedAmount: Number(correctedAmount),
            correctionNote: correctionNote.trim(),
          })
        );
        cancelCorrection();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de la correction");
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={cashierFilter}
          onChange={(e) => setCashierFilter(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">Tous les caissiers</option>
          {cashiers.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {filtered.length > 0 && (
          <button type="button" onClick={exportCsv} className="text-xs text-slate-600 hover:underline">
            Exporter CSV
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-400">
              <th className="pb-2">Caissier</th>
              <th className="pb-2">Ouverture</th>
              <th className="pb-2">Fermeture</th>
              <th className="pb-2">Fond de caisse</th>
              <th className="pb-2">Cash</th>
              <th className="pb-2">Wave</th>
              <th className="pb-2">Attendu</th>
              <th className="pb-2">Déclaré</th>
              <th className="pb-2">Écart</th>
              <th className="pb-2">Statut</th>
              <th className="pb-2">Correction</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 align-top">
                <td className="py-2 pr-2">{c.cashier.name}</td>
                <td className="py-2 pr-2 whitespace-nowrap">{new Date(c.openedAt).toLocaleString("fr-FR")}</td>
                <td className="py-2 pr-2 whitespace-nowrap">
                  {c.closedAt ? new Date(c.closedAt).toLocaleString("fr-FR") : "-"}
                </td>
                <td className="py-2 pr-2">{c.openingFloat.toLocaleString("fr-FR")} F</td>
                <td className="py-2 pr-2">{c.totalCash != null ? `${c.totalCash.toLocaleString("fr-FR")} F` : "-"}</td>
                <td className="py-2 pr-2">{c.totalWave != null ? `${c.totalWave.toLocaleString("fr-FR")} F` : "-"}</td>
                <td className="py-2 pr-2">
                  {c.expectedCash != null ? `${c.expectedCash.toLocaleString("fr-FR")} F` : "-"}
                </td>
                <td className="py-2 pr-2 font-semibold">
                  {c.declaredAmount != null ? `${c.declaredAmount.toLocaleString("fr-FR")} F` : "-"}
                </td>
                <td className="py-2 pr-2">
                  {c.difference == null ? (
                    <span className="text-slate-400">-</span>
                  ) : c.difference === 0 ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Juste</span>
                  ) : (
                    <div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          c.difference < 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {formatSignedFCFA(c.difference)}
                      </span>
                      {c.note && <div className="mt-1 text-xs text-slate-500">{c.note}</div>}
                    </div>
                  )}
                </td>
                <td className="py-2 pr-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      c.status === "OUVERTE" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {c.status === "OUVERTE" ? "En cours" : "Clôturée"}
                  </span>
                </td>
                <td className="py-2 pr-2 text-xs">
                  {c.correctedAmount != null ? (
                    <div>
                      <div className="font-semibold text-orange-700">
                        {c.correctedAmount.toLocaleString("fr-FR")} F
                      </div>
                      <div className="text-slate-500">{c.correctionNote}</div>
                      <div className="text-slate-400">
                        par {c.correctedBy?.name} le{" "}
                        {c.correctedAt ? new Date(c.correctedAt).toLocaleDateString("fr-FR") : ""}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="py-2 pr-2 text-right">
                  {editingId === c.id ? (
                      <div className="flex flex-col items-end gap-1">
                        <input
                          type="number"
                          min={0}
                          value={correctedAmount}
                          onChange={(e) => setCorrectedAmount(e.target.value)}
                          className="w-28 rounded-md border border-slate-300 px-2 py-1 text-xs"
                          placeholder="Montant corrigé"
                        />
                        <input
                          value={correctionNote}
                          onChange={(e) => setCorrectionNote(e.target.value)}
                          className="w-40 rounded-md border border-slate-300 px-2 py-1 text-xs"
                          placeholder="Motif"
                        />
                        <div className="flex gap-2">
                          <button
                            disabled={isPending}
                            onClick={() => submitCorrection(c.id)}
                            className="rounded-md bg-black px-2 py-1 text-xs text-white hover:bg-neutral-800 disabled:opacity-50"
                          >
                            Enregistrer
                          </button>
                          <button
                            onClick={cancelCorrection}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-3">
                        <Link
                          href={`/caisse/versements/${c.id}`}
                          className="whitespace-nowrap text-xs text-orange-600 hover:underline"
                        >
                          Détail
                        </Link>
                        {c.status === "FERMEE" && (
                          <button
                            onClick={() => startCorrection(c)}
                            className="text-xs text-slate-600 hover:underline"
                          >
                            Corriger
                          </button>
                        )}
                      </div>
                    )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="py-4 text-center text-slate-400">
                  Aucun versement enregistré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

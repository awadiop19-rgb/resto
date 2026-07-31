"use client";

import { useState } from "react";
import { StatTile } from "@/components/stat-tile";
import { formatFCFA } from "@/lib/format";
import type { ComptabiliteData } from "@/lib/comptabilite";
import { VoletDepenses } from "./volet-depenses";
import { VoletVentes } from "./volet-ventes";
import { VoletVersements } from "./volet-versements";

const VOLETS = [
  { id: "versements", label: "Versements" },
  { id: "ventes", label: "Ventes" },
  { id: "depenses", label: "Dépenses" },
] as const;

type VoletId = (typeof VOLETS)[number]["id"];

export function ComptabiliteDashboard({ data }: { data: ComptabiliteData }) {
  const [volet, setVolet] = useState<VoletId>("versements");

  return (
    <div className="space-y-5">
      {/* Synthèse : toujours visible, quel que soit le volet consulté. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Recettes"
          value={formatFCFA(data.recettes)}
          tone="bon"
          hint="Espèces versées (hors fond de caisse) + Wave"
        />
        <StatTile label="Dépenses" value={formatFCFA(data.totalDepenses)} tone="critique" />
        <StatTile
          label="Résultat"
          value={formatFCFA(data.resultat)}
          tone={data.resultat >= 0 ? "bon" : "critique"}
          hint={data.periodeLabel}
        />
      </div>

      <div className="border-b border-slate-200">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Volets de la comptabilité">
          {VOLETS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={volet === v.id}
              onClick={() => setVolet(v.id)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm transition ${
                volet === v.id
                  ? "border-orange-500 font-semibold text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {volet === "versements" && <VoletVersements data={data} />}
      {volet === "ventes" && <VoletVentes data={data} />}
      {volet === "depenses" && <VoletDepenses data={data} />}
    </div>
  );
}

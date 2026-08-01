"use client";

import Link from "next/link";
import { useState } from "react";
import { StatTile } from "@/components/stat-tile";
import { formatFCFA } from "@/lib/format";
import type { StockData } from "@/lib/stock-data";
import { FormulaireMouvement } from "./formulaire-mouvement";
import { VoletMouvements } from "./volet-mouvements";
import { VoletProduits } from "./volet-produits";

const VOLETS = [
  { id: "produits", label: "Par produit" },
  { id: "mouvements", label: "Mouvements" },
] as const;

type VoletId = (typeof VOLETS)[number]["id"];

export function StockDashboard({ data }: { data: StockData }) {
  const [volet, setVolet] = useState<VoletId>("produits");

  const enAlerte = data.ruptures.length + data.sousSeuil.length;

  return (
    <div className="space-y-5">
      {/* Synthèse : valeur immobilisée et alertes restent visibles quel que soit le volet. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Valeur du stock"
          value={formatFCFA(data.valeurStock)}
          hint="Au coût moyen d'achat"
        />
        <StatTile
          label="Produits suivis"
          value={data.produitsSuivis.toLocaleString("fr-FR")}
          hint={`${data.ruptures.length} en rupture`}
        />
        <StatTile
          label="À réapprovisionner"
          value={enAlerte.toLocaleString("fr-FR")}
          tone={enAlerte > 0 ? "alerte" : "bon"}
          hint="Stock nul ou sous le seuil"
        />
        <StatTile
          label="Achats de la période"
          value={formatFCFA(data.achatsPeriode)}
          hint={`Sorties cuisine : ${formatFCFA(data.sortiesPeriode)}`}
        />
      </div>

      <FormulaireMouvement produits={data.options} />

      <div className="border-b border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Volets du stock">
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
          <Link href="/produits" className="pb-2 text-xs text-orange-600 hover:underline">
            Gérer les produits
          </Link>
        </div>
      </div>

      {volet === "produits" && <VoletProduits data={data} />}
      {volet === "mouvements" && <VoletMouvements data={data} />}
    </div>
  );
}

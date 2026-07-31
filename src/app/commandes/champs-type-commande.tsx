"use client";

import type { OrderType } from "@/generated/prisma/client";
import { TYPE_LABELS } from "@/lib/libelles-commande";
import { SelecteurQuartier } from "@/components/selecteur-quartier";
import type { QuartierOption } from "@/lib/quartiers";

export type InfosCommande = {
  type: OrderType;
  tableNumber: string;
  customerName: string;
  customerPhone: string;
  quartierId: string;
  deliveryAddress: string;
  deliveryNote: string;
};

export const INFOS_VIDES: InfosCommande = {
  type: "SUR_PLACE",
  tableNumber: "",
  customerName: "",
  customerPhone: "",
  quartierId: "",
  deliveryAddress: "",
  deliveryNote: "",
};

const TYPES: OrderType[] = ["SUR_PLACE", "A_EMPORTER", "LIVRAISON"];

/**
 * Champs communs aux deux façons de saisir une commande (liste et photos) :
 * le mode de service, puis ce qu'il implique — un n° de table sur place, les
 * coordonnées du client pour une livraison.
 */
export function ChampsTypeCommande({
  infos,
  onChange,
  quartiers,
  compact = false,
}: {
  infos: InfosCommande;
  onChange: (infos: InfosCommande) => void;
  quartiers: QuartierOption[];
  compact?: boolean;
}) {
  const set = (champ: keyof InfosCommande, valeur: string) =>
    onChange({ ...infos, [champ]: valeur });

  const classeChamp = compact
    ? "w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
    : "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base";

  return (
    <div className="space-y-3">
      <div>
        <span className="mb-1.5 block text-sm text-slate-600">Type de commande</span>
        <div className="grid grid-cols-3 gap-1.5">
          {TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onChange({ ...infos, type })}
              aria-pressed={infos.type === type}
              className={`min-h-10 rounded-lg px-2 text-xs font-medium transition ${
                infos.type === type
                  ? "bg-black text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {infos.type === "SUR_PLACE" && (
        <div>
          <label className="mb-1 block text-sm text-slate-600" htmlFor="champ-table">
            N° de table
          </label>
          <input
            id="champ-table"
            type="number"
            inputMode="numeric"
            min={1}
            value={infos.tableNumber}
            onChange={(e) => set("tableNumber", e.target.value)}
            className={classeChamp}
          />
        </div>
      )}

      {infos.type !== "SUR_PLACE" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-slate-600" htmlFor="champ-client">
              Nom du client{infos.type === "LIVRAISON" && <span className="text-red-500"> *</span>}
            </label>
            <input
              id="champ-client"
              type="text"
              value={infos.customerName}
              onChange={(e) => set("customerName", e.target.value)}
              placeholder="Amadou Diallo"
              className={classeChamp}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600" htmlFor="champ-tel">
              Téléphone{infos.type === "LIVRAISON" && <span className="text-red-500"> *</span>}
            </label>
            <input
              id="champ-tel"
              type="tel"
              inputMode="tel"
              value={infos.customerPhone}
              onChange={(e) => set("customerPhone", e.target.value)}
              placeholder="77 000 00 00"
              className={classeChamp}
            />
          </div>
        </div>
      )}

      {infos.type === "LIVRAISON" && (
        <>
          <SelecteurQuartier
            quartiers={quartiers}
            valeur={infos.quartierId}
            onChange={(quartierId) => onChange({ ...infos, quartierId })}
            compact={compact}
          />
          <div>
            <label className="mb-1 block text-sm text-slate-600" htmlFor="champ-adresse">
              Adresse précise <span className="text-red-500">*</span>
            </label>
            <textarea
              id="champ-adresse"
              rows={2}
              value={infos.deliveryAddress}
              onChange={(e) => set("deliveryAddress", e.target.value)}
              placeholder="Quartier, rue, n° de villa, point de repère…"
              className={classeChamp}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600" htmlFor="champ-indication">
              Indication pour le livreur <span className="text-slate-400">(facultatif)</span>
            </label>
            <input
              id="champ-indication"
              type="text"
              value={infos.deliveryNote}
              onChange={(e) => set("deliveryNote", e.target.value)}
              placeholder="Ex : 2e étage, appeler en arrivant"
              className={classeChamp}
            />
          </div>
        </>
      )}
    </div>
  );
}

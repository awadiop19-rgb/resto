"use client";

import { useState, useTransition } from "react";
import { avancerLivraison } from "@/lib/actions/livraison";
import { formatFCFA } from "@/lib/format";
import { DELIVERY_CLASSES, DELIVERY_LABELS } from "@/lib/libelles-commande";
import type { DeliveryStatus } from "@/generated/prisma/client";

type Ligne = {
  id: string;
  reference: string | null;
  deliveryStatus: DeliveryStatus | null;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  deliveryNote: string | null;
  quartierName: string | null;
  livreurName: string | null;
  assignedAt: Date | null;
  deliveredAt: Date | null;
  paye: boolean;
  articles: string;
  sousTotal: number;
  deliveryFee: number | null;
  total: number;
};

export function MesLivraisons({
  commandes,
  montrerLivreur,
}: {
  commandes: Ligne[];
  montrerLivreur: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [enCoursId, setEnCoursId] = useState<string | null>(null);

  const aFaire = commandes.filter((c) => c.deliveryStatus !== "LIVREE");
  const faites = commandes.filter((c) => c.deliveryStatus === "LIVREE");

  function avancer(id: string, statut: "EN_ROUTE" | "LIVREE" | "ECHOUEE") {
    setError(null);
    if (statut === "LIVREE" && !window.confirm("Confirmer la remise de cette commande au client ?")) {
      return;
    }
    setEnCoursId(id);
    startTransition(async () => {
      try {
        await avancerLivraison({ orderId: id, statut });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de la mise à jour");
      } finally {
        setEnCoursId(null);
      }
    });
  }

  return (
    <div className="space-y-5">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {aFaire.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-400">
          Aucune livraison en cours. 🛵
        </p>
      )}

      <div className="space-y-3">
        {aFaire.map((commande) => {
          const traitement = isPending && enCoursId === commande.id;
          return (
            <div key={commande.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold tracking-wider">
                      {commande.reference ?? "—"}
                    </span>
                    {commande.deliveryStatus && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${DELIVERY_CLASSES[commande.deliveryStatus]}`}
                      >
                        {DELIVERY_LABELS[commande.deliveryStatus]}
                      </span>
                    )}
                    {!commande.paye && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                        À encaisser à la remise
                      </span>
                    )}
                    {montrerLivreur && commande.livreurName && (
                      <span className="text-xs text-slate-500">— {commande.livreurName}</span>
                    )}
                  </div>

                  <p className="mt-2 text-lg font-semibold">{commande.customerName ?? "Client"}</p>
                  {commande.quartierName && (
                    <p className="text-sm font-medium text-orange-700">{commande.quartierName}</p>
                  )}
                  <p className="text-base text-slate-700">{commande.deliveryAddress}</p>
                  {commande.deliveryNote && (
                    <p className="mt-0.5 text-sm italic text-slate-500">{commande.deliveryNote}</p>
                  )}
                  <p className="mt-2 text-sm text-slate-500">{commande.articles}</p>
                </div>

                <div className="text-right">
                  <p className="text-lg font-semibold tabular-nums">{formatFCFA(commande.total)}</p>
                  {commande.deliveryFee ? (
                    <p className="text-xs text-slate-400">
                      dont {formatFCFA(commande.deliveryFee)} de livraison
                    </p>
                  ) : null}
                  {commande.customerPhone && (
                    <a
                      href={`tel:${commande.customerPhone.replace(/\s/g, "")}`}
                      className="mt-2 inline-flex min-h-11 items-center rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-800 transition hover:bg-slate-200"
                    >
                      Appeler {commande.customerPhone}
                    </a>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                {commande.deliveryStatus !== "EN_ROUTE" && (
                  <button
                    type="button"
                    disabled={traitement}
                    onClick={() => avancer(commande.id, "EN_ROUTE")}
                    className="min-h-12 flex-1 rounded-lg bg-orange-500 px-4 text-base font-medium text-black transition hover:bg-orange-400 disabled:opacity-40"
                  >
                    Je pars livrer
                  </button>
                )}
                <button
                  type="button"
                  disabled={traitement}
                  onClick={() => avancer(commande.id, "LIVREE")}
                  className="min-h-12 flex-1 rounded-lg bg-emerald-600 px-4 text-base font-medium text-white transition hover:bg-emerald-700 disabled:opacity-40"
                >
                  {traitement ? "…" : "Commande livrée"}
                </button>
                <button
                  type="button"
                  disabled={traitement}
                  onClick={() => avancer(commande.id, "ECHOUEE")}
                  className="min-h-12 rounded-lg border border-slate-300 px-4 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  Échec
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {faites.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold">
            Livrées
            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
              {faites.length}
            </span>
          </h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {faites.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-mono text-xs">{c.reference ?? "—"}</span>{" "}
                  <span className="text-slate-600">{c.customerName ?? "Client"}</span>
                </span>
                <span className="text-xs text-slate-400">
                  {c.deliveredAt ? new Date(c.deliveredAt).toLocaleString("fr-FR") : ""}
                </span>
                <span className="font-semibold tabular-nums">{formatFCFA(c.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

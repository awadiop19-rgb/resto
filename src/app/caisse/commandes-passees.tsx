"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { payOrder } from "@/lib/actions/caisse";
import { assurerSucces } from "@/lib/actions/resultat";
import { CHART } from "@/lib/chart-theme";
import { formatFCFA, formatHeure } from "@/lib/format";
import { SOURCE_LABELS, TYPE_CLASSES, TYPE_LABELS } from "@/lib/libelles-commande";
import { totalCommande } from "@/lib/total-commande";
import type { OrderSource, OrderType, PaymentMethod } from "@/generated/prisma/client";

type CommandePassee = {
  id: string;
  createdAt: Date;
  source: OrderSource;
  type: OrderType;
  tableNumber: number | null;
  customerName: string | null;
  deliveryFee: number | null;
  paiement: { method: PaymentMethod; paidAt: Date } | null;
  items: { id: string; quantity: number; unitPrice: number; name: string }[];
};

function libelleCommande(commande: CommandePassee) {
  if (commande.tableNumber) return `Table ${commande.tableNumber}`;
  return commande.customerName ?? "Commande en ligne";
}

/**
 * Les commandes des services précédents, jour par jour. Une impayée d'hier reste
 * encaissable d'ici : la sortir de l'écran du jour ne doit pas la rendre
 * inatteignable.
 */
export function CommandesPassees({
  jour,
  commandes,
  caisseOuverte,
}: {
  jour: string;
  commandes: CommandePassee[];
  caisseOuverte: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<"toutes" | "impayees">("toutes");

  const impayees = commandes.filter((c) => !c.paiement);
  const visibles = filtre === "impayees" ? impayees : commandes;

  const encaisse = commandes
    .filter((c) => c.paiement)
    .reduce((s, c) => s + totalCommande(c.items, c.deliveryFee), 0);
  const restant = impayees.reduce((s, c) => s + totalCommande(c.items, c.deliveryFee), 0);

  function changerJour(valeur: string) {
    if (!valeur) return;
    startTransition(() => {
      router.push(`${pathname}?jour=${valeur}`);
    });
  }

  function encaisser(orderId: string, method: "CASH" | "WAVE") {
    setError(null);
    if (!caisseOuverte) {
      setError("Ouvrez votre caisse avant d'encaisser un paiement");
      return;
    }
    setPayingOrderId(orderId);
    startTransition(async () => {
      try {
        assurerSucces(await payOrder({ orderId, method }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de l'encaissement");
      } finally {
        setPayingOrderId(null);
      }
    });
  }

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-4 transition-opacity ${
        isPending ? "opacity-60" : ""
      }`}
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold">Commandes du passé</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Le service d&apos;un jour va de 6h00 au lendemain 6h00.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500" htmlFor="jour-passe">
              Journée
            </label>
            <input
              id="jour-passe"
              type="date"
              value={jour}
              onChange={(e) => changerJour(e.target.value)}
              className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            />
          </div>
          <div className="flex gap-1 pb-0.5">
            {(["toutes", "impayees"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltre(f)}
                aria-pressed={filtre === f}
                className={`rounded-md px-2.5 py-1.5 text-xs transition ${
                  filtre === f
                    ? "bg-slate-900 font-medium text-white"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {f === "toutes" ? `Toutes (${commandes.length})` : `Non encaissées (${impayees.length})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {commandes.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500">
          <span>
            Encaissé :{" "}
            <span className="font-semibold text-slate-900 tabular-nums">{formatFCFA(encaisse)}</span>
          </span>
          {restant > 0 && (
            <span>
              Reste à encaisser :{" "}
              <span className="font-semibold text-[#b47400] tabular-nums">{formatFCFA(restant)}</span>
            </span>
          )}
        </div>
      )}

      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-400">
              <th className="pb-2 pr-2 font-medium">Heure</th>
              <th className="pb-2 pr-2 font-medium">Origine</th>
              <th className="pb-2 pr-2 font-medium">Commande</th>
              <th className="pb-2 pr-2 font-medium">Articles</th>
              <th className="pb-2 pr-2 font-medium">Total</th>
              <th className="pb-2 pr-2 font-medium">Règlement</th>
              <th className="pb-2 pr-2"></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((commande) => {
              const total = totalCommande(commande.items, commande.deliveryFee);
              const enCours = isPending && payingOrderId === commande.id;
              return (
                <tr key={commande.id} className="border-t border-slate-100 align-top">
                  <td className="whitespace-nowrap py-2 pr-2 text-slate-500 tabular-nums">
                    {formatHeure(commande.createdAt)}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-2">
                    <span className="text-slate-600">{SOURCE_LABELS[commande.source]}</span>
                    {/* Le mode de service n'est montré que s'il dit autre chose que l'origine. */}
                    {TYPE_LABELS[commande.type] !== SOURCE_LABELS[commande.source] && (
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-xs ${TYPE_CLASSES[commande.type]}`}
                      >
                        {TYPE_LABELS[commande.type]}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-2 font-medium">{libelleCommande(commande)}</td>
                  <td className="py-2 pr-2 text-slate-600">
                    {commande.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                  </td>
                  <td className="py-2 pr-2 font-semibold tabular-nums">{formatFCFA(total)}</td>
                  <td className="whitespace-nowrap py-2 pr-2">
                    {commande.paiement ? (
                      <span className="inline-flex items-center gap-1.5 text-slate-600">
                        <span
                          className="h-2 w-2 rounded-sm"
                          style={{
                            backgroundColor:
                              commande.paiement.method === "CASH" ? CHART.especes : CHART.wave,
                          }}
                        />
                        {commande.paiement.method === "CASH" ? "Espèces" : "Wave"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        Non encaissée
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right">
                    {!commande.paiement && (
                      <div className="flex justify-end gap-2">
                        <button
                          disabled={isPending || !caisseOuverte}
                          title={
                            caisseOuverte ? undefined : "Ouvrez votre caisse avant d'encaisser un paiement"
                          }
                          onClick={() => encaisser(commande.id, "CASH")}
                          className="rounded-md bg-emerald-600 px-3 py-1 text-xs text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {enCours ? "..." : "Payer Cash"}
                        </button>
                        <button
                          disabled={isPending || !caisseOuverte}
                          title={
                            caisseOuverte ? undefined : "Ouvrez votre caisse avant d'encaisser un paiement"
                          }
                          onClick={() => encaisser(commande.id, "WAVE")}
                          className="rounded-md bg-sky-600 px-3 py-1 text-xs text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {enCours ? "..." : "Payer Wave"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-400">
                  {commandes.length === 0
                    ? "Aucune commande ce jour-là."
                    : "Aucune commande non encaissée ce jour-là."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

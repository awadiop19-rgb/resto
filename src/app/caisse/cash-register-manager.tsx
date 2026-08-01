"use client";

import { useRef, useState, useTransition } from "react";
import { openCashRegister, payOrder } from "@/lib/actions/caisse";
import { assurerSucces } from "@/lib/actions/resultat";
import type { PaymentMethod } from "@/generated/prisma/client";
import { CHART } from "@/lib/chart-theme";
import { formatFCFA } from "@/lib/format";
import { totalCommande } from "@/lib/total-commande";
import { FermetureCaisseForm } from "./fermeture-caisse-form";

type Payment = { id: string; amount: number; method: PaymentMethod };
type CashRegister = {
  id: string;
  openedAt: Date;
  openingFloat: number;
  payments: Payment[];
};

type OrderItem = {
  id: string;
  quantity: number;
  unitPrice: number;
  menuItem: { name: string };
};
type UnpaidOrder = {
  id: string;
  tableNumber: number | null;
  customerName: string | null;
  source: "INTERNE" | "EN_LIGNE";
  createdAt: Date;
  deliveryFee: number | null;
  waveDeclaredAt: Date | null;
  waveReference: string | null;
  items: OrderItem[];
};

type PaidOrder = {
  paymentId: string;
  paidAt: Date;
  method: PaymentMethod;
  amount: number;
  tableNumber: number | null;
  customerName: string | null;
  items: { id: string; quantity: number; name: string }[];
};

function libelleCommande(order: { tableNumber: number | null; customerName: string | null }) {
  if (order.tableNumber) return `Table ${order.tableNumber}`;
  return order.customerName ?? "Commande en ligne";
}

export function CashRegisterManager({
  cashRegister,
  unpaidOrders,
  paidOrders,
}: {
  cashRegister: CashRegister | null;
  unpaidOrders: UnpaidOrder[];
  paidOrders: PaidOrder[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openingFloat, setOpeningFloat] = useState("0");
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const ouvertureRef = useRef<HTMLDivElement>(null);

  const totalCash = cashRegister?.payments.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amount, 0) ?? 0;
  const totalWave = cashRegister?.payments.filter((p) => p.method === "WAVE").reduce((s, p) => s + p.amount, 0) ?? 0;

  // Le tiroir est versé en entier à la comptabilité : le fond de caisse fait partie de l'attendu.
  const expectedCash = (cashRegister?.openingFloat ?? 0) + totalCash;

  const restantAEncaisser = unpaidOrders.reduce(
    (somme, order) => somme + totalCommande(order.items, order.deliveryFee),
    0,
  );
  const dejaEncaisse = paidOrders.reduce((s, order) => s + order.amount, 0);

  // Un bouton désactivé sans explication laisse le caissier deviner : l'infobulle
  // dit pourquoi, la bannière au-dessus dit quoi faire.
  const caisseFermeeMessage = cashRegister
    ? undefined
    : "Ouvrez votre caisse avant d'encaisser un paiement";

  function handleOpen() {
    setError(null);
    startTransition(async () => {
      try {
        assurerSucces(await openCashRegister(Number(openingFloat) || 0));
        setOpeningFloat("0");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de l'ouverture de la caisse");
      }
    });
  }

  function handlePay(orderId: string, method: "CASH" | "WAVE") {
    setError(null);
    // Deuxième barrière, après le serveur : sans caisse ouverte, aucun
    // encaissement ne part, et le caissier est renvoyé vers l'ouverture.
    if (!cashRegister) {
      setError("Ouvrez votre caisse avant d'encaisser un paiement");
      ouvertureRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
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
    <div className="space-y-6">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!cashRegister ? (
        <div ref={ouvertureRef} className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h2 className="mb-3 font-semibold text-[#8a5900]">Ouvrir la caisse</h2>
          <p className="mb-3 text-sm text-[#8a5900]">
            Votre journée n&apos;est pas ouverte. Tant qu&apos;elle ne l&apos;est pas, aucun
            encaissement n&apos;est possible : indiquez votre fond de caisse pour démarrer.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-600" htmlFor="openingFloat">
              Fond de caisse initial
            </label>
            <input
              id="openingFloat"
              type="number"
              min={0}
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
              className="w-32 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
            <button
              disabled={isPending}
              onClick={handleOpen}
              className="rounded-md bg-black px-4 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              Ouvrir la caisse
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Caisse ouverte</h2>
            <span className="text-xs text-slate-500">
              Depuis {new Date(cashRegister.openedAt).toLocaleString("fr-FR")}
            </span>
          </div>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <div className="text-slate-500">Fond de caisse</div>
              <div className="font-semibold">{cashRegister.openingFloat.toLocaleString("fr-FR")} F</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <div className="text-slate-500">Total encaissé (Cash)</div>
              <div className="font-semibold">{totalCash.toLocaleString("fr-FR")} F</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <div className="text-slate-500">Total encaissé (Wave)</div>
              <div className="font-semibold">{totalWave.toLocaleString("fr-FR")} F</div>
            </div>
            <div className="rounded-lg bg-orange-50 p-3 text-sm">
              <div className="text-orange-700">Espèces attendues en caisse</div>
              <div className="font-semibold text-orange-800">{expectedCash.toLocaleString("fr-FR")} F</div>
              <div className="mt-0.5 text-xs text-orange-600">Fond de caisse + encaissements Cash</div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <FermetureCaisseForm openingFloat={cashRegister.openingFloat} totalCash={totalCash} />
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">
            À encaisser
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {unpaidOrders.length}
            </span>
          </h2>
          {unpaidOrders.length > 0 && (
            <span className="text-sm text-slate-500">
              Reste à encaisser :{" "}
              <span className="font-semibold text-slate-900 tabular-nums">
                {formatFCFA(restantAEncaisser)}
              </span>
            </span>
          )}
        </div>
        {!cashRegister && unpaidOrders.length > 0 && (
          <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-[#8a5900]">
            Encaissement suspendu : ouvrez d&apos;abord votre journée de caisse ci-dessus.
          </p>
        )}
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-400">
              <th className="pb-2">Commande</th>
              <th className="pb-2">Articles</th>
              <th className="pb-2">Total</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {unpaidOrders.map((order) => {
              const total = totalCommande(order.items, order.deliveryFee);
              const isPayingThis = isPending && payingOrderId === order.id;
              return (
                <tr key={order.id} className="border-t border-slate-100 align-top">
                  <td className="py-2 pr-2">
                    {libelleCommande(order)}
                    <div className="text-xs text-slate-400">
                      {new Date(order.createdAt).toLocaleString("fr-FR")}
                    </div>
                    {order.waveDeclaredAt && (
                      <div className="mt-1 rounded-md bg-sky-50 px-2 py-1 text-xs text-sky-800">
                        <span className="font-semibold">Paiement Wave annoncé</span> à{" "}
                        {new Date(order.waveDeclaredAt).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {order.waveReference && (
                          <>
                            {" · "}
                            <span className="font-mono">{order.waveReference}</span>
                          </>
                        )}
                        <div className="text-sky-700">À vérifier dans Wave avant d&apos;encaisser.</div>
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-slate-600">
                    {order.items.map((i) => `${i.quantity}x ${i.menuItem.name}`).join(", ")}
                  </td>
                  <td className="py-2 pr-2 font-semibold tabular-nums">{formatFCFA(total)}</td>
                  <td className="py-2 pr-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        disabled={isPending || !cashRegister}
                        title={caisseFermeeMessage}
                        onClick={() => handlePay(order.id, "CASH")}
                        className="rounded-md bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isPayingThis ? "..." : "Payer Cash"}
                      </button>
                      <button
                        disabled={isPending || !cashRegister}
                        title={caisseFermeeMessage}
                        onClick={() => handlePay(order.id, "WAVE")}
                        className="rounded-md bg-sky-600 px-3 py-1 text-xs text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isPayingThis ? "..." : "Payer Wave"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {unpaidOrders.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-slate-400">
                  Aucune commande en attente de paiement.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">
            Déjà encaissées
            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
              {paidOrders.length}
            </span>
          </h2>
          {paidOrders.length > 0 && (
            <span className="text-sm text-slate-500">
              Total encaissé :{" "}
              <span className="font-semibold text-slate-900 tabular-nums">{formatFCFA(dejaEncaisse)}</span>
            </span>
          )}
        </div>
        <p className="mb-3 text-xs text-slate-400">Vos encaissements de la journée, du plus récent au plus ancien.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-400">
                <th className="pb-2 pr-2 font-medium">Heure</th>
                <th className="pb-2 pr-2 font-medium">Commande</th>
                <th className="pb-2 pr-2 font-medium">Articles</th>
                <th className="pb-2 pr-2 font-medium">Mode</th>
                <th className="pb-2 pr-2 text-right font-medium">Montant</th>
              </tr>
            </thead>
            <tbody>
              {paidOrders.map((order) => (
                <tr key={order.paymentId} className="border-t border-slate-100 align-top">
                  <td className="whitespace-nowrap py-2 pr-2 text-slate-500 tabular-nums">
                    {new Date(order.paidAt).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-2 pr-2 font-medium">{libelleCommande(order)}</td>
                  <td className="py-2 pr-2 text-slate-600">
                    {order.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-sm"
                        style={{
                          backgroundColor: order.method === "CASH" ? CHART.especes : CHART.wave,
                        }}
                      />
                      {order.method === "CASH" ? "Espèces" : "Wave"}
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-right font-semibold tabular-nums">
                    {formatFCFA(order.amount)}
                  </td>
                </tr>
              ))}
              {paidOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-400">
                    Aucune commande encaissée pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

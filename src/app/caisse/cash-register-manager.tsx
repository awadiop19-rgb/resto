"use client";

import { useState, useTransition } from "react";
import { openCashRegister, closeCashRegister, payOrder } from "@/lib/actions/caisse";
import { formatFCFA, formatSignedFCFA } from "@/lib/format";
import type { PaymentMethod } from "@/generated/prisma/client";

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
  items: OrderItem[];
};

export function CashRegisterManager({
  cashRegister,
  unpaidOrders,
}: {
  cashRegister: CashRegister | null;
  unpaidOrders: UnpaidOrder[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openingFloat, setOpeningFloat] = useState("0");
  const [declaredAmount, setDeclaredAmount] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);

  const totalCash = cashRegister?.payments.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amount, 0) ?? 0;
  const totalWave = cashRegister?.payments.filter((p) => p.method === "WAVE").reduce((s, p) => s + p.amount, 0) ?? 0;

  // Le tiroir est versé en entier à la comptabilité : le fond de caisse fait partie de l'attendu.
  const expectedCash = (cashRegister?.openingFloat ?? 0) + totalCash;
  const declaredNumber = Number(declaredAmount);
  const hasDeclared = declaredAmount !== "" && !Number.isNaN(declaredNumber);
  const difference = hasDeclared ? declaredNumber - expectedCash : 0;

  function handleOpen() {
    setError(null);
    startTransition(async () => {
      try {
        await openCashRegister(Number(openingFloat) || 0);
        setOpeningFloat("0");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de l'ouverture de la caisse");
      }
    });
  }

  function handleClose() {
    setError(null);
    if (!hasDeclared) {
      setError("Indiquez le montant des espèces comptées dans le tiroir");
      return;
    }
    if (difference !== 0 && !closeNote.trim()) {
      setError(
        `Écart de ${formatSignedFCFA(difference)} par rapport aux ${formatFCFA(expectedCash)} attendus : indiquez le motif dans la note.`,
      );
      return;
    }
    const recap =
      difference === 0
        ? `Versement de ${formatFCFA(declaredNumber)}, caisse juste.`
        : `Versement de ${formatFCFA(declaredNumber)} pour ${formatFCFA(expectedCash)} attendus, soit un écart de ${formatSignedFCFA(difference)}.`;
    if (!window.confirm(`${recap}\n\nConfirmer la fermeture de la caisse ? Cette action est définitive.`)) {
      return;
    }
    startTransition(async () => {
      try {
        await closeCashRegister({ declaredAmount: declaredNumber, note: closeNote });
        setDeclaredAmount("");
        setCloseNote("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de la fermeture de la caisse");
      }
    });
  }

  function handlePay(orderId: string, method: "CASH" | "WAVE") {
    setError(null);
    setPayingOrderId(orderId);
    startTransition(async () => {
      try {
        await payOrder({ orderId, method });
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
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold">Ouvrir la caisse</h2>
          <p className="mb-3 text-sm text-slate-500">
            Vous devez ouvrir votre caisse avant de pouvoir encaisser des paiements.
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
            <h3 className="mb-1 text-sm font-semibold">Fermer la caisse et faire le versement</h3>
            <p className="mb-3 text-xs text-slate-500">
              Comptez la totalité des espèces présentes dans le tiroir, fond de caisse compris.
            </p>
            <div className="grid gap-3 sm:grid-cols-4">
              <input
                type="number"
                min={0}
                placeholder="Espèces comptées dans le tiroir"
                value={declaredAmount}
                onChange={(e) => setDeclaredAmount(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:col-span-2"
              />
              <input
                placeholder="Note (optionnel)"
                value={closeNote}
                onChange={(e) => setCloseNote(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:col-span-1"
              />
              <button
                disabled={isPending}
                onClick={handleClose}
                className="rounded-md bg-red-600 px-4 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                Fermer la caisse
              </button>
            </div>

            {hasDeclared && (
              <div
                className={`mt-3 rounded-md px-3 py-2 text-sm ${
                  difference === 0
                    ? "bg-emerald-50 text-emerald-700"
                    : difference < 0
                      ? "bg-red-50 text-red-700"
                      : "bg-amber-50 text-amber-700"
                }`}
              >
                {difference === 0 ? (
                  <>Caisse juste : le montant compté correspond aux {formatFCFA(expectedCash)} attendus.</>
                ) : (
                  <>
                    Écart de <strong>{formatSignedFCFA(difference)}</strong>{" "}
                    {difference < 0 ? "(manquant)" : "(excédent)"} sur les {formatFCFA(expectedCash)} attendus.
                    Expliquez-le dans la note.
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">Commandes en attente de paiement</h2>
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
              const total = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
              const isPayingThis = isPending && payingOrderId === order.id;
              return (
                <tr key={order.id} className="border-t border-slate-100 align-top">
                  <td className="py-2 pr-2">
                    {order.tableNumber ? `Table ${order.tableNumber}` : (order.customerName ?? "Commande en ligne")}
                    <div className="text-xs text-slate-400">
                      {new Date(order.createdAt).toLocaleString("fr-FR")}
                    </div>
                  </td>
                  <td className="py-2 pr-2 text-slate-600">
                    {order.items.map((i) => `${i.quantity}x ${i.menuItem.name}`).join(", ")}
                  </td>
                  <td className="py-2 pr-2 font-semibold">{total.toLocaleString("fr-FR")} F</td>
                  <td className="py-2 pr-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        disabled={isPending}
                        onClick={() => handlePay(order.id, "CASH")}
                        className="rounded-md bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {isPayingThis ? "..." : "Payer Cash"}
                      </button>
                      <button
                        disabled={isPending}
                        onClick={() => handlePay(order.id, "WAVE")}
                        className="rounded-md bg-sky-600 px-3 py-1 text-xs text-white hover:bg-sky-700 disabled:opacity-50"
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
    </div>
  );
}

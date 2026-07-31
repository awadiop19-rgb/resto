"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createOrder, updateOrder, updateOrderStatus, deleteOrder } from "@/lib/actions/orders";
import type { OrderStatus } from "@/generated/prisma/client";
import { downloadCsv } from "@/lib/csv";

const STATUS_LABELS: Record<OrderStatus, string> = {
  EN_ATTENTE: "En attente",
  EN_PREPARATION: "En préparation",
  PRETE: "Prête",
  SERVIE: "Servie",
  ANNULEE: "Annulée",
};

const STATUS_ORDER: OrderStatus[] = ["EN_ATTENTE", "EN_PREPARATION", "PRETE", "SERVIE", "ANNULEE"];

type MenuItem = { id: string; name: string; price: number };
type Category = { id: string; name: string; items: MenuItem[] };
type OrderItem = {
  id: string;
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  note: string | null;
  menuItem: { name: string };
};
type Order = {
  id: string;
  tableNumber: number | null;
  status: OrderStatus;
  source: "INTERNE" | "EN_LIGNE";
  customerName: string | null;
  customerPhone: string | null;
  createdAt: Date;
  user: { name: string } | null;
  items: OrderItem[];
  payment: { id: string } | null;
};

export function OrderBoard({
  orders,
  categories,
  role,
  blocage,
}: {
  orders: Order[];
  categories: Category[];
  role: string;
  currentUserId: string;
  /** Message de blocage si une caisse antérieure n'est pas clôturée. */
  blocage?: string | null;
}) {
  const [cart, setCart] = useState<Record<string, { quantity: number; note: string }>>({});
  const [tableNumber, setTableNumber] = useState("");
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const estBloque = Boolean(blocage);
  const canCreate = !estBloque && (role === "ADMIN" || role === "SERVEUR" || role === "CAISSIER");
  const canDelete = !estBloque && role === "ADMIN";

  const allItems = categories.flatMap((c) => c.items);

  function addToCart(id: string) {
    setCart((prev) => ({
      ...prev,
      [id]: { quantity: (prev[id]?.quantity ?? 0) + 1, note: prev[id]?.note ?? "" },
    }));
  }

  function removeFromCart(id: string) {
    setCart((prev) => {
      const current = prev[id];
      if (!current) return prev;
      const next = { ...prev };
      if (current.quantity <= 1) {
        delete next[id];
      } else {
        next[id] = { ...current, quantity: current.quantity - 1 };
      }
      return next;
    });
  }

  function updateNote(id: string, note: string) {
    setCart((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], note } } : prev));
  }

  function startEdit(order: Order) {
    setError(null);
    setEditingOrderId(order.id);
    setTableNumber(order.tableNumber ? String(order.tableNumber) : "");
    const nextCart: Record<string, { quantity: number; note: string }> = {};
    for (const item of order.items) {
      nextCart[item.menuItemId] = {
        quantity: (nextCart[item.menuItemId]?.quantity ?? 0) + item.quantity,
        note: item.note ?? "",
      };
    }
    setCart(nextCart);
  }

  function cancelEdit() {
    setEditingOrderId(null);
    setCart({});
    setTableNumber("");
    setError(null);
  }

  function submitOrder() {
    setError(null);
    const items = Object.entries(cart).map(([menuItemId, v]) => ({
      menuItemId,
      quantity: v.quantity,
      note: v.note.trim() ? v.note.trim() : undefined,
    }));
    if (items.length === 0) {
      setError("Ajoutez au moins un article au panier");
      return;
    }
    startTransition(async () => {
      try {
        if (editingOrderId) {
          await updateOrder({
            orderId: editingOrderId,
            tableNumber: tableNumber ? Number(tableNumber) : null,
            items,
          });
        } else {
          await createOrder({
            tableNumber: tableNumber ? Number(tableNumber) : undefined,
            items,
          });
        }
        setCart({});
        setTableNumber("");
        setEditingOrderId(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
      }
    });
  }

  function changeStatus(orderId: string, status: OrderStatus) {
    setError(null);
    startTransition(async () => {
      try {
        await updateOrderStatus(orderId, status);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors du changement de statut");
      }
    });
  }

  function removeOrder(orderId: string) {
    setError(null);
    if (!window.confirm("Supprimer définitivement cette commande ?")) return;
    startTransition(async () => {
      try {
        await deleteOrder(orderId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de la suppression");
      }
    });
  }

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Date", "Table", "Statut", "Serveur", "Articles", "Total (F)"],
      ...orders.map((order) => {
        const total = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
        const itemsText = order.items
          .map((i) => `${i.quantity}x ${i.menuItem.name}${i.note ? ` (${i.note})` : ""}`)
          .join(" | ");
        return [
          new Date(order.createdAt).toLocaleString("fr-FR"),
          order.tableNumber ? `Table ${order.tableNumber}` : "À emporter",
          STATUS_LABELS[order.status],
          order.source === "EN_LIGNE" ? `${order.customerName} (${order.customerPhone})` : (order.user?.name ?? ""),
          itemsText,
          total,
        ];
      }),
    ];
    downloadCsv(`commandes_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  const cartTotal = Object.entries(cart).reduce((sum, [id, v]) => {
    const item = allItems.find((m) => m.id === id);
    return sum + (item ? item.price * v.quantity : 0);
  }, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {blocage && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 lg:col-span-3">
          <p className="font-semibold text-red-800">Service suspendu</p>
          <p className="mt-1 text-sm text-red-700">{blocage}</p>
          <Link
            href="/caisse"
            className="mt-3 inline-block rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-red-700"
          >
            Clôturer ma caisse
          </Link>
        </div>
      )}

      {/* Bandeau hors du panneau de saisie : la cuisine n'a pas ce panneau mais peut
          déclencher des erreurs en changeant un statut. */}
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 lg:col-span-3">{error}</p>
      )}
      {canCreate && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 lg:col-span-1">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{editingOrderId ? "Modifier la commande" : "Nouvelle commande"}</h2>
            {editingOrderId && (
              <button type="button" onClick={cancelEdit} className="text-xs text-slate-500 hover:underline">
                Annuler
              </button>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">N° de table</label>
            <input
              type="number"
              min={1}
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
            {categories.map((category) => (
              <div key={category.id}>
                <h3 className="text-xs font-semibold uppercase text-slate-400">{category.name}</h3>
                <ul className="mt-1 space-y-1">
                  {category.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between text-sm">
                      <span>
                        {item.name} <span className="text-slate-400">({item.price} F)</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="h-6 w-6 rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                        >
                          -
                        </button>
                        <span className="w-4 text-center">{cart[item.id]?.quantity ?? 0}</span>
                        <button
                          type="button"
                          onClick={() => addToCart(item.id)}
                          className="h-6 w-6 rounded bg-orange-100 text-orange-700 hover:bg-orange-200"
                        >
                          +
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {Object.keys(cart).length > 0 && (
            <div className="space-y-2 rounded-md border border-slate-100 bg-slate-50 p-2">
              <h3 className="text-xs font-semibold uppercase text-slate-400">Panier</h3>
              {Object.entries(cart).map(([id, v]) => {
                const item = allItems.find((m) => m.id === id);
                if (!item) return null;
                return (
                  <div key={id} className="space-y-1 border-b border-slate-200 pb-2 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        {v.quantity} × {item.name}
                      </span>
                      <span className="text-slate-400">{item.price * v.quantity} F</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Note (ex: sans oignon)"
                      value={v.note}
                      onChange={(e) => updateNote(id, e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-sm font-medium">Total : {cartTotal} F</span>
            <button
              type="button"
              disabled={isPending}
              onClick={submitOrder}
              className="rounded-md bg-black px-4 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {editingOrderId ? "Enregistrer" : "Envoyer"}
            </button>
          </div>
        </div>
      )}

      <div className={canCreate ? "space-y-3 lg:col-span-2" : "space-y-3 lg:col-span-3"}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Commandes en cours</h2>
          {orders.length > 0 && (
            <button
              type="button"
              onClick={exportCsv}
              className="text-xs text-slate-600 hover:underline"
            >
              Exporter CSV
            </button>
          )}
        </div>
        {orders.length === 0 && <p className="text-sm text-slate-500">Aucune commande.</p>}
        {orders.map((order) => {
          const total = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
          return (
            <div key={order.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {order.tableNumber ? `Table ${order.tableNumber}` : "À emporter"}{" "}
                    <span className="text-xs text-slate-400">
                      · {order.source === "EN_LIGNE" ? `${order.customerName} (${order.customerPhone})` : order.user?.name}
                    </span>
                    {order.source === "EN_LIGNE" && (
                      <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-orange-700">
                        Commande en ligne
                      </span>
                    )}
                    {order.payment && (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                        Encaissée
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(order.createdAt).toLocaleString("fr-FR")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={order.status}
                    disabled={estBloque}
                    onChange={(e) => changeStatus(order.id, e.target.value as OrderStatus)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  {canCreate && order.status !== "SERVIE" && order.status !== "ANNULEE" && !order.payment && (
                    <button
                      onClick={() => startEdit(order)}
                      className="text-xs text-slate-600 hover:underline"
                    >
                      Modifier
                    </button>
                  )}
                  {canDelete && !order.payment && (
                    <button
                      onClick={() => removeOrder(order.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
              <ul className="mt-2 space-y-0.5 text-sm text-slate-600">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.quantity} × {item.menuItem.name}{" "}
                    <span className="text-slate-400">({item.unitPrice * item.quantity} F)</span>
                    {item.note && <span className="italic text-slate-400"> — {item.note}</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-right text-sm font-semibold">Total : {total} F</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

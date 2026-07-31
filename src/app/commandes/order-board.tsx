"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createOrder, updateOrder, updateOrderStatus, deleteOrder } from "@/lib/actions/orders";
import type { DeliveryStatus, OrderStatus, OrderType } from "@/generated/prisma/client";
import { downloadCsv } from "@/lib/csv";
import { PriseCommandePhotos } from "./prise-commande-photos";
import { ChampsTypeCommande, INFOS_VIDES, type InfosCommande } from "./champs-type-commande";
import { totalCommande } from "@/lib/total-commande";
import type { QuartierOption } from "@/lib/quartiers";
import {
  DELIVERY_CLASSES,
  DELIVERY_LABELS,
  SOURCE_LABELS,
  TYPE_CLASSES,
  TYPE_LABELS,
} from "@/lib/libelles-commande";

const STATUS_LABELS: Record<OrderStatus, string> = {
  EN_ATTENTE: "En attente",
  EN_PREPARATION: "En préparation",
  PRETE: "Prête",
  SERVIE: "Servie",
  ANNULEE: "Annulée",
};

const STATUS_ORDER: OrderStatus[] = ["EN_ATTENTE", "EN_PREPARATION", "PRETE", "SERVIE", "ANNULEE"];

type MenuItem = { id: string; name: string; price: number; imageUrl: string | null };
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
  reference: string | null;
  tableNumber: number | null;
  status: OrderStatus;
  source: "INTERNE" | "EN_LIGNE";
  type: OrderType;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  deliveryNote: string | null;
  deliveryStatus: DeliveryStatus | null;
  quartierId: string | null;
  quartierName: string | null;
  deliveryFee: number | null;
  livreur: { name: string } | null;
  createdAt: Date;
  user: { name: string } | null;
  items: OrderItem[];
  payment: { id: string } | null;
};

export function OrderBoard({
  orders,
  categories,
  quartiers,
  role,
  blocage,
}: {
  orders: Order[];
  categories: Category[];
  quartiers: QuartierOption[];
  role: string;
  currentUserId: string;
  /** Message de blocage si une caisse antérieure n'est pas clôturée. */
  blocage?: string | null;
}) {
  const [cart, setCart] = useState<Record<string, { quantity: number; note: string }>>({});
  const [infos, setInfos] = useState<InfosCommande>(INFOS_VIDES);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Le caissier travaille sur tablette : la carte en photos lui est proposée d'emblée.
  const [vue, setVue] = useState<"photos" | "liste">(role === "CAISSIER" ? "photos" : "liste");

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
    setInfos({
      type: order.type,
      tableNumber: order.tableNumber ? String(order.tableNumber) : "",
      customerName: order.customerName ?? "",
      customerPhone: order.customerPhone ?? "",
      quartierId: order.quartierId ?? "",
      deliveryAddress: order.deliveryAddress ?? "",
      deliveryNote: order.deliveryNote ?? "",
    });
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
    setInfos(INFOS_VIDES);
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
    if (
      infos.type === "LIVRAISON" &&
      !(infos.customerName.trim() && infos.customerPhone.trim() && infos.deliveryAddress.trim())
    ) {
      setError("Une livraison exige le nom, le téléphone et l'adresse du client.");
      return;
    }
    if (infos.type === "LIVRAISON" && !infos.quartierId) {
      setError("Choisissez le quartier de livraison : il détermine le tarif.");
      return;
    }

    const communs = {
      type: infos.type,
      customerName: infos.customerName.trim() || undefined,
      customerPhone: infos.customerPhone.trim() || undefined,
      quartierId: infos.quartierId || undefined,
      deliveryAddress: infos.deliveryAddress.trim() || undefined,
      deliveryNote: infos.deliveryNote.trim() || undefined,
      items,
    };

    startTransition(async () => {
      try {
        if (editingOrderId) {
          await updateOrder({
            ...communs,
            orderId: editingOrderId,
            tableNumber: infos.tableNumber ? Number(infos.tableNumber) : null,
          });
        } else {
          await createOrder({
            ...communs,
            tableNumber: infos.tableNumber ? Number(infos.tableNumber) : undefined,
          });
        }
        setCart({});
        setInfos(INFOS_VIDES);
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
      ["Date", "Référence", "Origine", "Type", "Table", "Statut", "Livraison", "Livreur", "Client", "Articles", "Total (F)"],
      ...orders.map((order) => {
        const total = totalCommande(order.items, order.deliveryFee);
        const itemsText = order.items
          .map((i) => `${i.quantity}x ${i.menuItem.name}${i.note ? ` (${i.note})` : ""}`)
          .join(" | ");
        return [
          new Date(order.createdAt).toLocaleString("fr-FR"),
          order.reference ?? "",
          SOURCE_LABELS[order.source],
          TYPE_LABELS[order.type],
          order.tableNumber ?? "",
          STATUS_LABELS[order.status],
          order.deliveryStatus ? DELIVERY_LABELS[order.deliveryStatus] : "",
          order.livreur?.name ?? "",
          order.customerName ?? order.user?.name ?? "",
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

  const vuePhotos = canCreate && vue === "photos";

  return (
    <div className="space-y-6">
      {canCreate && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{editingOrderId ? "Modifier la commande" : "Nouvelle commande"}</h2>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            {(["photos", "liste"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVue(v)}
                aria-pressed={vue === v}
                className={`min-h-10 rounded-md px-4 text-sm transition ${
                  vue === v ? "bg-black font-medium text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {v === "photos" ? "Photos" : "Liste"}
              </button>
            ))}
          </div>
        </div>
      )}

      {vuePhotos && (
        <PriseCommandePhotos
          categories={categories}
          quartiers={quartiers}
          cart={cart}
          allItems={allItems}
          cartTotal={cartTotal}
          infos={infos}
          editingOrderId={editingOrderId}
          isPending={isPending}
          onAdd={addToCart}
          onRemove={removeFromCart}
          onNote={updateNote}
          onInfos={setInfos}
          onSubmit={submitOrder}
          onCancelEdit={cancelEdit}
        />
      )}

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
      {canCreate && vue === "liste" && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 lg:col-span-1">
          {editingOrderId && (
            <div className="flex items-center justify-end">
              <button type="button" onClick={cancelEdit} className="text-xs text-slate-500 hover:underline">
                Annuler la modification
              </button>
            </div>
          )}
          <ChampsTypeCommande infos={infos} onChange={setInfos} quartiers={quartiers} compact />

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

      <div
        className={
          canCreate && vue === "liste" ? "space-y-3 lg:col-span-2" : "space-y-3 lg:col-span-3"
        }
      >
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
          const total = totalCommande(order.items, order.deliveryFee);
          return (
            <div key={order.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {order.reference && (
                      <span className="font-mono text-xs font-bold tracking-wider text-slate-500">
                        {order.reference}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${TYPE_CLASSES[order.type]}`}
                    >
                      {TYPE_LABELS[order.type]}
                      {order.type === "SUR_PLACE" && order.tableNumber ? ` ${order.tableNumber}` : ""}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        order.source === "EN_LIGNE"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {SOURCE_LABELS[order.source]}
                    </span>
                    {order.deliveryStatus && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${DELIVERY_CLASSES[order.deliveryStatus]}`}
                      >
                        {DELIVERY_LABELS[order.deliveryStatus]}
                      </span>
                    )}
                    {order.payment && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                        Encaissée
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-medium">
                    {order.customerName ?? (order.tableNumber ? `Table ${order.tableNumber}` : "Client")}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      {order.customerPhone ?? order.user?.name ?? ""}
                    </span>
                  </p>
                  {order.type === "LIVRAISON" && (
                    <p className="text-xs text-slate-500">
                      {order.quartierName && (
                        <span className="font-medium text-slate-600">{order.quartierName} · </span>
                      )}
                      {order.deliveryAddress}
                      {order.livreur && ` · livreur : ${order.livreur.name}`}
                    </p>
                  )}
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
              <div className="mt-2 text-right text-sm">
                {order.deliveryFee ? (
                  <p className="text-xs text-slate-400">
                    Articles {order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)} F +
                    livraison {order.deliveryFee} F
                  </p>
                ) : null}
                <p className="font-semibold">Total : {total} F</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </div>
  );
}

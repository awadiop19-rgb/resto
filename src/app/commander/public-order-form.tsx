"use client";

import { useState, useTransition } from "react";
import { createPublicOrder } from "@/lib/actions/orders";

type MenuItem = { id: string; name: string; price: number; description: string | null };
type Category = { id: string; name: string; items: MenuItem[] };

function formatFCFA(value: number) {
  return `${value.toLocaleString("fr-FR")} F`;
}

export function PublicOrderForm({ categories }: { categories: Category[] }) {
  const [cart, setCart] = useState<Record<string, { quantity: number; note: string }>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);

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

  const cartTotal = Object.entries(cart).reduce((sum, [id, v]) => {
    const item = allItems.find((m) => m.id === id);
    return sum + (item ? item.price * v.quantity : 0);
  }, 0);

  function submit() {
    setError(null);

    const items = Object.entries(cart).map(([menuItemId, v]) => ({
      menuItemId,
      quantity: v.quantity,
      note: v.note.trim() ? v.note.trim() : undefined,
    }));

    if (items.length === 0) {
      setError("Ajoutez au moins un article à votre commande.");
      return;
    }
    if (!name.trim() || !phone.trim()) {
      setError("Merci de renseigner votre nom et votre numéro de téléphone.");
      return;
    }

    startTransition(async () => {
      try {
        const orderId = await createPublicOrder({
          customerName: name.trim(),
          customerPhone: phone.trim(),
          items,
        });
        setConfirmedOrderId(orderId);
        setCart({});
      } catch (e) {
        setError(e instanceof Error ? e.message : "Une erreur est survenue, merci de réessayer.");
      }
    });
  }

  if (confirmedOrderId) {
    return (
      <div className="rounded-xl border border-orange-200 bg-white p-8 text-center shadow-sm">
        <p className="text-4xl">✅</p>
        <h2 className="mt-3 text-2xl font-bold text-black">Merci {name || "!"} !</h2>
        <p className="mt-2 text-slate-600">
          Votre commande a bien été envoyée à notre équipe. Nous vous contactons très vite au{" "}
          <span className="font-semibold text-black">{phone}</span> pour confirmer.
        </p>
        <p className="mt-1 text-xs text-slate-400">Référence commande : {confirmedOrderId}</p>
        <button
          type="button"
          onClick={() => {
            setConfirmedOrderId(null);
            setName("");
            setPhone("");
          }}
          className="mt-6 rounded-md bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          Passer une nouvelle commande
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-8 lg:col-span-2">
        {categories
          .filter((category) => category.items.length > 0)
          .map((category) => (
            <div key={category.id}>
              <h2 className="mb-3 text-lg font-semibold text-black">{category.name}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {category.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4"
                  >
                    <div>
                      <p className="font-medium text-black">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-slate-500">{item.description}</p>
                      )}
                      <p className="mt-1 text-sm font-semibold text-orange-600">
                        {formatFCFA(item.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="h-7 w-7 rounded bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                      >
                        -
                      </button>
                      <span className="w-4 text-center text-sm">{cart[item.id]?.quantity ?? 0}</span>
                      <button
                        type="button"
                        onClick={() => addToCart(item.id)}
                        className="h-7 w-7 rounded bg-orange-100 text-orange-700 hover:bg-orange-200"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>

      <div className="h-fit space-y-4 rounded-xl border border-neutral-200 bg-white p-4 lg:sticky lg:top-24">
        <h2 className="font-semibold text-black">Votre commande</h2>

        {Object.keys(cart).length === 0 && (
          <p className="text-sm text-slate-400">Votre panier est vide.</p>
        )}

        <div className="space-y-2">
          {Object.entries(cart).map(([id, v]) => {
            const item = allItems.find((m) => m.id === id);
            if (!item) return null;
            return (
              <div key={id} className="space-y-1 border-b border-neutral-100 pb-2 last:border-0">
                <div className="flex items-center justify-between text-sm">
                  <span>
                    {v.quantity} × {item.name}
                  </span>
                  <span className="text-slate-500">{formatFCFA(item.price * v.quantity)}</span>
                </div>
                <input
                  type="text"
                  placeholder="Note (ex: sans piment)"
                  value={v.note}
                  onChange={(e) => updateNote(id, e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs"
                />
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-neutral-100 pt-3 text-sm font-semibold">
          <span>Total</span>
          <span>{formatFCFA(cartTotal)}</span>
        </div>

        <div className="space-y-3 border-t border-neutral-100 pt-3">
          <div>
            <label className="mb-1 block text-sm text-slate-600">Nom complet</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Amadou Diallo"
              className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Numéro de téléphone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="77 000 00 00"
              className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          type="button"
          disabled={isPending}
          onClick={submit}
          className="w-full rounded-md bg-orange-500 py-2.5 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:opacity-50"
        >
          {isPending ? "Envoi en cours..." : "Envoyer ma commande"}
        </button>
      </div>
    </div>
  );
}

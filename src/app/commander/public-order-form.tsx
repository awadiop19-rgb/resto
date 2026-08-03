"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createPublicOrder } from "@/lib/actions/orders";
import { assurerSucces } from "@/lib/actions/resultat";
import { SelecteurQuartier } from "@/components/selecteur-quartier";
import { PaiementWave } from "@/components/paiement-wave";
import type { QuartierOption } from "@/lib/quartiers";

type MenuItem = { id: string; name: string; price: number; description: string | null };
type Category = { id: string; name: string; items: MenuItem[] };

function formatFCFA(value: number) {
  return `${value.toLocaleString("fr-FR")} F`;
}

export function PublicOrderForm({
  categories,
  quartiers,
}: {
  categories: Category[];
  quartiers: QuartierOption[];
}) {
  const [cart, setCart] = useState<Record<string, { quantity: number; note: string }>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [mode, setMode] = useState<"A_EMPORTER" | "LIVRAISON">("A_EMPORTER");
  const [quartierId, setQuartierId] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  // Le panier est vidé après envoi : on fige le montant dû pour l'écran de paiement.
  const [montantDu, setMontantDu] = useState(0);

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

  const quartierChoisi = quartiers.find((q) => q.id === quartierId);
  const fraisLivraison = mode === "LIVRAISON" ? (quartierChoisi?.fee ?? 0) : 0;
  const totalAPayer = cartTotal + fraisLivraison;

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
    if (mode === "LIVRAISON" && !quartierId) {
      setError("Merci de choisir votre quartier de livraison.");
      return;
    }
    if (mode === "LIVRAISON" && !address.trim()) {
      setError("Merci d'indiquer l'adresse de livraison.");
      return;
    }

    startTransition(async () => {
      try {
        const nouvelleReference = assurerSucces(
          await createPublicOrder({
            customerName: name.trim(),
            customerPhone: phone.trim(),
            type: mode,
            quartierId: mode === "LIVRAISON" ? quartierId : undefined,
            deliveryAddress: mode === "LIVRAISON" ? address.trim() : undefined,
            deliveryNote:
              mode === "LIVRAISON" && deliveryNote.trim() ? deliveryNote.trim() : undefined,
            items,
          }),
        );
        setReference(nouvelleReference);
        setMontantDu(totalAPayer);
        setCart({});
      } catch (e) {
        setError(e instanceof Error ? e.message : "Une erreur est survenue, merci de réessayer.");
      }
    });
  }

  if (reference) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-orange-200 bg-white p-8 text-center shadow-sm">
        <p className="text-4xl">✅</p>
        <h2 className="mt-3 text-2xl font-bold text-slate-900">Merci {name || "!"} !</h2>
        <p className="mt-2 text-slate-600">
          {mode === "LIVRAISON"
            ? "Votre commande part en préparation. Un livreur vous l'apportera à l'adresse indiquée."
            : "Votre commande part en préparation. Vous pourrez la retirer au restaurant."}{" "}
          Nous vous appelons au <span className="font-semibold text-slate-900">{phone}</span> si besoin.
        </p>

        <div className="mt-6 rounded-xl bg-slate-50 p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Numéro de commande</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-[0.2em] text-slate-900">{reference}</p>
          <p className="mt-2 text-xs text-slate-500">
            Notez-le : il vous permet de suivre votre commande.
          </p>
        </div>

        <div className="mt-6 text-left">
          <PaiementWave reference={reference} montant={montantDu} />
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href={`/suivi?ref=${reference}`}
            className="rounded-md bg-orange-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-orange-400"
          >
            Suivre ma commande
          </Link>
          <button
            type="button"
            onClick={() => {
              setReference(null);
              setName("");
              setPhone("");
              setAddress("");
              setDeliveryNote("");
              setMode("A_EMPORTER");
            }}
            className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-semibold transition hover:bg-slate-50"
          >
            Nouvelle commande
          </button>
        </div>
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
              <h2 className="mb-3 text-lg font-semibold text-slate-900">{category.name}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {category.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{item.name}</p>
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
                        className="h-7 w-7 rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
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

      <div className="h-fit space-y-4 rounded-xl border border-slate-200 bg-white p-4 lg:sticky lg:top-24">
        <h2 className="font-semibold text-slate-900">Votre commande</h2>

        {Object.keys(cart).length === 0 && (
          <p className="text-sm text-slate-400">Votre panier est vide.</p>
        )}

        <div className="space-y-2">
          {Object.entries(cart).map(([id, v]) => {
            const item = allItems.find((m) => m.id === id);
            if (!item) return null;
            return (
              <div key={id} className="space-y-1 border-b border-slate-100 pb-2 last:border-0">
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
                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                />
              </div>
            );
          })}
        </div>

        <div className="space-y-1 border-t border-slate-100 pt-3 text-sm">
          <div className="flex items-center justify-between text-slate-600">
            <span>Sous-total</span>
            <span>{formatFCFA(cartTotal)}</span>
          </div>
          {mode === "LIVRAISON" && (
            <div className="flex items-center justify-between text-slate-600">
              <span>
                Livraison
                {quartierChoisi && (
                  <span className="text-xs text-slate-400"> · {quartierChoisi.zoneName}</span>
                )}
              </span>
              <span>{quartierChoisi ? formatFCFA(fraisLivraison) : "à définir"}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1 text-base font-semibold">
            <span>Total</span>
            <span>{formatFCFA(totalAPayer)}</span>
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-3">
          <div>
            <span className="mb-1.5 block text-sm text-slate-600">Comment souhaitez-vous être servi ?</span>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { valeur: "A_EMPORTER", label: "À emporter", detail: "Je viens la chercher" },
                  { valeur: "LIVRAISON", label: "Livraison", detail: "Livrée chez moi" },
                ] as const
              ).map((option) => (
                <button
                  key={option.valeur}
                  type="button"
                  onClick={() => setMode(option.valeur)}
                  aria-pressed={mode === option.valeur}
                  className={`rounded-lg border px-3 py-2.5 text-left transition ${
                    mode === option.valeur
                      ? "border-orange-500 bg-orange-50 ring-1 ring-orange-200"
                      : "border-slate-300 hover:border-orange-300"
                  }`}
                >
                  <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
                  <span className="block text-xs text-slate-500">{option.detail}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">Nom complet</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Amadou Diallo"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Numéro de téléphone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="77 000 00 00"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
            />
          </div>

          {mode === "LIVRAISON" && (
            <>
              <SelecteurQuartier
                quartiers={quartiers}
                valeur={quartierId}
                onChange={setQuartierId}
                compact
              />
              <div>
                <label className="mb-1 block text-sm text-slate-600" htmlFor="adresse-livraison">
                  Adresse précise
                </label>
                <textarea
                  id="adresse-livraison"
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Quartier, rue, n° de villa, point de repère…"
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600" htmlFor="indication-livraison">
                  Indication pour le livreur <span className="text-slate-400">(facultatif)</span>
                </label>
                <input
                  id="indication-livraison"
                  type="text"
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  placeholder="Ex : 2e étage, appeler en arrivant"
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                />
              </div>
            </>
          )}
        </div>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          type="button"
          disabled={isPending}
          onClick={submit}
          className="w-full rounded-md bg-orange-500 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-orange-400 disabled:opacity-50"
        >
          {isPending ? "Envoi en cours..." : "Envoyer ma commande"}
        </button>
      </div>
    </div>
  );
}

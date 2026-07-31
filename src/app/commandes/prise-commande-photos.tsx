"use client";

import { useMemo, useState } from "react";
import { formatFCFA } from "@/lib/format";

type MenuItem = { id: string; name: string; price: number; imageUrl: string | null };
type Category = { id: string; name: string; items: MenuItem[] };
type Cart = Record<string, { quantity: number; note: string }>;

/** Retire accents et casse : « thiéré » doit se trouver en tapant « thiere ». */
function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Prise de commande sur tablette : on tape la photo du plat pour l'ajouter.
 * Les cibles tactiles font au moins 44 px et la vignette entière est cliquable.
 */
export function PriseCommandePhotos({
  categories,
  cart,
  allItems,
  cartTotal,
  tableNumber,
  editingOrderId,
  isPending,
  onAdd,
  onRemove,
  onNote,
  onTableNumber,
  onSubmit,
  onCancelEdit,
}: {
  categories: Category[];
  cart: Cart;
  allItems: MenuItem[];
  cartTotal: number;
  tableNumber: string;
  editingOrderId: string | null;
  isPending: boolean;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onNote: (id: string, note: string) => void;
  onTableNumber: (value: string) => void;
  onSubmit: () => void;
  onCancelEdit: () => void;
}) {
  const [recherche, setRecherche] = useState("");
  const [categorieActive, setCategorieActive] = useState<string | null>(null);

  const categoriesAffichees = useMemo(() => {
    const terme = normalize(recherche.trim());
    return categories
      .filter((c) => !categorieActive || c.id === categorieActive)
      .map((c) => ({
        ...c,
        items: terme ? c.items.filter((i) => normalize(i.name).includes(terme)) : c.items,
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, categorieActive, recherche]);

  const nbArticles = Object.values(cart).reduce((s, l) => s + l.quantity, 0);
  const lignesPanier = Object.entries(cart)
    .map(([id, ligne]) => ({ item: allItems.find((m) => m.id === id), ...ligne, id }))
    .filter((l): l is typeof l & { item: MenuItem } => Boolean(l.item));

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* ---------------- Carte en photos ---------------- */}
      <div className="md:col-span-2">
        <div className="mb-3 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher un plat…"
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-base"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategorieActive(null)}
              aria-pressed={categorieActive === null}
              className={`min-h-11 rounded-lg px-4 text-sm transition ${
                categorieActive === null
                  ? "bg-black font-medium text-white"
                  : "border border-slate-200 text-slate-600"
              }`}
            >
              Tout
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategorieActive(c.id)}
                aria-pressed={categorieActive === c.id}
                className={`min-h-11 rounded-lg px-4 text-sm transition ${
                  categorieActive === c.id
                    ? "bg-black font-medium text-white"
                    : "border border-slate-200 text-slate-600"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {categoriesAffichees.map((category) => (
            <div key={category.id}>
              <h3 className="mb-2 flex items-center gap-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                {category.name}
                <span className="h-px flex-1 bg-slate-200" />
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {category.items.map((item) => {
                  const quantite = cart[item.id]?.quantity ?? 0;
                  return (
                    <div key={item.id} className="relative">
                      <button
                        type="button"
                        onClick={() => onAdd(item.id)}
                        aria-label={`Ajouter ${item.name}`}
                        className={`w-full overflow-hidden rounded-xl border bg-white text-left transition active:scale-[0.98] ${
                          quantite > 0
                            ? "border-orange-500 ring-2 ring-orange-200"
                            : "border-slate-200 hover:border-orange-300"
                        }`}
                      >
                        <div className="relative aspect-4/3 w-full bg-slate-100">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imageUrl}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-3xl opacity-40">
                              🍽️
                            </div>
                          )}
                          {quantite > 0 && (
                            <span className="absolute right-2 top-2 flex h-8 min-w-8 items-center justify-center rounded-full bg-orange-500 px-2 text-sm font-bold text-white shadow">
                              {quantite}
                            </span>
                          )}
                        </div>
                        <div className="p-2.5">
                          <p className="line-clamp-2 text-sm font-medium leading-snug">{item.name}</p>
                          <p className="mt-0.5 text-sm text-slate-500 tabular-nums">
                            {formatFCFA(item.price)}
                          </p>
                        </div>
                      </button>

                      {quantite > 0 && (
                        <button
                          type="button"
                          onClick={() => onRemove(item.id)}
                          aria-label={`Retirer ${item.name}`}
                          className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-lg font-bold text-slate-700 shadow ring-1 ring-slate-200"
                        >
                          −
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {categoriesAffichees.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-white py-10 text-center text-sm text-slate-400">
              Aucun plat ne correspond à cette recherche.
            </p>
          )}
        </div>
      </div>

      {/* ---------------- Panier ---------------- */}
      <div className="md:col-span-1">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 md:sticky md:top-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">
              {editingOrderId ? "Modifier la commande" : "Commande en cours"}
            </h2>
            {editingOrderId && (
              <button type="button" onClick={onCancelEdit} className="text-xs text-slate-500 hover:underline">
                Annuler
              </button>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600" htmlFor="numero-table">
              N° de table
            </label>
            <input
              id="numero-table"
              type="number"
              inputMode="numeric"
              min={1}
              value={tableNumber}
              onChange={(e) => onTableNumber(e.target.value)}
              placeholder="À emporter si vide"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
            />
          </div>

          <div className="max-h-[26rem] space-y-2 overflow-y-auto">
            {lignesPanier.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">
                Touchez une photo pour ajouter un plat.
              </p>
            )}
            {lignesPanier.map((ligne) => (
              <div key={ligne.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onRemove(ligne.id)}
                    aria-label={`Retirer ${ligne.item.name}`}
                    className="h-9 w-9 shrink-0 rounded-lg bg-white text-lg font-bold text-slate-600 ring-1 ring-slate-200"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-semibold tabular-nums">{ligne.quantity}</span>
                  <button
                    type="button"
                    onClick={() => onAdd(ligne.id)}
                    aria-label={`Ajouter ${ligne.item.name}`}
                    className="h-9 w-9 shrink-0 rounded-lg bg-orange-100 text-lg font-bold text-orange-700"
                  >
                    +
                  </button>
                  <span className="min-w-0 flex-1 truncate text-sm">{ligne.item.name}</span>
                  <span className="shrink-0 text-sm text-slate-500 tabular-nums">
                    {formatFCFA(ligne.item.price * ligne.quantity)}
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="Note (ex : sans oignon)"
                  value={ligne.note}
                  onChange={(e) => onNote(ligne.id, e.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-3">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-sm text-slate-500">
                {nbArticles} article{nbArticles > 1 ? "s" : ""}
              </span>
              <span className="text-xl font-semibold tabular-nums">{formatFCFA(cartTotal)}</span>
            </div>
            <button
              type="button"
              disabled={isPending || nbArticles === 0}
              onClick={onSubmit}
              className="min-h-12 w-full rounded-lg bg-black text-base font-medium text-white transition hover:bg-neutral-800 disabled:opacity-40"
            >
              {isPending ? "Envoi…" : editingOrderId ? "Enregistrer" : "Envoyer en cuisine"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

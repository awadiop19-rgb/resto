"use client";

import { useState, useTransition } from "react";
import {
  createCategory,
  createMenuItem,
  deleteCategory,
  deleteMenuItem,
  toggleAvailability,
  updateMenuItem,
} from "@/lib/actions/menu";
import { assurerSucces } from "@/lib/actions/resultat";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  available: boolean;
  categoryId: string;
};
type Category = { id: string; name: string; items: MenuItem[] };

export function MenuManager({ categories, isAdmin }: { categories: Category[]; isAdmin: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [newItem, setNewItem] = useState<Record<string, { name: string; price: string; description: string }>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ name: string; price: string; description: string }>({
    name: "",
    price: "",
    description: "",
  });

  function handleError(e: unknown) {
    setError(e instanceof Error ? e.message : "Une erreur est survenue");
  }

  /** Actions déclenchées d'un seul clic : leur refus doit s'afficher, pas se perdre. */
  function lancer(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        assurerSucces(await action());
      } catch (e) {
        handleError(e);
      }
    });
  }

  function addCategory() {
    setError(null);
    startTransition(async () => {
      try {
        assurerSucces(await createCategory(newCategory));
        setNewCategory("");
      } catch (e) {
        handleError(e);
      }
    });
  }

  function addItem(categoryId: string) {
    setError(null);
    const draft = newItem[categoryId];
    if (!draft?.name || !draft?.price) {
      setError("Nom et prix requis");
      return;
    }
    startTransition(async () => {
      try {
        assurerSucces(
          await createMenuItem({
            name: draft.name,
            description: draft.description || undefined,
            price: Number(draft.price),
            categoryId,
            available: true,
          })
        );
        setNewItem((prev) => ({ ...prev, [categoryId]: { name: "", price: "", description: "" } }));
      } catch (e) {
        handleError(e);
      }
    });
  }

  function startEdit(item: MenuItem) {
    setEditingId(item.id);
    setEditValues({ name: item.name, price: String(item.price), description: item.description ?? "" });
  }

  function saveEdit(item: MenuItem) {
    startTransition(async () => {
      try {
        assurerSucces(
          await updateMenuItem(item.id, {
            name: editValues.name,
            description: editValues.description || undefined,
            price: Number(editValues.price),
            categoryId: item.categoryId,
            available: item.available,
          })
        );
        setEditingId(null);
      } catch (e) {
        handleError(e);
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {isAdmin && (
        <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex-1">
            <label className="mb-1 block text-sm text-slate-600">Nouvelle catégorie</label>
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              placeholder="Ex : Desserts"
            />
          </div>
          <button
            disabled={isPending}
            onClick={addCategory}
            className="rounded-md bg-black px-4 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>
      )}

      {categories.map((category) => (
        <div key={category.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{category.name}</h2>
            {isAdmin && (
              <button
                onClick={() => lancer(() => deleteCategory(category.id))}
                className="text-xs text-red-600 hover:underline"
              >
                Supprimer la catégorie
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-400">
                <th className="pb-2">Nom</th>
                <th className="pb-2">Prix</th>
                <th className="pb-2">Disponible</th>
                {isAdmin && <th className="pb-2">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {category.items.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  {editingId === item.id ? (
                    <>
                      <td className="py-2 pr-2">
                        <input
                          value={editValues.name}
                          onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))}
                          className="w-full rounded border border-slate-300 px-2 py-1"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          value={editValues.price}
                          onChange={(e) => setEditValues((v) => ({ ...v, price: e.target.value }))}
                          className="w-24 rounded border border-slate-300 px-2 py-1"
                        />
                      </td>
                      <td className="py-2 pr-2">—</td>
                      <td className="py-2 pr-2 space-x-2">
                        <button onClick={() => saveEdit(item)} className="text-emerald-600 hover:underline">
                          Enregistrer
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-slate-500 hover:underline">
                          Annuler
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 pr-2">
                        <p>{item.name}</p>
                        {item.description && <p className="text-xs text-slate-400">{item.description}</p>}
                      </td>
                      <td className="py-2 pr-2">{item.price} F</td>
                      <td className="py-2 pr-2">
                        {isAdmin ? (
                          <button
                            onClick={() =>
                              lancer(() => toggleAvailability(item.id, !item.available))
                            }
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              item.available
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {item.available ? "Disponible" : "Indisponible"}
                          </button>
                        ) : (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              item.available
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {item.available ? "Disponible" : "Indisponible"}
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="space-x-2 py-2 pr-2">
                          <button onClick={() => startEdit(item)} className="text-orange-600 hover:underline">
                            Modifier
                          </button>
                          <button
                            onClick={() => lancer(() => deleteMenuItem(item.id))}
                            className="text-red-600 hover:underline"
                          >
                            Supprimer
                          </button>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {isAdmin && (
            <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
              <input
                placeholder="Nom"
                value={newItem[category.id]?.name ?? ""}
                onChange={(e) =>
                  setNewItem((prev) => ({
                    ...prev,
                    [category.id]: { ...prev[category.id], name: e.target.value, price: prev[category.id]?.price ?? "", description: prev[category.id]?.description ?? "" },
                  }))
                }
                className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
              <input
                placeholder="Prix"
                type="number"
                value={newItem[category.id]?.price ?? ""}
                onChange={(e) =>
                  setNewItem((prev) => ({
                    ...prev,
                    [category.id]: { ...prev[category.id], price: e.target.value, name: prev[category.id]?.name ?? "", description: prev[category.id]?.description ?? "" },
                  }))
                }
                className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
              <input
                placeholder="Description (optionnel)"
                value={newItem[category.id]?.description ?? ""}
                onChange={(e) =>
                  setNewItem((prev) => ({
                    ...prev,
                    [category.id]: { ...prev[category.id], description: e.target.value, name: prev[category.id]?.name ?? "", price: prev[category.id]?.price ?? "" },
                  }))
                }
                className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
              <button
                disabled={isPending}
                onClick={() => addItem(category.id)}
                className="rounded-md bg-orange-600 px-3 py-1.5 text-sm text-white hover:bg-orange-700 disabled:opacity-50"
              >
                Ajouter un article
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

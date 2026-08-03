"use client";

import { useState, useTransition } from "react";
import {
  createProduct,
  deleteProduct,
  toggleProductActive,
  updateProduct,
} from "@/lib/actions/stock";
import { assurerSucces } from "@/lib/actions/resultat";
import { CATEGORIES_PRODUIT, UNITES, formatQuantite } from "@/lib/stock";
import type { StockUnit } from "@/generated/prisma/client";

type Produit = {
  id: string;
  name: string;
  unit: StockUnit;
  category: string;
  seuilAlerte: number;
  active: boolean;
  mouvements: number;
};

type Formulaire = {
  name: string;
  unit: StockUnit;
  category: string;
  seuilAlerte: string;
  active: boolean;
};

const VIDE: Formulaire = {
  name: "",
  unit: "KG",
  category: CATEGORIES_PRODUIT[0],
  seuilAlerte: "",
  active: true,
};

const CHAMP = "rounded-md border border-slate-300 px-3 py-1.5 text-sm";

export function ProduitsManager({ produits }: { produits: Produit[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Formulaire>(VIDE);
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Formulaire>(VIDE);

  // `unknown` plutôt que `void` : les actions renvoient désormais un refus
  // éventuel, converti ici en erreur pour le `catch` ci-dessous.
  function run(action: () => Promise<unknown>, apres?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        assurerSucces(await action());
        apres?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Opération impossible");
      }
    });
  }

  function ajouter() {
    if (!form.name.trim()) {
      setError("Nom du produit requis");
      return;
    }
    run(
      () =>
        createProduct({
          name: form.name,
          unit: form.unit,
          category: form.category,
          seuilAlerte: Number(form.seuilAlerte) || 0,
          active: form.active,
        }),
      () => setForm(VIDE)
    );
  }

  function ouvrirEdition(p: Produit) {
    setError(null);
    setEditId(p.id);
    setEdit({
      name: p.name,
      unit: p.unit,
      category: p.category,
      seuilAlerte: String(p.seuilAlerte),
      active: p.active,
    });
  }

  function enregistrer(id: string) {
    run(
      () =>
        updateProduct(id, {
          name: edit.name,
          unit: edit.unit,
          category: edit.category,
          seuilAlerte: Number(edit.seuilAlerte) || 0,
          active: edit.active,
        }),
      () => setEditId(null)
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 font-semibold">Ajouter un produit</h2>
        <p className="mb-3 text-xs text-slate-400">
          L&apos;unité fixe la façon de compter le produit et ne pourra plus changer une fois qu&apos;il
          aura des mouvements.
        </p>
        {error && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input
            placeholder="Nom du produit"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={`${CHAMP} lg:col-span-2`}
            aria-label="Nom du produit"
          />
          <select
            value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value as StockUnit }))}
            className={CHAMP}
            aria-label="Unité"
          >
            {UNITES.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
          <select
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className={CHAMP}
            aria-label="Catégorie"
          >
            {CATEGORIES_PRODUIT.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="any"
            placeholder="Seuil d'alerte"
            value={form.seuilAlerte}
            onChange={(e) => setForm((f) => ({ ...f, seuilAlerte: e.target.value }))}
            className={CHAMP}
            aria-label="Seuil d'alerte"
          />
          <button
            disabled={isPending}
            onClick={ajouter}
            className="rounded-md bg-slate-900 px-4 py-1.5 text-sm text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Catalogue</h2>
          <span className="text-sm text-slate-500">
            {produits.filter((p) => p.active).length} actif(s) sur {produits.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-400">
                <th className="pb-2 pr-3 font-medium">Produit</th>
                <th className="pb-2 pr-3 font-medium">Unité</th>
                <th className="pb-2 pr-3 font-medium">Catégorie</th>
                <th className="pb-2 pr-3 font-medium">Seuil d&apos;alerte</th>
                <th className="pb-2 pr-3 font-medium">Mouvements</th>
                <th className="pb-2 pr-3 font-medium">État</th>
                <th className="pb-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {produits.map((p) =>
                editId === p.id ? (
                  <tr key={p.id} className="border-t border-slate-100 bg-slate-50">
                    <td className="py-2 pr-3">
                      <input
                        value={edit.name}
                        onChange={(e) => setEdit((f) => ({ ...f, name: e.target.value }))}
                        className={`${CHAMP} w-full`}
                        aria-label="Nom"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        value={edit.unit}
                        disabled={p.mouvements > 0}
                        onChange={(e) =>
                          setEdit((f) => ({ ...f, unit: e.target.value as StockUnit }))
                        }
                        className={`${CHAMP} disabled:bg-slate-100 disabled:text-slate-400`}
                        title={
                          p.mouvements > 0
                            ? "Unité figée : le produit a déjà des mouvements"
                            : undefined
                        }
                        aria-label="Unité"
                      >
                        {UNITES.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        value={edit.category}
                        onChange={(e) => setEdit((f) => ({ ...f, category: e.target.value }))}
                        className={CHAMP}
                        aria-label="Catégorie"
                      >
                        {CATEGORIES_PRODUIT.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={edit.seuilAlerte}
                        onChange={(e) => setEdit((f) => ({ ...f, seuilAlerte: e.target.value }))}
                        className={`${CHAMP} w-28`}
                        aria-label="Seuil d'alerte"
                      />
                    </td>
                    <td className="py-2 pr-3 text-slate-400">{p.mouvements}</td>
                    <td className="py-2 pr-3">
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={edit.active}
                          onChange={(e) => setEdit((f) => ({ ...f, active: e.target.checked }))}
                        />
                        Actif
                      </label>
                    </td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">
                      <button
                        disabled={isPending}
                        onClick={() => enregistrer(p.id)}
                        className="text-xs font-medium text-orange-600 hover:underline disabled:opacity-50"
                      >
                        Enregistrer
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        className="ml-3 text-xs text-slate-500 hover:underline"
                      >
                        Annuler
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="py-2 pr-3 font-medium">{p.name}</td>
                    <td className="py-2 pr-3 text-slate-500">
                      {UNITES.find((u) => u.value === p.unit)?.label}
                    </td>
                    <td className="py-2 pr-3 text-slate-500">{p.category}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {p.seuilAlerte > 0 ? formatQuantite(p.seuilAlerte, p.unit) : "—"}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-slate-400">{p.mouvements}</td>
                    <td className="py-2 pr-3">
                      {p.active ? (
                        <span className="text-xs text-[#0ca30c]">Actif</span>
                      ) : (
                        <span className="text-xs text-slate-400">Désactivé</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => ouvrirEdition(p)}
                        className="text-xs text-slate-600 hover:underline"
                      >
                        Modifier
                      </button>
                      <button
                        disabled={isPending}
                        onClick={() => run(() => toggleProductActive(p.id, !p.active))}
                        className="ml-3 text-xs text-slate-600 hover:underline disabled:opacity-50"
                      >
                        {p.active ? "Désactiver" : "Réactiver"}
                      </button>
                      {p.mouvements === 0 && (
                        <button
                          disabled={isPending}
                          onClick={() => run(() => deleteProduct(p.id))}
                          className="ml-3 text-xs text-red-600 hover:underline disabled:opacity-50"
                        >
                          Supprimer
                        </button>
                      )}
                    </td>
                  </tr>
                )
              )}
              {produits.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    Aucun produit. Commencez par ajouter ceux que vous achetez régulièrement.
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

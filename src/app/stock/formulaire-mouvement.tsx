"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { assurerSucces } from "@/lib/actions/resultat";
import { enregistrerMouvement } from "@/lib/actions/stock";
import { formatFCFA } from "@/lib/format";
import { formatQuantite, typesPossibles, uniteCourte } from "@/lib/stock";
import type { ProduitOption } from "@/lib/stock";
import type { StockMovementType } from "@/generated/prisma/client";

const CHAMP = "rounded-md border border-slate-300 px-3 py-1.5 text-sm";

type ModeReglement = "CASH" | "WAVE";

const AIDE: Record<StockMovementType, string> = {
  ACHAT:
    "L'achat entre en stock et crée automatiquement la dépense correspondante : ne la ressaisissez pas dans Dépenses.",
  PRODUCTION:
    "Ce que la maison a préparé entre en stock. Aucune dépense n'est créée : les ingrédients ont déjà été achetés, et les compter une seconde fois doublerait la charge.",
  SORTIE: "Les produits remis à la cuisine quittent le stock, valorisés au coût moyen d'achat.",
  AJUSTEMENT:
    "Correction d'inventaire : aligne le stock sur ce qui est réellement en réserve, sans impact sur les dépenses.",
};

export function FormulaireMouvement({ produits }: { produits: ProduitOption[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [type, setType] = useState<StockMovementType>("ACHAT");
  const [productId, setProductId] = useState(produits[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [sensNegatif, setSensNegatif] = useState(false);
  const [method, setMethod] = useState<ModeReglement>("CASH");
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const produit = useMemo(
    () => produits.find((p) => p.id === productId),
    [produits, productId]
  );

  // Le produit commande les types offerts : on n'achète pas ce qu'on prépare, et
  // on ne produit pas une canette. Si le type retenu ne convient plus au produit
  // qu'on vient de choisir, il bascule sur le premier possible plutôt que de
  // laisser un bouton actif que le serveur refuserait.
  const types = typesPossibles(produit?.faitMaison ?? false);
  const typeRetenu = types.some((t) => t.value === type) ? type : types[0].value;

  const montant = Number(quantity) > 0 && Number(unitPrice) > 0
    ? Number(quantity) * Number(unitPrice)
    : 0;

  function soumettre() {
    setError(null);
    setSucces(null);

    if (!productId) {
      setError("Choisissez un produit");
      return;
    }
    if (!(Number(quantity) > 0)) {
      setError("La quantité doit être positive");
      return;
    }
    if (typeRetenu === "ACHAT" && !(Number(unitPrice) > 0)) {
      setError("Le prix unitaire d'achat est requis");
      return;
    }

    startTransition(async () => {
      try {
        assurerSucces(
          await enregistrerMouvement({
            productId,
            type: typeRetenu,
            quantity: Number(quantity),
            sensNegatif: typeRetenu === "AJUSTEMENT" ? sensNegatif : undefined,
            unitPrice: typeRetenu === "ACHAT" ? Number(unitPrice) : undefined,
            // Seul l'achat engendre une dépense : les autres mouvements ne
            // paient rien, et leur donner un mode n'aurait rien à désigner.
            method: typeRetenu === "ACHAT" ? method : undefined,
            supplier: supplier || undefined,
            note: note || undefined,
            date,
          })
        );
        setSucces(
          `${produit?.name} : mouvement enregistré${typeRetenu === "ACHAT" ? " et passé en dépense" : ""}.`
        );
        setQuantity("");
        setUnitPrice("");
        setNote("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Enregistrement impossible");
      }
    });
  }

  if (produits.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Enregistrer un mouvement</h2>
        <p className="mt-2 text-sm text-slate-500">
          Aucun produit actif.{" "}
          <Link href="/produits" className="text-orange-600 hover:underline">
            Créez d&apos;abord vos produits
          </Link>{" "}
          pour pouvoir saisir des achats et des sorties.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 font-semibold">Enregistrer un mouvement</h2>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {types.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => {
              setType(t.value);
              setError(null);
              setSucces(null);
            }}
            aria-pressed={typeRetenu === t.value}
            className={`rounded-md px-3 py-1.5 text-sm transition ${
              typeRetenu === t.value
                ? "bg-slate-900 font-medium text-white"
                : "border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="mb-3 text-xs text-slate-400">{AIDE[typeRetenu]}</p>

      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {succes && (
        <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{succes}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs text-slate-500" htmlFor="mvt-produit">
            Produit
          </label>
          <select
            id="mvt-produit"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className={`${CHAMP} w-full`}
          >
            {produits.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — en stock : {formatQuantite(p.stock, p.unit)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="mvt-quantite">
            Quantité {produit ? `(${uniteCourte(produit.unit)})` : ""}
          </label>
          <input
            id="mvt-quantite"
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={`${CHAMP} w-full`}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="mvt-date">
            Date
          </label>
          <input
            id="mvt-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${CHAMP} w-full`}
          />
        </div>

        {typeRetenu === "ACHAT" && (
          <>
            <div>
              <label className="mb-1 block text-xs text-slate-500" htmlFor="mvt-prix">
                Prix unitaire (F)
              </label>
              <input
                id="mvt-prix"
                type="number"
                min="0"
                step="any"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className={`${CHAMP} w-full`}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500" htmlFor="mvt-fournisseur">
                Fournisseur (facultatif)
              </label>
              <input
                id="mvt-fournisseur"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className={`${CHAMP} w-full`}
              />
            </div>
            {/* L'achat crée une dépense, et une dépense sort d'une poche. Sans
                ce champ, le coffre la porterait qu'il l'ait payée ou non. */}
            <div>
              <label className="mb-1 block text-xs text-slate-500" htmlFor="mvt-mode">
                Réglé en
              </label>
              <select
                id="mvt-mode"
                value={method}
                onChange={(e) => setMethod(e.target.value as ModeReglement)}
                className={`${CHAMP} w-full`}
              >
                <option value="CASH">Espèces (coffre)</option>
                <option value="WAVE">Wave</option>
              </select>
            </div>
            <div className="flex items-end">
              <p className="text-sm text-slate-500">
                Montant :{" "}
                <span className="font-semibold text-slate-900">{formatFCFA(Math.round(montant))}</span>
              </p>
            </div>
          </>
        )}

        {typeRetenu === "AJUSTEMENT" && (
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={sensNegatif}
                onChange={(e) => setSensNegatif(e.target.checked)}
              />
              Retirer du stock (perte, casse)
            </label>
          </div>
        )}

        <div className={typeRetenu === "ACHAT" ? "lg:col-span-3" : "lg:col-span-2"}>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="mvt-note">
            Note (facultatif)
          </label>
          <input
            id="mvt-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={`${CHAMP} w-full`}
          />
        </div>

        <div className="flex items-end">
          <button
            disabled={isPending}
            onClick={soumettre}
            className="w-full rounded-md bg-slate-900 px-4 py-1.5 text-sm text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

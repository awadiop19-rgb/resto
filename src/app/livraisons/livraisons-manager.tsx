"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { assignerLivreur, retirerLivreur } from "@/lib/actions/livraison";
import { formatFCFA } from "@/lib/format";
import {
  DELIVERY_CLASSES,
  DELIVERY_LABELS,
  SOURCE_LABELS,
} from "@/lib/libelles-commande";
import type { DeliveryStatus, OrderSource, OrderStatus } from "@/generated/prisma/client";

type Ligne = {
  id: string;
  reference: string | null;
  createdAt: Date;
  source: OrderSource;
  status: OrderStatus;
  deliveryStatus: DeliveryStatus | null;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  deliveryNote: string | null;
  quartierName: string | null;
  livreur: { id: string; name: string } | null;
  assignedAt: Date | null;
  deliveredAt: Date | null;
  paye: boolean;
  articles: string;
  sousTotal: number;
  deliveryFee: number | null;
  total: number;
};

type Livreur = { id: string; name: string };

export function LivraisonsManager({
  commandes,
  livreurs,
  zonesConfigurees,
  peutConfigurer,
}: {
  commandes: Ligne[];
  livreurs: Livreur[];
  zonesConfigurees: number;
  peutConfigurer: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [livreurChoisi, setLivreurChoisi] = useState("");

  const enCours = commandes.filter((c) => c.deliveryStatus !== "LIVREE");
  const terminees = commandes.filter((c) => c.deliveryStatus === "LIVREE");
  const sansLivreur = enCours.filter((c) => !c.livreur);
  // Une commande impayée ne part pas : le livreur ne collecte pas d'argent.
  const affectables = sansLivreur.filter((c) => c.paye);
  const enAttentePaiement = sansLivreur.filter((c) => !c.paye);

  function basculer(id: string) {
    setSelection((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });
  }

  function toutSelectionner() {
    setSelection((prev) =>
      prev.size === affectables.length ? new Set() : new Set(affectables.map((c) => c.id)),
    );
  }

  function affecter() {
    setError(null);
    setSucces(null);
    if (selection.size === 0) {
      setError("Sélectionnez au moins une commande à confier.");
      return;
    }
    if (!livreurChoisi) {
      setError("Choisissez le livreur à qui confier la tournée.");
      return;
    }
    startTransition(async () => {
      try {
        const nombre = await assignerLivreur({
          orderIds: Array.from(selection),
          livreurId: livreurChoisi,
        });
        const nom = livreurs.find((l) => l.id === livreurChoisi)?.name ?? "le livreur";
        setSucces(`${nombre} commande(s) confiée(s) à ${nom}.`);
        setSelection(new Set());
        setLivreurChoisi("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de l'affectation");
      }
    });
  }

  function retirer(id: string) {
    setError(null);
    setSucces(null);
    startTransition(async () => {
      try {
        await retirerLivreur(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors du retrait du livreur");
      }
    });
  }

  return (
    <div className="space-y-5">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {succes && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{succes}</p>
      )}

      {zonesConfigurees === 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Aucune zone de livraison configurée : vos clients ne peuvent pas commander en livraison.{" "}
          {peutConfigurer ? (
            <Link href="/livraisons/zones" className="font-medium underline">
              Configurer les zones
            </Link>
          ) : (
            "Demandez à un administrateur de les configurer."
          )}
        </p>
      )}

      {livreurs.length === 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Aucun compte livreur actif. Créez-en un depuis la page Utilisateurs pour pouvoir affecter
          les tournées.
        </p>
      )}

      {/* ---------- Barre d'affectation ---------- */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold">
              À affecter
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                {affectables.length}
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {selection.size > 0
                ? `${selection.size} commande(s) sélectionnée(s)`
                : "Cochez les commandes à confier à un même livreur."}
              {enAttentePaiement.length > 0 && (
                <span className="text-amber-700">
                  {" "}
                  · {enAttentePaiement.length} en attente d&apos;encaissement
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {affectables.length > 0 && (
              <button
                type="button"
                onClick={toutSelectionner}
                className="min-h-10 rounded-md border border-slate-300 px-3 text-sm transition hover:bg-slate-50"
              >
                {selection.size === affectables.length ? "Tout décocher" : "Tout cocher"}
              </button>
            )}
            <select
              value={livreurChoisi}
              onChange={(e) => setLivreurChoisi(e.target.value)}
              disabled={livreurs.length === 0}
              className="min-h-10 rounded-md border border-slate-300 px-3 text-sm disabled:bg-slate-100"
            >
              <option value="">Choisir un livreur…</option>
              {livreurs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={isPending || selection.size === 0 || !livreurChoisi}
              onClick={affecter}
              className="min-h-10 rounded-md bg-black px-4 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-40"
            >
              {isPending ? "Affectation…" : "Confier la tournée"}
            </button>
          </div>
        </div>
      </div>

      {/* ---------- Livraisons en cours ---------- */}
      <div className="space-y-3">
        {enCours.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white py-10 text-center text-sm text-slate-400">
            Aucune livraison en cours.
          </p>
        )}

        {enCours.map((commande) => {
          // Sans encaissement, la case n'est même pas proposée.
          const selectionnable = !commande.livreur && commande.paye;
          const bloqueeFautePaiement = !commande.livreur && !commande.paye;
          const coche = selection.has(commande.id);
          return (
            <div
              key={commande.id}
              className={`rounded-xl border bg-white p-4 transition ${
                coche
                  ? "border-orange-400 ring-1 ring-orange-200"
                  : bloqueeFautePaiement
                    ? "border-slate-200 border-l-4 border-l-red-400"
                    : "border-slate-200"
              }`}
            >
              <div className="flex flex-wrap items-start gap-3">
                {selectionnable ? (
                  <label className="flex min-h-11 cursor-pointer items-center pt-0.5">
                    <input
                      type="checkbox"
                      checked={coche}
                      onChange={() => basculer(commande.id)}
                      className="h-5 w-5 accent-orange-500"
                      aria-label={`Sélectionner la commande ${commande.reference ?? ""}`}
                    />
                  </label>
                ) : bloqueeFautePaiement ? (
                  <span
                    className="flex min-h-11 items-center pt-0.5"
                    title="Encaissez cette commande avant de la confier à un livreur"
                  >
                    <input
                      type="checkbox"
                      disabled
                      className="h-5 w-5 cursor-not-allowed"
                      aria-label={`Commande ${commande.reference ?? ""} non encaissée : affectation impossible`}
                    />
                  </span>
                ) : null}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold tracking-wider">
                      {commande.reference ?? "—"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {SOURCE_LABELS[commande.source]}
                    </span>
                    {commande.deliveryStatus && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${DELIVERY_CLASSES[commande.deliveryStatus]}`}
                      >
                        {DELIVERY_LABELS[commande.deliveryStatus]}
                      </span>
                    )}
                    {!commande.paye && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                        À encaisser
                      </span>
                    )}
                  </div>

                  <p className="mt-1.5 font-medium">
                    {commande.customerName ?? "Client"}
                    {commande.customerPhone && (
                      <a
                        href={`tel:${commande.customerPhone.replace(/\s/g, "")}`}
                        className="ml-2 text-sm font-normal text-orange-600 hover:underline"
                      >
                        {commande.customerPhone}
                      </a>
                    )}
                  </p>
                  <p className="text-sm text-slate-600">
                    {commande.quartierName && (
                      <span className="font-medium text-slate-800">{commande.quartierName} · </span>
                    )}
                    {commande.deliveryAddress}
                  </p>
                  {commande.deliveryNote && (
                    <p className="text-sm italic text-slate-500">{commande.deliveryNote}</p>
                  )}
                  <p className="mt-1 text-sm text-slate-500">{commande.articles}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Reçue le {new Date(commande.createdAt).toLocaleString("fr-FR")}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-semibold tabular-nums">{formatFCFA(commande.total)}</p>
                  {commande.deliveryFee ? (
                    <p className="text-xs text-slate-400">
                      dont {formatFCFA(commande.deliveryFee)} de livraison
                    </p>
                  ) : null}
                  {commande.livreur ? (
                    <div className="mt-2">
                      <p className="text-sm">
                        <span className="text-slate-500">Livreur :</span>{" "}
                        <span className="font-medium">{commande.livreur.name}</span>
                      </p>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => retirer(commande.id)}
                        className="mt-1 text-xs text-slate-500 hover:text-red-600 hover:underline disabled:opacity-50"
                      >
                        Retirer le livreur
                      </button>
                    </div>
                  ) : bloqueeFautePaiement ? (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-red-700">Encaissement requis</p>
                      <Link href="/caisse" className="text-xs text-orange-600 hover:underline">
                        Aller à la caisse
                      </Link>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-amber-700">En attente d&apos;affectation</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---------- Livraisons terminées ---------- */}
      {terminees.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold">
            Livrées
            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
              {terminees.length}
            </span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="pb-2 pr-3 font-medium">Réf.</th>
                  <th className="pb-2 pr-3 font-medium">Client</th>
                  <th className="pb-2 pr-3 font-medium">Livreur</th>
                  <th className="pb-2 pr-3 font-medium">Livrée à</th>
                  <th className="pb-2 pr-3 text-right font-medium">Montant</th>
                </tr>
              </thead>
              <tbody>
                {terminees.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="py-2 pr-3 font-mono text-xs">{c.reference ?? "—"}</td>
                    <td className="py-2 pr-3">{c.customerName ?? "Client"}</td>
                    <td className="py-2 pr-3">{c.livreur?.name ?? "—"}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-slate-500">
                      {c.deliveredAt ? new Date(c.deliveredAt).toLocaleString("fr-FR") : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold tabular-nums">
                      {formatFCFA(c.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

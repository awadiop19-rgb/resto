"use client";

import { useState, useTransition } from "react";
import { ajouterFermeture, supprimerFermeture } from "@/lib/actions/horaires";
import { assurerSucces } from "@/lib/actions/resultat";
import { formatJourCourt, jourISO, type Fermeture } from "@/lib/horaires";

/**
 * Fermetures exceptionnelles : jours feries, conges, fermeture technique.
 *
 * Elles priment sur la grille hebdomadaire. Une fermeture d'un seul jour se
 * saisit en ne remplissant que la premiere date : la seconde suit d'elle-meme,
 * pour qu'un jour ferie ne demande pas deux saisies identiques.
 */
export function FermeturesManager({ fermetures }: { fermetures: Fermeture[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [motif, setMotif] = useState("");

  const aujourdhui = jourISO(new Date());
  const aVenir = fermetures.filter((f) => f.endDate >= aujourdhui);
  const passees = fermetures.filter((f) => f.endDate < aujourdhui);

  function lancer(action: () => Promise<unknown>, secours: string) {
    setError(null);
    startTransition(async () => {
      try {
        assurerSucces(await action());
      } catch (e) {
        setError(e instanceof Error ? e.message : secours);
      }
    });
  }

  function ajouter() {
    if (!debut) return setError("Indiquez le premier jour de fermeture.");
    // Une fermeture d'un seul jour : la date de fin reprend celle du début.
    const dernier = fin || debut;
    if (dernier < debut) return setError("La date de fin doit suivre la date de début.");

    lancer(async () => {
      assurerSucces(
        await ajouterFermeture({ startDate: debut, endDate: dernier, reason: motif.trim() }),
      );
      setDebut("");
      setFin("");
      setMotif("");
    }, "Erreur lors de l'ajout de la fermeture");
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold">Fermetures exceptionnelles</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Un jour férié, des congés, une fermeture technique. Ces dates priment sur les horaires
          ci-dessus : la commande en ligne y sera fermée même si le jour de la semaine est ouvert.
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end">
          <label className="text-sm">
            <span className="block text-slate-600">Du</span>
            <input
              type="date"
              value={debut}
              onChange={(e) => setDebut(e.target.value)}
              className="montant mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
            />
          </label>
          <label className="text-sm">
            <span className="block text-slate-600">Au (facultatif)</span>
            <input
              type="date"
              value={fin}
              min={debut || undefined}
              onChange={(e) => setFin(e.target.value)}
              className="montant mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
            />
          </label>
          <label className="text-sm">
            <span className="block text-slate-600">Motif (facultatif, visible par le client)</span>
            <input
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              maxLength={120}
              placeholder="Tabaski, congés annuels…"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5"
            />
          </label>
          <button
            type="button"
            disabled={isPending}
            onClick={ajouter}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-40"
          >
            Ajouter
          </button>
        </div>
      </div>

      {aVenir.length === 0 && passees.length === 0 && (
        <p className="text-sm text-slate-500">Aucune fermeture exceptionnelle déclarée.</p>
      )}

      {aVenir.length > 0 && (
        <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {aVenir.map((f, index) => (
            <li
              key={f.id}
              className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
                index > 0 ? "border-t border-slate-200" : ""
              }`}
            >
              <span className="montant text-sm font-medium">
                {f.startDate === f.endDate
                  ? formatJourCourt(f.startDate)
                  : `${formatJourCourt(f.startDate)} → ${formatJourCourt(f.endDate)}`}
              </span>
              {f.startDate <= aujourdhui && f.endDate >= aujourdhui && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  en cours
                </span>
              )}
              {f.reason && <span className="text-sm text-slate-600">{f.reason}</span>}
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  lancer(() => supprimerFermeture(f.id), "Erreur lors de la suppression")
                }
                className="ml-auto text-sm text-red-700 hover:underline disabled:opacity-40"
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}

      {passees.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-500">
            {passees.length} fermeture(s) passée(s)
          </summary>
          <ul className="mt-2 space-y-1">
            {passees.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 text-slate-500">
                <span className="montant">
                  {f.startDate === f.endDate
                    ? formatJourCourt(f.startDate)
                    : `${formatJourCourt(f.startDate)} → ${formatJourCourt(f.endDate)}`}
                </span>
                {f.reason && <span>{f.reason}</span>}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    lancer(() => supprimerFermeture(f.id), "Erreur lors de la suppression")
                  }
                  className="ml-auto text-red-700 hover:underline disabled:opacity-40"
                >
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

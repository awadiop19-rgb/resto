"use client";

import { useState, useTransition } from "react";
import { enregistrerHoraires } from "@/lib/actions/horaires";
import { assurerSucces } from "@/lib/actions/resultat";
import {
  JOURS_AFFICHES,
  NOMS_JOURS,
  formatHeure,
  parseHeure,
  type Horaire,
} from "@/lib/horaires";

/**
 * Reglage des heures d'ouverture de la commande en ligne.
 *
 * La semaine s'edite d'un bloc et s'enregistre d'un bouton. Un enregistrement
 * par ligne obligerait a sept validations pour un changement de saison, et
 * laisserait des jours a moitie modifies si l'on s'arrete au milieu.
 *
 * Les heures sont saisies en `<input type="time">` : le clavier du telephone y
 * ouvre un selecteur d'heure, et le navigateur refuse de lui-meme « 25:00 ».
 */
export function HorairesManager({ horaires }: { horaires: Horaire[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState(false);

  const [semaine, setSemaine] = useState<Horaire[]>(horaires);

  function modifier(weekday: number, champs: Partial<Horaire>) {
    setEnregistre(false);
    setSemaine((s) => s.map((j) => (j.weekday === weekday ? { ...j, ...champs } : j)));
  }

  function modifierHeure(weekday: number, champ: "opensAt" | "closesAt", valeur: string) {
    const minutes = parseHeure(valeur);
    // Un champ vide ou en cours de frappe ne doit pas ecraser l'heure en place.
    if (minutes === null) return;
    modifier(weekday, { [champ]: minutes });
  }

  function enregistrer() {
    setError(null);
    const invalide = semaine.find((j) => !j.closed && j.closesAt <= j.opensAt);
    if (invalide) {
      return setError(
        `${NOMS_JOURS[invalide.weekday]} : l'heure de fermeture doit suivre l'heure d'ouverture.`,
      );
    }

    startTransition(async () => {
      try {
        assurerSucces(await enregistrerHoraires({ horaires: semaine }));
        setEnregistre(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
      }
    });
  }

  const jours = JOURS_AFFICHES.map((d) => semaine.find((j) => j.weekday === d)!);
  const tousFermes = semaine.every((j) => j.closed);

  return (
    <div className="space-y-5">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {enregistre && !error && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Horaires enregistrés.
        </p>
      )}
      {tousFermes && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Tous les jours sont fermés : plus aucune commande en ligne ne pourra être passée.
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {jours.map((jour, index) => (
          <div
            key={jour.weekday}
            className={`grid items-center gap-3 px-4 py-3 sm:grid-cols-[10rem_auto_1fr] ${
              index > 0 ? "border-t border-slate-200" : ""
            }`}
          >
            <p className={`font-medium ${jour.closed ? "text-slate-400" : "text-slate-900"}`}>
              {NOMS_JOURS[jour.weekday]}
            </p>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={!jour.closed}
                onChange={(e) => modifier(jour.weekday, { closed: !e.target.checked })}
                className="h-4 w-4 accent-orange-500"
              />
              Ouvert
            </label>

            {jour.closed ? (
              <p className="text-sm text-slate-400">Fermé toute la journée</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-500">de</span>
                <input
                  type="time"
                  value={formatHeure(jour.opensAt)}
                  onChange={(e) => modifierHeure(jour.weekday, "opensAt", e.target.value)}
                  className="montant rounded-lg border border-slate-300 px-2.5 py-1.5"
                />
                <span className="text-slate-500">à</span>
                <input
                  type="time"
                  value={formatHeure(jour.closesAt)}
                  onChange={(e) => modifierHeure(jour.weekday, "closesAt", e.target.value)}
                  className="montant rounded-lg border border-slate-300 px-2.5 py-1.5"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={isPending}
        onClick={enregistrer}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-40"
      >
        {isPending ? "Enregistrement…" : "Enregistrer les horaires"}
      </button>
    </div>
  );
}

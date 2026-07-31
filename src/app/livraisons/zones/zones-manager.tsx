"use client";

import { useState, useTransition } from "react";
import {
  activerZone,
  creerQuartier,
  creerZone,
  deplacerQuartier,
  modifierZone,
  supprimerQuartier,
  supprimerZone,
} from "@/lib/actions/zones";
import { formatFCFA } from "@/lib/format";

type Quartier = { id: string; name: string; commandes: number };
type Zone = { id: string; name: string; fee: number; active: boolean; quartiers: Quartier[] };

export function ZonesManager({ zones }: { zones: Zone[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nouvelleZone, setNouvelleZone] = useState({ name: "", fee: "" });
  const [zoneEnEdition, setZoneEnEdition] = useState<string | null>(null);
  const [edition, setEdition] = useState({ name: "", fee: "" });
  const [nouveauQuartier, setNouveauQuartier] = useState<Record<string, string>>({});

  function lancer(action: () => Promise<unknown>, message: string) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        setError(e instanceof Error ? e.message : message);
      }
    });
  }

  function ajouterZone() {
    const fee = Number(nouvelleZone.fee);
    if (!nouvelleZone.name.trim()) return setError("Donnez un nom à la zone.");
    if (nouvelleZone.fee === "" || Number.isNaN(fee)) return setError("Indiquez le tarif de la zone.");
    lancer(async () => {
      await creerZone({ name: nouvelleZone.name.trim(), fee });
      setNouvelleZone({ name: "", fee: "" });
    }, "Erreur lors de la création de la zone");
  }

  function enregistrerZone(id: string) {
    const fee = Number(edition.fee);
    if (!edition.name.trim()) return setError("Le nom de la zone est requis.");
    if (edition.fee === "" || Number.isNaN(fee)) return setError("Tarif invalide.");
    lancer(async () => {
      await modifierZone(id, { name: edition.name.trim(), fee });
      setZoneEnEdition(null);
    }, "Erreur lors de la modification");
  }

  function ajouterQuartier(zoneId: string) {
    const nom = (nouveauQuartier[zoneId] ?? "").trim();
    if (!nom) return setError("Indiquez le nom du quartier.");
    lancer(async () => {
      await creerQuartier({ name: nom, zoneId });
      setNouveauQuartier((prev) => ({ ...prev, [zoneId]: "" }));
    }, "Erreur lors de l'ajout du quartier");
  }

  const totalQuartiers = zones.reduce((s, z) => s + z.quartiers.length, 0);

  return (
    <div className="space-y-5">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {zones.length === 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Aucune zone configurée. Tant qu&apos;aucun quartier n&apos;existe, vos clients ne peuvent
          pas commander en livraison.
        </p>
      )}

      {/* ---------- Nouvelle zone ---------- */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">Nouvelle zone</h2>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
          <input
            value={nouvelleZone.name}
            onChange={(e) => setNouvelleZone((z) => ({ ...z, name: e.target.value }))}
            placeholder="Nom de la zone (ex : Dakar centre)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={0}
            value={nouvelleZone.fee}
            onChange={(e) => setNouvelleZone((z) => ({ ...z, fee: e.target.value }))}
            placeholder="Tarif (F)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={isPending}
            onClick={ajouterZone}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-40"
          >
            Créer la zone
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-500">
        {zones.length} zone(s) · {totalQuartiers} quartier(s) configuré(s)
      </p>

      {/* ---------- Zones existantes ---------- */}
      {zones.map((zone) => (
        <div
          key={zone.id}
          className={`rounded-xl border bg-white p-4 ${
            zone.active ? "border-slate-200" : "border-slate-200 opacity-60"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            {zoneEnEdition === zone.id ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={edition.name}
                  onChange={(e) => setEdition((v) => ({ ...v, name: e.target.value }))}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  value={edition.fee}
                  onChange={(e) => setEdition((v) => ({ ...v, fee: e.target.value }))}
                  className="w-28 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => enregistrerZone(zone.id)}
                  className="rounded-md bg-black px-3 py-1.5 text-sm text-white disabled:opacity-40"
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => setZoneEnEdition(null)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-semibold">
                  {zone.name}
                  {!zone.active && (
                    <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                      Désactivée
                    </span>
                  )}
                </h3>
                <p className="text-sm text-slate-500">
                  Livraison : <span className="font-semibold text-slate-900">{formatFCFA(zone.fee)}</span>
                  {" · "}
                  {zone.quartiers.length} quartier(s)
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 text-xs">
              {zoneEnEdition !== zone.id && (
                <button
                  type="button"
                  onClick={() => {
                    setZoneEnEdition(zone.id);
                    setEdition({ name: zone.name, fee: String(zone.fee) });
                  }}
                  className="text-slate-600 hover:underline"
                >
                  Modifier
                </button>
              )}
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  lancer(() => activerZone(zone.id, !zone.active), "Erreur lors du changement d'état")
                }
                className="text-slate-600 hover:underline disabled:opacity-50"
              >
                {zone.active ? "Désactiver" : "Réactiver"}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  if (!window.confirm(`Supprimer la zone « ${zone.name} » ?`)) return;
                  lancer(() => supprimerZone(zone.id), "Erreur lors de la suppression");
                }}
                className="text-red-600 hover:underline disabled:opacity-50"
              >
                Supprimer
              </button>
            </div>
          </div>

          {/* Quartiers de la zone */}
          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="flex flex-wrap gap-2">
              {zone.quartiers.map((quartier) => (
                <span
                  key={quartier.id}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1.5 text-sm"
                >
                  {quartier.name}
                  {quartier.commandes > 0 && (
                    <span className="text-xs text-slate-400">{quartier.commandes} cmd</span>
                  )}
                  <select
                    value={zone.id}
                    disabled={isPending}
                    onChange={(e) =>
                      lancer(
                        () => deplacerQuartier(quartier.id, e.target.value),
                        "Erreur lors du déplacement",
                      )
                    }
                    aria-label={`Zone de ${quartier.name}`}
                    className="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs"
                  >
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      if (!window.confirm(`Supprimer le quartier « ${quartier.name} » ?`)) return;
                      lancer(() => supprimerQuartier(quartier.id), "Erreur lors de la suppression");
                    }}
                    aria-label={`Supprimer ${quartier.name}`}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-100 hover:text-red-600 disabled:opacity-50"
                  >
                    ×
                  </button>
                </span>
              ))}
              {zone.quartiers.length === 0 && (
                <p className="text-sm text-slate-400">Aucun quartier dans cette zone.</p>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={nouveauQuartier[zone.id] ?? ""}
                onChange={(e) =>
                  setNouveauQuartier((prev) => ({ ...prev, [zone.id]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") ajouterQuartier(zone.id);
                }}
                placeholder="Ajouter un quartier (ex : Sacré-Cœur)"
                className="min-w-56 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                disabled={isPending}
                onClick={() => ajouterQuartier(zone.id)}
                className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm transition hover:bg-slate-50 disabled:opacity-40"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

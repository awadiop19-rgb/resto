"use client";

import { useState, useTransition } from "react";
import { enregistrerDepenseCaisse, supprimerDepenseCaisse } from "@/lib/actions/caisse";
import { assurerSucces } from "@/lib/actions/resultat";
import {
  CATEGORIES_DEPENSE_CAISSE,
  estCategorieDeCaisse,
  type CategorieDepenseCaisse,
} from "@/lib/depenses-caisse";
import { formatFCFA, formatHeure } from "@/lib/format";

export type DepenseCaisse = {
  id: string;
  label: string;
  category: string;
  amount: number;
  date: Date;
};

/**
 * Dépenses courantes réglées en espèces depuis le tiroir pendant le service.
 *
 * Le montant disponible est rappelé en permanence : sortir plus que ce que
 * contient le tiroir n'aurait pas de sens physique, et le serveur le refuse.
 */
export function DepensesCaisse({
  depenses,
  disponible,
  caisseOuverte,
}: {
  depenses: DepenseCaisse[];
  disponible: number;
  caisseOuverte: boolean;
}) {
  const [categorie, setCategorie] = useState<CategorieDepenseCaisse>(CATEGORIES_DEPENSE_CAISSE[0]);
  const [commentaire, setCommentaire] = useState("");
  const [montant, setMontant] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const total = depenses.reduce((s, d) => s + d.amount, 0);
  const montantNombre = Number(montant);
  const saisieValide =
    montant !== "" && !Number.isNaN(montantNombre) && montantNombre > 0 && commentaire.trim() !== "";

  function enregistrer() {
    setErreur(null);
    if (!saisieValide) {
      setErreur("Indiquez un montant et à quoi correspond la dépense.");
      return;
    }
    if (montantNombre > disponible) {
      setErreur(`Le tiroir ne contient que ${formatFCFA(disponible)}.`);
      return;
    }
    demarrer(async () => {
      try {
        assurerSucces(
          await enregistrerDepenseCaisse({ categorie, commentaire, montant: montantNombre })
        );
        setCommentaire("");
        setMontant("");
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
      }
    });
  }

  function supprimer(id: string, libelle: string, somme: number) {
    if (!window.confirm(`Retirer la dépense « ${libelle} » de ${formatFCFA(somme)} ?`)) return;
    setErreur(null);
    demarrer(async () => {
      try {
        assurerSucces(await supprimerDepenseCaisse(id));
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Erreur lors de la suppression");
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">
          Dépenses de la caisse
          {depenses.length > 0 && (
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {depenses.length}
            </span>
          )}
        </h2>
        {total > 0 && (
          <span className="text-sm text-slate-500">
            Sorti du tiroir :{" "}
            <span className="font-semibold text-slate-900 tabular-nums">{formatFCFA(total)}</span>
          </span>
        )}
      </div>
      <p className="mb-3 text-xs text-slate-400">
        Petites dépenses réglées en espèces pendant le service. Elles sont déduites des espèces
        attendues à la clôture : elles ne créeront pas de manquant.
      </p>

      {erreur && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}

      {!caisseOuverte ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-[#8a5900]">
          Ouvrez votre caisse pour enregistrer une dépense : elle doit être rattachée à un tiroir.
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-12">
            <select
              value={categorie}
              // Le <select> rend une chaîne : le garde de type la ramène dans la
              // liste attendue plutôt que de forcer la conversion.
              onChange={(e) => estCategorieDeCaisse(e.target.value) && setCategorie(e.target.value)}
              aria-label="Type de dépense"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:col-span-3"
            >
              {CATEGORIES_DEPENSE_CAISSE.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="À quoi correspond la dépense"
              maxLength={200}
              aria-label="Commentaire"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:col-span-5"
            />
            <input
              type="number"
              min={1}
              max={disponible}
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder="Montant"
              aria-label="Montant"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:col-span-2"
            />
            <button
              type="button"
              disabled={enCours || !saisieValide}
              onClick={enregistrer}
              className="rounded-md bg-black px-4 py-1.5 text-sm text-white transition hover:bg-neutral-800 disabled:opacity-50 sm:col-span-2"
            >
              {enCours ? "…" : "Enregistrer"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Disponible dans le tiroir :{" "}
            <span className="font-semibold tabular-nums">{formatFCFA(disponible)}</span>
          </p>
        </>
      )}

      {depenses.length > 0 && (
        <div className="mt-4 overflow-x-auto border-t border-slate-100 pt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-400">
                <th className="pb-2 pr-2 font-medium">Heure</th>
                <th className="pb-2 pr-2 font-medium">Type</th>
                <th className="pb-2 pr-2 font-medium">Commentaire</th>
                <th className="pb-2 pr-2 text-right font-medium">Montant</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {depenses.map((d) => (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap py-2 pr-2 text-slate-500 tabular-nums">
                    {formatHeure(d.date)}
                  </td>
                  <td className="py-2 pr-2">{d.category}</td>
                  <td className="py-2 pr-2 text-slate-600">{d.label}</td>
                  <td className="py-2 pr-2 text-right font-semibold tabular-nums">
                    {formatFCFA(d.amount)}
                  </td>
                  <td className="py-2 text-right">
                    {/* Retrait possible tant que rien n'est versé : après clôture,
                        les espèces attendues ont été figées avec cette dépense. */}
                    {caisseOuverte && (
                      <button
                        type="button"
                        disabled={enCours}
                        onClick={() => supprimer(d.id, d.label, d.amount)}
                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
                      >
                        Retirer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

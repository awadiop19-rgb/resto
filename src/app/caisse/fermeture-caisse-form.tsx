"use client";

import { useState, useTransition } from "react";
import { closeCashRegister } from "@/lib/actions/caisse";
import { formatFCFA, formatSignedFCFA } from "@/lib/format";

/**
 * Formulaire de clôture d'une caisse. Partagé entre la caisse du jour et
 * l'écran de rattrapage d'une caisse laissée ouverte : mêmes règles de contrôle
 * dans les deux cas, seul l'habillage change.
 */
export function FermetureCaisseForm({
  openingFloat,
  totalCash,
  onClosed,
  intitule = "Fermer la caisse et faire le versement",
}: {
  openingFloat: number;
  totalCash: number;
  onClosed?: () => void;
  intitule?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [declaredAmount, setDeclaredAmount] = useState("");
  const [closeNote, setCloseNote] = useState("");

  // Le tiroir est versé en entier : les espèces attendues incluent le fond de caisse.
  const expectedCash = openingFloat + totalCash;
  const declaredNumber = Number(declaredAmount);
  const hasDeclared = declaredAmount !== "" && !Number.isNaN(declaredNumber);
  const difference = hasDeclared ? declaredNumber - expectedCash : 0;

  function handleClose() {
    setError(null);
    if (!hasDeclared) {
      setError("Indiquez le montant des espèces comptées dans le tiroir");
      return;
    }
    if (difference !== 0 && !closeNote.trim()) {
      setError(
        `Écart de ${formatSignedFCFA(difference)} par rapport aux ${formatFCFA(expectedCash)} attendus : indiquez le motif dans la note.`,
      );
      return;
    }
    const recap =
      difference === 0
        ? `Versement de ${formatFCFA(declaredNumber)}, caisse juste.`
        : `Versement de ${formatFCFA(declaredNumber)} pour ${formatFCFA(expectedCash)} attendus, soit un écart de ${formatSignedFCFA(difference)}.`;
    if (!window.confirm(`${recap}\n\nConfirmer la fermeture de la caisse ? Cette action est définitive.`)) {
      return;
    }
    startTransition(async () => {
      try {
        await closeCashRegister({ declaredAmount: declaredNumber, note: closeNote });
        setDeclaredAmount("");
        setCloseNote("");
        onClosed?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de la fermeture de la caisse");
      }
    });
  }

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold">{intitule}</h3>
      <p className="mb-3 text-xs text-slate-500">
        Comptez la totalité des espèces présentes dans le tiroir, fond de caisse compris.
      </p>

      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-4">
        <input
          type="number"
          min={0}
          placeholder="Espèces comptées dans le tiroir"
          value={declaredAmount}
          onChange={(e) => setDeclaredAmount(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:col-span-2"
        />
        <input
          placeholder="Note (obligatoire si écart)"
          value={closeNote}
          onChange={(e) => setCloseNote(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:col-span-1"
        />
        <button
          disabled={isPending}
          onClick={handleClose}
          className="rounded-md bg-red-600 px-4 py-1.5 text-sm text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          {isPending ? "Fermeture…" : "Fermer la caisse"}
        </button>
      </div>

      {hasDeclared && (
        <div
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            difference === 0
              ? "bg-emerald-50 text-emerald-700"
              : difference < 0
                ? "bg-red-50 text-red-700"
                : "bg-amber-50 text-amber-800"
          }`}
        >
          {difference === 0 ? (
            <>Caisse juste : le montant compté correspond aux {formatFCFA(expectedCash)} attendus.</>
          ) : (
            <>
              Écart de <strong>{formatSignedFCFA(difference)}</strong>{" "}
              {difference < 0 ? "(manquant)" : "(excédent)"} sur les {formatFCFA(expectedCash)} attendus.
              Expliquez-le dans la note.
            </>
          )}
        </div>
      )}
    </div>
  );
}

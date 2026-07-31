"use client";

import { formatFCFA } from "@/lib/format";
import type { CaisseEnRetard } from "@/lib/journee-caisse";
import { FermetureCaisseForm } from "./fermeture-caisse-form";

/**
 * Écran de rattrapage : tant qu'une caisse d'une journée antérieure reste
 * ouverte, le caissier ne peut rien faire d'autre que la clôturer.
 */
export function CaissesEnRetard({ caisses }: { caisses: CaisseEnRetard[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white"
          >
            !
          </span>
          <div>
            <h2 className="font-semibold text-red-800">
              Service bloqué : {caisses.length > 1 ? "des caisses non clôturées" : "caisse non clôturée"}
            </h2>
            <p className="mt-1 text-sm text-red-700">
              Vous n&apos;avez pas fermé votre caisse
              {caisses.length > 1 ? " sur les journées suivantes" : " du jour indiqué ci-dessous"}. Vous ne
              pouvez ni encaisser, ni prendre de commande, ni ouvrir une nouvelle caisse tant que ce n&apos;est
              pas régularisé.
            </p>
          </div>
        </div>
      </div>

      {caisses.map((caisse) => {
        const { joursEcoules } = caisse;
        return (
          <div key={caisse.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="font-semibold capitalize">{caisse.jourLabel}</h3>
                <p className="text-xs text-slate-500">
                  Ouverte le {new Date(caisse.openedAt).toLocaleString("fr-FR")} · restée ouverte depuis{" "}
                  {joursEcoules} jour{joursEcoules > 1 ? "s" : ""}
                </p>
              </div>
              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                À clôturer
              </span>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <div className="text-slate-500">Fond de caisse</div>
                <div className="font-semibold tabular-nums">{formatFCFA(caisse.openingFloat)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <div className="text-slate-500">Encaissé (Cash)</div>
                <div className="font-semibold tabular-nums">{formatFCFA(caisse.totalCash)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <div className="text-slate-500">Encaissé (Wave)</div>
                <div className="font-semibold tabular-nums">{formatFCFA(caisse.totalWave)}</div>
              </div>
              <div className="rounded-lg bg-orange-50 p-3 text-sm">
                <div className="text-orange-700">Espèces attendues</div>
                <div className="font-semibold tabular-nums text-orange-800">
                  {formatFCFA(caisse.especesAttendues)}
                </div>
                <div className="mt-0.5 text-xs text-orange-600">
                  {caisse.nombrePaiements} encaissement{caisse.nombrePaiements > 1 ? "s" : ""}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <FermetureCaisseForm
                openingFloat={caisse.openingFloat}
                totalCash={caisse.totalCash}
                intitule="Clôturer cette journée et verser les espèces"
              />
            </div>
          </div>
        );
      })}

      <p className="text-xs text-slate-500">
        Si le montant compté ne correspond pas à ce qui est attendu, indiquez le motif dans la note : l&apos;écart
        sera enregistré et visible par la comptabilité.
      </p>
    </div>
  );
}

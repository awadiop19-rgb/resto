"use client";

import { useState, useTransition } from "react";
import { declarerPaiementWave } from "@/lib/actions/paiement";
import { formatFCFA } from "@/lib/format";
import { WAVE_LIEN_PAIEMENT, WAVE_QR_IMAGE } from "@/lib/wave";

/**
 * Règlement d'une commande par Wave.
 *
 * Deux chemins selon l'appareil : sur téléphone on ouvre Wave directement — on
 * ne peut pas scanner son propre écran ; sur ordinateur on scanne le QR.
 */
export function PaiementWave({
  reference,
  montant,
  dejaDeclare,
}: {
  reference: string;
  montant: number;
  dejaDeclare?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [waveReference, setWaveReference] = useState("");
  const [declare, setDeclare] = useState(Boolean(dejaDeclare));
  const [error, setError] = useState<string | null>(null);

  function declarer() {
    setError(null);
    startTransition(async () => {
      try {
        await declarerPaiementWave({ reference, waveReference });
        setDeclare(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur, merci de réessayer.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-black">Payer avec Wave</h2>
        <span className="text-xs text-slate-400">Commande {reference}</span>
      </div>

      <div className="mt-4 rounded-xl bg-orange-50 px-4 py-3 text-center">
        <p className="text-xs uppercase tracking-wide text-orange-700">Montant à envoyer</p>
        <p className="text-3xl font-bold text-orange-900">{formatFCFA(montant)}</p>
        <p className="mt-1 text-xs text-orange-700">
          À saisir vous-même dans Wave : le code ne contient pas le montant.
        </p>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="mx-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={WAVE_QR_IMAGE}
            alt="Code QR de paiement Wave du restaurant Saveur Amir"
            width={180}
            height={180}
            className="rounded-lg border border-neutral-200 bg-white p-2"
          />
          <p className="mt-1 text-center text-xs text-slate-400">Scannez depuis Wave</p>
        </div>

        <div>
          <a
            href={WAVE_LIEN_PAIEMENT}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 w-full items-center justify-center rounded-lg bg-[#1DC1F3] px-5 text-base font-semibold text-white transition hover:brightness-95"
          >
            Ouvrir Wave et payer
          </a>
          <p className="mt-2 text-xs text-slate-500">
            Sur téléphone, utilisez ce bouton : le code QR sert quand vous commandez depuis un
            ordinateur.
          </p>

          <ol className="mt-4 space-y-1.5 text-sm text-slate-600">
            <li>1. Ouvrez Wave avec le bouton ou le code.</li>
            <li>
              2. Saisissez <span className="font-semibold text-black">{formatFCFA(montant)}</span> et
              validez.
            </li>
            <li>3. Revenez ici et confirmez ci-dessous.</li>
          </ol>
        </div>
      </div>

      <div className="mt-5 border-t border-neutral-100 pt-4">
        {declare ? (
          <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <p className="font-semibold">Paiement signalé, merci.</p>
            <p className="mt-1">
              Notre caisse vérifie la réception dans Wave, puis lance la préparation. Vous pouvez
              suivre l&apos;avancement avec votre numéro de commande.
            </p>
          </div>
        ) : (
          <>
            <label className="mb-1 block text-sm text-slate-600" htmlFor="ref-wave">
              N° de transaction Wave <span className="text-slate-400">(facultatif, accélère la vérification)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="ref-wave"
                type="text"
                value={waveReference}
                onChange={(e) => setWaveReference(e.target.value)}
                placeholder="Ex : TAKZ1234567"
                className="min-w-48 flex-1 rounded-lg border border-neutral-300 px-3 py-2.5 text-base focus:border-orange-500 focus:outline-none"
              />
              <button
                type="button"
                disabled={isPending}
                onClick={declarer}
                className="min-h-12 rounded-lg bg-black px-5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-40"
              >
                {isPending ? "Envoi…" : "J'ai payé"}
              </button>
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}

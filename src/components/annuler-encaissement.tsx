"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { annulerCommandeEncaissee } from "@/lib/actions/orders";
import { assurerSucces } from "@/lib/actions/resultat";
import { formatFCFA } from "@/lib/format";
import { POCHE_LABELS, type PocheRemboursement } from "@/lib/remboursement";

export type AnnulationEncaissement = {
  motif: string | null;
  auteur: string | null;
  date: Date;
  rembourse: boolean;
};

/** En deçà, un motif ne raconte rien — un mot jeté, un montant recopié. */
const LONGUEUR_MINIMALE_MOTIF = 10;

/**
 * Défaire un encaissement, depuis la journée comptable ou le détail d'un
 * versement.
 *
 * Deux choses sont demandées, et aucune n'a de valeur par défaut. Le motif,
 * parce qu'une recette qui ressort sans explication est indistinguable d'un vol.
 * Le sort de l'argent, parce que les deux cas arrivent : un encaissement en
 * double se rembourse, un plat déjà consommé se garde — et personne d'autre que
 * le comptable ne sait lequel des deux s'est produit.
 *
 * Le paiement, lui, n'est jamais effacé : ce qui a été encaissé ce jour-là l'a
 * été. C'est pourquoi la ligne reste affichée, barrée, avec sa raison.
 */
export function AnnulerEncaissement({
  orderId,
  libelle,
  montant,
  poche,
  annulation,
}: {
  orderId: string;
  libelle: string;
  montant: number;
  poche: PocheRemboursement;
  annulation: AnnulationEncaissement | null;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [rembourse, setRembourse] = useState<boolean | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  if (annulation) {
    return (
      <p className="text-xs text-[#d03b3b]">
        Annulée{annulation.rembourse ? " · remboursée" : " · argent gardé"}
        {annulation.motif && ` · ${annulation.motif}`}
        {annulation.auteur && ` · ${annulation.auteur}`}
      </p>
    );
  }

  function soumettre() {
    if (rembourse === null) return;
    setErreur(null);
    demarrer(async () => {
      try {
        assurerSucces(await annulerCommandeEncaissee({ orderId, motif, rembourse }));
        setOuvert(false);
        setMotif("");
        setRembourse(null);
        router.refresh();
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "L'annulation a échoué");
      }
    });
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="text-xs text-red-700 hover:underline"
      >
        Annuler
      </button>
    );
  }

  return (
    <div className="mt-1 space-y-2 rounded-md border border-red-200 bg-red-50/60 p-2 text-left">
      <p className="text-xs text-slate-600">
        Annuler l&apos;encaissement de <span className="font-semibold">{formatFCFA(montant)}</span> —{" "}
        {libelle}
      </p>

      <div className="space-y-1">
        <label className="flex items-start gap-2 text-xs text-slate-700">
          <input
            type="radio"
            name={`sort-${orderId}`}
            checked={rembourse === true}
            onChange={() => setRembourse(true)}
            className="mt-0.5"
          />
          <span>
            Le client a été remboursé
            {/* Dit d'où sort l'argent avant de valider : le comptable doit
                pouvoir aller le chercher là où il est réellement. */}
            <span className="block text-slate-500">
              Sortie de {POCHE_LABELS[poche]}, datée d&apos;aujourd&apos;hui. Les articles suivis en
              stock y reviennent.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-xs text-slate-700">
          <input
            type="radio"
            name={`sort-${orderId}`}
            checked={rembourse === false}
            onChange={() => setRembourse(false)}
            className="mt-0.5"
          />
          <span>
            La maison garde l&apos;argent
            <span className="block text-slate-500">
              La recette ne bouge pas : la commande sort du service, rien n&apos;est rendu.
            </span>
          </span>
        </label>
      </div>

      <textarea
        value={motif}
        onChange={(e) => setMotif(e.target.value)}
        placeholder="Motif (encaissement en double, commande soldée à la place d'une autre…)"
        maxLength={300}
        rows={2}
        autoFocus
        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
      />

      {erreur && <p className="text-xs text-red-700">{erreur}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={soumettre}
          disabled={enCours || rembourse === null || motif.trim().length < LONGUEUR_MINIMALE_MOTIF}
          className="rounded bg-red-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {enCours ? "Annulation…" : "Confirmer l'annulation"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOuvert(false);
            setErreur(null);
          }}
          disabled={enCours}
          className="rounded px-2 py-1 text-xs text-slate-600 hover:underline"
        >
          Renoncer
        </button>
      </div>
    </div>
  );
}

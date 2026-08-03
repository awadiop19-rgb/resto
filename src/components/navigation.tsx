"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icone } from "@/components/icone";
import { lienActif, tousLesLiens, type Navigation as CarteNav } from "@/lib/navigation";

/**
 * Navigation de l'espace professionnel.
 *
 * Deux formes pour deux usages. Sur ordinateur, un rail fixe a gauche : la
 * comptabilite passe la journee a naviguer entre les memes ecrans, et un menu
 * qui reste en place fait gagner un aller-retour a chaque fois. Sur telephone,
 * une barre d'onglets en bas : le caissier travaille debout, une main sur
 * l'appareil, et le haut de l'ecran est hors de portee du pouce.
 *
 * L'ancienne barre alignait quatorze liens de meme poids sur trois lignes, et
 * poussait le contenu d'autant plus bas que le role en avait.
 */
export function Navigation({
  navigation,
  utilisateur,
  deconnexion,
}: {
  navigation: CarteNav;
  utilisateur: { nom: string; role: string };
  /** Action serveur : la deconnexion doit s'executer cote serveur. */
  deconnexion: () => Promise<void>;
}) {
  const chemin = usePathname();
  const [plusOuvert, setPlusOuvert] = useState(false);

  const liens = tousLesLiens(navigation);
  const actif = lienActif(liens, chemin);
  const actifOnglet = lienActif(navigation.onglets, chemin);
  // « Plus » n'a de raison d'etre que si des destinations manquent aux onglets.
  const reste = liens.filter((l) => !navigation.onglets.some((o) => o.href === l.href));

  return (
    <>
      {/* -------------------------------------------------- Rail (ordinateur) */}
      <nav className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col gap-6 overflow-y-auto bg-encre-profonde px-3 py-4 text-slate-300 lg:flex">
        <Link href="/" className="flex items-center gap-2.5 px-2 text-base font-semibold text-white">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-orange-500" aria-hidden />
          Saveur Amir
        </Link>

        <div className="flex flex-1 flex-col gap-5">
          {navigation.groupes.map((groupe) => (
            <div key={groupe.titre} className="flex flex-col gap-0.5">
              <p className="px-2 pb-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {groupe.titre}
              </p>
              {groupe.liens.map((lien) => (
                <Link
                  key={lien.href}
                  href={lien.href}
                  aria-current={actif === lien.href ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition ${
                    actif === lien.href
                      ? "bg-orange-500/15 font-semibold text-orange-300"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icone nom={lien.icone} className="h-[18px] w-[18px] shrink-0" />
                  {lien.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 pt-3">
          <p className="px-2 text-sm font-medium text-white">{utilisateur.nom}</p>
          <p className="px-2 text-xs text-slate-500">{utilisateur.role}</p>
          <form action={deconnexion}>
            <button className="mt-2 w-full rounded-lg px-2 py-2 text-left text-sm text-slate-400 transition hover:bg-white/5 hover:text-white">
              Déconnexion
            </button>
          </form>
        </div>
      </nav>

      {/* ------------------------------------------------ Barre haute (mobile) */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-encre-profonde px-4 py-3 text-white lg:hidden">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-orange-500" aria-hidden />
          Saveur Amir
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{utilisateur.nom}</span>
          <form action={deconnexion}>
            <button className="rounded-lg border border-white/15 px-3 py-1.5 text-xs transition hover:bg-white/10">
              Quitter
            </button>
          </form>
        </div>
      </header>

      {/* -------------------------------------------- Panneau « Plus » (mobile) */}
      {plusOuvert && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setPlusOuvert(false)}
            className="absolute inset-0 bg-slate-900/40"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Toutes les pages
            </p>
            <div className="flex flex-col">
              {reste.map((lien) => (
                <Link
                  key={lien.href}
                  href={lien.href}
                  onClick={() => setPlusOuvert(false)}
                  className={`flex items-center gap-3 rounded-lg px-2 py-3 text-sm ${
                    actif === lien.href ? "font-semibold text-orange-600" : "text-slate-700"
                  }`}
                >
                  <Icone nom={lien.icone} className="h-5 w-5 text-slate-400" />
                  {lien.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------- Onglets bas (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-flow-col justify-stretch border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {navigation.onglets.map((lien) => (
          <Link
            key={lien.href}
            href={lien.href}
            aria-current={actifOnglet === lien.href ? "page" : undefined}
            className={`flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 text-[0.68rem] ${
              actifOnglet === lien.href ? "font-semibold text-orange-600" : "text-slate-500"
            }`}
          >
            <Icone nom={lien.icone} className="h-[22px] w-[22px]" />
            {lien.label}
          </Link>
        ))}
        {reste.length > 0 && (
          <button
            type="button"
            onClick={() => setPlusOuvert((o) => !o)}
            aria-expanded={plusOuvert}
            className={`flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 text-[0.68rem] ${
              plusOuvert ? "font-semibold text-orange-600" : "text-slate-500"
            }`}
          >
            <span className="flex h-[22px] w-[22px] items-center justify-center text-lg leading-none">
              ⋯
            </span>
            Plus
          </button>
        )}
      </nav>
    </>
  );
}

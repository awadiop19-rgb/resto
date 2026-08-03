"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatHeurePrecise } from "@/lib/format";

/**
 * Rafraîchit périodiquement les Server Components de la page en cours.
 *
 * `router.refresh()` refait la requête serveur et fusionne le nouveau rendu sans
 * perdre l'état React local (panier en cours de saisie, champs de formulaire).
 * Le rafraîchissement est suspendu quand l'onglet est masqué, et rejoué dès que
 * l'utilisateur y revient, pour ne pas interroger le serveur dans le vide.
 */
export function AutoRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    function refresh() {
      startTransition(() => {
        router.refresh();
        setLastRefresh(new Date());
      });
    }

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, intervalMs);

    function onVisibilityChange() {
      if (document.visibilityState === "visible") refresh();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router, intervalMs]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400" aria-live="polite">
      <span
        className={`h-2 w-2 rounded-full ${isPending ? "animate-pulse bg-orange-500" : "bg-emerald-500"}`}
        aria-hidden
      />
      {isPending
        ? "Mise à jour…"
        : lastRefresh
          ? `À jour · ${formatHeurePrecise(lastRefresh)}`
          : "Mise à jour automatique"}
    </span>
  );
}

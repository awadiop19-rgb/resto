import {
  estOuvert,
  fermetureDuJour,
  formatJour,
  jourISO,
  resumerSemaine,
  type Reglages,
} from "@/lib/horaires";

/**
 * Les horaires tels que le client les voit sur le site.
 *
 * Presentationnel : les reglages sont lus par la page ou le pied de page, pas
 * ici. Le meme tableau sert au pied de page et a l'accueil — deux listes tenues
 * separement finiraient par se contredire, et c'est precisement ce qui arrivait
 * avec la ligne « Ouvert tous les jours · 11h00 – 23h00 » qui vivait en dur.
 */
export function HorairesSemaine({
  reglages,
  ton = "clair",
}: {
  reglages: Reglages;
  /** `sombre` pour le pied de page, pose sur l'encre. */
  ton?: "clair" | "sombre";
}) {
  const aujourdhui = new Date().getDay();
  const lignes = resumerSemaine(reglages.horaires);

  const attenue = ton === "sombre" ? "text-slate-400" : "text-slate-500";
  const accentue = ton === "sombre" ? "text-white" : "text-slate-900";

  return (
    <ul className="space-y-1">
      {lignes.map((ligne) => {
        // Le jour en cours est mis en avant : c'est celui qu'on vient verifier.
        const enCours = ligne.jours.includes(aujourdhui);
        return (
          <li
            key={ligne.libelle}
            className={`flex justify-between gap-4 text-sm ${enCours ? `font-medium ${accentue}` : attenue}`}
          >
            <span>{ligne.libelle}</span>
            <span className="montant">{ligne.heures}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Pastille « ouvert / fermé » a l'instant present, et fermeture exceptionnelle
 * annoncee avant qu'elle ne surprenne un client devant la porte.
 */
export function EtatOuverture({
  reglages,
  ton = "clair",
}: {
  reglages: Reglages;
  ton?: "clair" | "sombre";
}) {
  const maintenant = new Date();
  const ouvert = estOuvert(reglages, maintenant);
  const exceptionnelle = fermetureDuJour(reglages.fermetures, maintenant);
  const aVenir = reglages.fermetures.filter((f) => f.startDate > jourISO(maintenant)).slice(0, 2);

  return (
    <div className="space-y-2">
      <p
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
          ouvert
            ? "bg-emerald-100 text-emerald-800"
            : ton === "sombre"
              ? "bg-white/10 text-slate-300"
              : "bg-slate-100 text-slate-600"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${ouvert ? "bg-emerald-600" : "bg-slate-400"}`}
          aria-hidden
        />
        {ouvert ? "Ouvert maintenant" : "Fermé maintenant"}
      </p>

      {exceptionnelle && (
        <p className={`text-sm ${ton === "sombre" ? "text-orange-300" : "text-orange-700"}`}>
          Fermeture exceptionnelle aujourd&apos;hui
          {exceptionnelle.reason ? ` — ${exceptionnelle.reason}` : ""}.
        </p>
      )}

      {aVenir.map((f) => (
        <p key={f.id} className={`text-sm ${ton === "sombre" ? "text-slate-400" : "text-slate-500"}`}>
          Fermé{" "}
          {f.startDate === f.endDate
            ? `le ${formatJour(f.startDate)}`
            : `du ${formatJour(f.startDate)} au ${formatJour(f.endDate)}`}
          {f.reason ? ` — ${f.reason}` : ""}.
        </p>
      ))}
    </div>
  );
}

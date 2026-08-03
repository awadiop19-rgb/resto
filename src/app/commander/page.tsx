import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PublicOrderForm } from "./public-order-form";
import { getQuartiersLivrables } from "@/lib/zones-livraison";
import {
  JOURS_AFFICHES,
  NOMS_JOURS,
  formatHeure,
  formatJour,
  jourISO,
  messageFermeture,
  type Reglages,
} from "@/lib/horaires";
import { getReglages } from "@/lib/horaires-data";

export const dynamic = "force-dynamic";

/**
 * Ce que voit le client hors des heures d'ouverture.
 *
 * Le message dit quand nous rouvrons, et la semaine complete est affichee en
 * dessous : « c'est ferme » sans horaire oblige a revenir au hasard pour
 * decouvrir l'heure. Le telephone reste offert — un client presse ne doit pas
 * repartir sans recours.
 */
function CommandeFermee({ message, reglages }: { message: string; reglages: Reglages }) {
  const { horaires, fermetures } = reglages;
  const maintenant = new Date();
  const aujourdhui = maintenant.getDay();
  // Celles qui restent a venir : annoncer une fermeture deja commencee sous le
  // message qui l'explique ferait doublon.
  const aVenir = fermetures.filter((f) => f.startDate > jourISO(maintenant));

  return (
    <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
      <p className="text-lg font-semibold text-amber-900">{message}</p>
      <p className="mt-1 text-sm text-amber-800">
        Vous pouvez tout de même nous appeler au{" "}
        <a href="tel:+221711508122" className="font-semibold underline underline-offset-4">
          +221 71 150 81 22
        </a>
        .
      </p>

      <div className="mt-5 border-t border-amber-200 pt-4">
        <p className="text-[0.65rem] font-medium uppercase tracking-[0.1em] text-amber-700">
          Nos horaires de commande
        </p>
        <ul className="mt-2 space-y-1">
          {JOURS_AFFICHES.map((jour) => {
            const h = horaires.find((x) => x.weekday === jour)!;
            return (
              <li
                key={jour}
                className={`flex justify-between gap-4 text-sm ${
                  jour === aujourdhui ? "font-semibold text-amber-900" : "text-amber-800"
                }`}
              >
                <span>{NOMS_JOURS[jour]}</span>
                <span className="montant">
                  {h.closed ? "Fermé" : `${formatHeure(h.opensAt)} – ${formatHeure(h.closesAt)}`}
                </span>
              </li>
            );
          })}
        </ul>

        {aVenir.length > 0 && (
          <div className="mt-4 border-t border-amber-200 pt-3">
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.1em] text-amber-700">
              Fermetures à venir
            </p>
            <ul className="mt-2 space-y-1">
              {aVenir.map((f) => (
                <li key={f.id} className="text-sm text-amber-800">
                  {f.startDate === f.endDate
                    ? `Le ${formatJour(f.startDate)}`
                    : `Du ${formatJour(f.startDate)} au ${formatJour(f.endDate)}`}
                  {f.reason ? ` — ${f.reason}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default async function CommanderPage() {
  const [categories, quartiers, reglages] = await Promise.all([
    prisma.menuCategory.findMany({
      include: { items: { where: { available: true }, orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    getQuartiersLivrables(),
    getReglages(),
  ]);

  // Calculée côté serveur : l'horloge du visiteur est réglable, et un téléphone
  // mal réglé ouvrirait le formulaire à une heure où personne n'est en cuisine.
  const fermeture = messageFermeture(reglages);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
              Commander en ligne
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              Composez votre commande, <span className="text-orange-600">Saveur Amir</span>{" "}
              s&apos;occupe du reste
            </h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              Choisissez vos plats, indiquez votre nom et votre numéro de téléphone : notre équipe
              vous recontacte pour confirmer votre commande et l&apos;heure de retrait.
            </p>
          </div>

          {fermeture ? <CommandeFermee message={fermeture} reglages={reglages} /> : null}

          {/* Le formulaire disparaît quand c'est fermé : le laisser grisé sous un
              message inviterait à le remplir pour rien. La carte, elle, reste
              consultable plus bas — on ne cache pas un menu parce qu'il est tard. */}
          {!fermeture && <PublicOrderForm categories={categories} quartiers={quartiers} />}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

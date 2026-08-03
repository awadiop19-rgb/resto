import Link from "next/link";
import { getReglages } from "@/lib/horaires-data";
import { EtatOuverture, HorairesSemaine } from "@/components/horaires-publics";

/**
 * Les horaires sont lus en base, plus ecrits en dur.
 *
 * Ce pied de page annoncait « Ouvert tous les jours · 11h00 – 23h00 » alors que
 * la maison ferme le dimanche et ouvre a 8h : un client s'y fiait pour rien. Une
 * ligne figee finit toujours par mentir le jour ou l'horaire change.
 */
export async function SiteFooter() {
  const reglages = await getReglages();

  return (
    <footer id="contact" className="border-t border-encre/10 bg-encre text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-lg font-semibold text-white">
            <span className="text-orange-500">Saveur</span> Amir
          </p>
          <p className="mt-2 text-sm">
            Restaurant sénégalais au cœur de Dakar. Saveurs locales et classiques européens,
            à savourer sur place ou à emporter.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-500">Adresse</p>
          <p className="mt-2 text-sm">Rufisque, Sénégal</p>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-500">Horaires</p>
          <div className="mt-2">
            <HorairesSemaine reglages={reglages} ton="sombre" />
          </div>
          <div className="mt-3">
            <EtatOuverture reglages={reglages} ton="sombre" />
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-500">Contact</p>
          <p className="mt-2 text-sm">+221 71 150 81 22</p>
          <p className="mt-1 text-sm">contact@saveuramir.sn</p>
          <Link
            href="/suivi"
            className="mt-3 inline-block text-sm text-orange-400 underline-offset-4 transition hover:text-orange-300 hover:underline"
          >
            Suivre ma commande
          </Link>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Saveur Amir — Tous droits réservés.
      </div>
    </footer>
  );
}

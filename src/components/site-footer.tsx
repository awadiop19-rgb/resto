import Link from "next/link";

export function SiteFooter() {
  return (
    <footer id="contact" className="border-t border-black/10 bg-black text-neutral-300">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
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
          <p className="mt-1 text-sm">Ouvert tous les jours · 11h00 – 23h00</p>
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
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-neutral-500">
        © {new Date().getFullYear()} Saveur Amir — Tous droits réservés.
      </div>
    </footer>
  );
}

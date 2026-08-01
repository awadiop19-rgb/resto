import Link from "next/link";

const links = [
  { href: "/", label: "Accueil" },
  { href: "/#menu", label: "Notre carte" },
  { href: "/suivi", label: "Suivre ma commande" },
  { href: "/#a-propos", label: "À propos" },
  { href: "/#contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-black/10 bg-black text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          <span className="text-orange-500">Saveur</span> Amir
        </Link>
        <nav className="flex flex-wrap items-center gap-5 text-sm text-neutral-200">
          {links.map((link) =>
            // Les ancres de la page d'accueil restent des <a> : Link ne sait pas
            // faire défiler vers un fragment de la page déjà affichée.
            link.href.includes("#") ? (
              <a key={link.href} href={link.href} className="transition hover:text-orange-400">
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className="transition hover:text-orange-400">
                {link.label}
              </Link>
            )
          )}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/commander"
            className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400"
          >
            Commander en ligne
          </Link>
          <Link
            href="/login"
            className="hidden text-sm text-neutral-300 transition hover:text-white sm:inline"
          >
            Espace pro
          </Link>
        </div>
      </div>
    </header>
  );
}

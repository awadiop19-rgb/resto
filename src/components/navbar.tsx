import Link from "next/link";
import { auth, signOut } from "@/auth";

const roleLinks: Record<string, { href: string; label: string }[]> = {
  ADMIN: [
    { href: "/dashboard", label: "Tableau de bord" },
    { href: "/commandes", label: "Commandes" },
    { href: "/livraisons", label: "Livraisons" },
    { href: "/menu", label: "Menu" },
    { href: "/caisse", label: "Caisse" },
    { href: "/caisse/versements", label: "Versements" },
    { href: "/depenses", label: "Dépenses" },
    { href: "/comptabilite", label: "Comptabilité" },
    { href: "/utilisateurs", label: "Utilisateurs" },
    { href: "/profil", label: "Mon profil" },
  ],
  SERVEUR: [
    { href: "/commandes", label: "Commandes" },
    { href: "/menu", label: "Menu" },
    { href: "/profil", label: "Mon profil" },
  ],
  CUISINE: [
    { href: "/commandes", label: "Commandes" },
    { href: "/profil", label: "Mon profil" },
  ],
  CAISSIER: [
    { href: "/caisse", label: "Caisse" },
    { href: "/commandes", label: "Commandes" },
    { href: "/livraisons", label: "Livraisons" },
    { href: "/profil", label: "Mon profil" },
  ],
  LIVREUR: [
    { href: "/mes-livraisons", label: "Mes livraisons" },
    { href: "/profil", label: "Mon profil" },
  ],
  COMPTABILITE: [
    { href: "/comptabilite", label: "Tableau de bord" },
    { href: "/depenses", label: "Dépenses" },
    { href: "/caisse/versements", label: "Versements" },
    { href: "/profil", label: "Mon profil" },
  ],
};

export async function Navbar() {
  const session = await auth();
  if (!session?.user) return null;

  const links = roleLinks[session.user.role] ?? [];

  return (
    <nav className="bg-black text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-6">
          <Link href="/" className="text-lg font-semibold">
            <span className="text-orange-500">Saveur</span> Amir
          </Link>
          <div className="flex flex-wrap gap-4 text-sm">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-orange-400">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-300">
            {session.user.name} <span className="text-slate-500">({session.user.role})</span>
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="rounded bg-neutral-800 px-3 py-1 transition hover:bg-neutral-700">
              Déconnexion
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}

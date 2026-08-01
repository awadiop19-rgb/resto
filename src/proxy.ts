import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import type { Role } from "@/generated/prisma/client";

const { auth } = NextAuth(authConfig);

const protectedRoutes = [
  "/dashboard",
  "/commandes",
  "/menu",
  "/depenses",
  "/produits",
  "/stock",
  "/utilisateurs",
  "/caisse",
  "/comptabilite",
  "/livraisons",
  "/mes-livraisons",
  "/profil",
];

// Ordre important : les préfixes les plus spécifiques doivent être vérifiés en premier.
const routeRoles: { prefix: string; roles: Role[] }[] = [
  { prefix: "/caisse/versements", roles: ["ADMIN", "COMPTABILITE"] },
  { prefix: "/dashboard", roles: ["ADMIN"] },
  { prefix: "/utilisateurs", roles: ["ADMIN"] },
  { prefix: "/depenses", roles: ["ADMIN", "COMPTABILITE"] },
  { prefix: "/comptabilite", roles: ["ADMIN", "COMPTABILITE"] },
  // Le stock est tenu par ceux qui achètent et distribuent : la cuisine consomme,
  // elle ne saisit pas.
  { prefix: "/produits", roles: ["ADMIN", "COMPTABILITE"] },
  { prefix: "/stock", roles: ["ADMIN", "COMPTABILITE"] },
  { prefix: "/caisse", roles: ["ADMIN", "CAISSIER"] },
  // La configuration des tarifs reste à l'administration, pas au comptoir.
  { prefix: "/livraisons/zones", roles: ["ADMIN"] },
  { prefix: "/livraisons", roles: ["ADMIN", "CAISSIER"] },
  { prefix: "/mes-livraisons", roles: ["ADMIN", "LIVREUR"] },
  // Le livreur n'a rien à faire dans la salle : il n'a que ses tournées.
  { prefix: "/commandes", roles: ["ADMIN", "SERVEUR", "CUISINE", "CAISSIER"] },
  { prefix: "/menu", roles: ["ADMIN", "SERVEUR", "CUISINE", "CAISSIER"] },
];

/**
 * Page d'accueil de chaque rôle. Sert aussi de destination de repli quand un
 * utilisateur atteint une page interdite : renvoyer tout le monde vers
 * /commandes boucherait indéfiniment pour un livreur, qui n'y a pas accès.
 */
function accueilPour(role: Role | undefined) {
  switch (role) {
    case "CAISSIER":
      return "/caisse";
    case "COMPTABILITE":
      return "/comptabilite";
    case "LIVREUR":
      return "/mes-livraisons";
    default:
      return "/commandes";
  }
}

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;

  const isProtected = protectedRoutes.some((route) => nextUrl.pathname.startsWith(route));
  const restriction = routeRoles.find((r) => nextUrl.pathname.startsWith(r.prefix));

  if (!isLoggedIn && isProtected) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && restriction && !restriction.roles.includes(role as Role)) {
    return NextResponse.redirect(new URL(accueilPour(role), nextUrl));
  }

  if (isLoggedIn && nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL(accueilPour(role), nextUrl));
  }
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/commandes/:path*",
    "/menu/:path*",
    "/depenses/:path*",
    "/produits/:path*",
    "/stock/:path*",
    "/utilisateurs/:path*",
    "/caisse/:path*",
    "/comptabilite/:path*",
    "/livraisons/:path*",
    "/mes-livraisons/:path*",
    "/profil/:path*",
    "/login",
  ],
};


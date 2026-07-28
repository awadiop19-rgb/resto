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
  "/utilisateurs",
  "/caisse",
  "/comptabilite",
  "/profil",
];

// Ordre important : les préfixes les plus spécifiques doivent être vérifiés en premier.
const routeRoles: { prefix: string; roles: Role[] }[] = [
  { prefix: "/caisse/versements", roles: ["ADMIN", "COMPTABILITE"] },
  { prefix: "/dashboard", roles: ["ADMIN"] },
  { prefix: "/utilisateurs", roles: ["ADMIN"] },
  { prefix: "/depenses", roles: ["ADMIN", "COMPTABILITE"] },
  { prefix: "/comptabilite", roles: ["ADMIN", "COMPTABILITE"] },
  { prefix: "/caisse", roles: ["ADMIN", "CAISSIER"] },
];

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
    return NextResponse.redirect(new URL("/commandes", nextUrl));
  }

  if (isLoggedIn && nextUrl.pathname === "/login") {
    const home = role === "CAISSIER" ? "/caisse" : role === "COMPTABILITE" ? "/comptabilite" : "/commandes";
    return NextResponse.redirect(new URL(home, nextUrl));
  }
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/commandes/:path*",
    "/menu/:path*",
    "/depenses/:path*",
    "/utilisateurs/:path*",
    "/caisse/:path*",
    "/comptabilite/:path*",
    "/profil/:path*",
    "/login",
  ],
};


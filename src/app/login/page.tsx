"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";

const ATOUTS = [
  "Prise de commande en salle et en ligne",
  "Caisse, versements et contrôle des écarts",
  "Comptabilité et suivi du chiffre d'affaires",
];

function OeilIcone({ ouvert }: { ouvert: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.75" />
      {!ouvert && <path d="M4 20 20 4" />}
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/commandes";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [afficherMotDePasse, setAfficherMotDePasse] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      // Message volontairement identique dans les deux cas : préciser lequel est
      // faux permettrait de deviner quels comptes existent.
      setError("Email ou mot de passe incorrect.");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* ---------------- Panneau visuel ---------------- */}
      <div className="relative hidden overflow-hidden bg-black lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/dishes/thieboudienne.webp"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black via-black/70 to-black/25" />
        <div
          aria-hidden
          className="absolute -right-28 -top-28 h-96 w-96 rounded-full bg-orange-500/25 blur-3xl"
        />

        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-orange-500/40 bg-orange-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-orange-400">
            Espace professionnel
          </span>

          <div>
            <p className="text-3xl font-bold">
              <span className="bg-linear-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                Saveur
              </span>{" "}
              Amir
            </p>
            <p className="mt-3 max-w-md text-lg leading-relaxed text-neutral-300">
              L&apos;outil de gestion du restaurant : la salle, la caisse et les comptes au même
              endroit.
            </p>

            <ul className="mt-8 space-y-3">
              {ATOUTS.map((atout) => (
                <li key={atout} className="flex items-start gap-3 text-sm text-neutral-300">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-0.5 h-4 w-4 shrink-0 text-orange-500"
                    aria-hidden
                  >
                    <path d="m5 13 4 4L19 7" />
                  </svg>
                  {atout}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-neutral-500">Restaurant sénégalais · Dakar</p>
        </div>
      </div>

      {/* ---------------- Formulaire ---------------- */}
      <div className="flex items-center justify-center bg-slate-50 px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          {/* Sur mobile le panneau visuel disparaît : la marque revient ici. */}
          <div className="mb-8 lg:hidden">
            <p className="text-2xl font-bold">
              <span className="text-orange-600">Saveur</span> Amir
            </p>
            <p className="mt-1 text-sm text-slate-500">Espace professionnel</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">Connexion</h1>
            <p className="mt-1 text-sm text-slate-500">
              Identifiez-vous pour accéder à votre espace de travail.
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                >
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white"
                  >
                    !
                  </span>
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Adresse email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none"
                  placeholder="vous@saveuramir.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={afficherMotDePasse ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-2.5 pl-3.5 pr-12 text-base transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setAfficherMotDePasse((v) => !v)}
                    aria-label={afficherMotDePasse ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-slate-700"
                  >
                    <OeilIcone ouvert={afficherMotDePasse} />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-black text-base font-medium text-white transition hover:bg-neutral-800 disabled:opacity-40"
              >
                {loading && (
                  <span
                    aria-hidden
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  />
                )}
                {loading ? "Connexion…" : "Se connecter"}
              </button>
            </form>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
            <Link href="/" className="text-slate-500 transition hover:text-orange-600">
              ← Retour au site
            </Link>
            <span className="text-xs text-slate-400">
              Mot de passe oublié ? Contactez un administrateur.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

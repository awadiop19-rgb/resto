import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

function formatFCFA(value: number) {
  return `${value.toLocaleString("fr-FR")} F`;
}

export const dynamic = "force-dynamic";

const features = [
  {
    title: "Ingrédients frais",
    description: "Des produits locaux et de saison, sélectionnés chaque matin au marché.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3c-3 3-6 6-6 10.5A6 6 0 0 0 12 21a6 6 0 0 0 6-6.5C18 10 15 6 12 3Z"
      />
    ),
  },
  {
    title: "Recettes authentiques",
    description: "Thiéboudienne, yassa, mafé... transmis de génération en génération.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 21h16M6 21V9a6 6 0 0 1 12 0v12M4 9h16"
      />
    ),
  },
  {
    title: "Service rapide",
    description: "Commande en ligne, préparation soignée, prête en un temps record.",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
      </>
    ),
  },
  {
    title: "Ambiance chaleureuse",
    description: "Un cadre convivial à Dakar, pensé pour se sentir chez soi.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21s-7-4.35-9.5-8.5C.8 8.5 2.5 5 6 5c2 0 3.5 1.2 6 3.8C14.5 6.2 16 5 18 5c3.5 0 5.2 3.5 3.5 7.5C19 16.65 12 21 12 21Z"
      />
    ),
  },
];

export default async function Home() {
  const categories = await prisma.menuCategory.findMany({
    include: { items: { where: { available: true }, orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });
  const categoriesWithItems = categories.filter((category) => category.items.length > 0);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-black text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/dishes/thieboudienne.webp"
            alt="Thiéboudienne, plat signature de Saveur Amir"
            className="absolute inset-0 h-full w-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/35 to-black/10" />
          <div
            aria-hidden
            className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-orange-500/20 blur-3xl"
          />

          <div className="relative mx-auto max-w-6xl px-4 py-28 sm:py-36">
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/40 bg-orange-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-orange-400">
              Restaurant sénégalais · Dakar
            </span>
            <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-tight sm:text-6xl">
              <span className="bg-linear-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                Saveur
              </span>{" "}
              Amir
            </h1>
            <p className="mt-4 max-w-xl text-lg text-neutral-300">
              Une cuisine généreuse entre traditions sénégalaises et classiques européens,
              préparée avec des produits frais, au cœur de Dakar.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/commander"
                className="rounded-md bg-orange-500 px-6 py-3 text-sm font-semibold text-black shadow-lg shadow-orange-500/20 transition hover:bg-orange-400"
              >
                Commander en ligne
              </Link>
              <a
                href="#menu"
                className="rounded-md border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:border-orange-400 hover:text-orange-400"
              >
                Découvrir la carte
              </a>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-b border-neutral-100 bg-white py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="group rounded-2xl border border-neutral-200 p-6 transition hover:-translate-y-1 hover:border-orange-300 hover:shadow-lg"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-orange-500 transition group-hover:bg-orange-500 group-hover:text-black">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      className="h-6 w-6"
                    >
                      {feature.icon}
                    </svg>
                  </div>
                  <h3 className="mt-4 font-semibold text-black">{feature.title}</h3>
                  <p className="mt-2 text-sm text-slate-500">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* About */}
        <section id="a-propos" className="mx-auto max-w-6xl px-4 py-20">
          <div className="grid items-center gap-12 sm:grid-cols-2">
            <div className="relative overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/dishes/yassa-poulet.webp"
                alt="Yassa poulet, spécialité de Saveur Amir"
                className="h-80 w-full object-cover sm:h-104"
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-black/10" />
              <div className="absolute bottom-4 left-4 rounded-xl bg-black/80 px-4 py-3 text-white backdrop-blur">
                <p className="text-sm font-semibold text-orange-400">Depuis 2014</p>
                <p className="text-xs text-neutral-300">Fait main, chaque jour</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
                Notre histoire
              </p>
              <h2 className="mt-2 text-3xl font-bold text-black sm:text-4xl">
                L&apos;authenticité sénégalaise, sans frontières
              </h2>
              <p className="mt-4 text-slate-600">
                Installé à Dakar, Saveur Amir vous accueille dans une ambiance chaleureuse pour
                partager les grands classiques de la cuisine sénégalaise — thiéboudienne, yassa,
                mafé — aux côtés de plats européens revisités. Chaque assiette est préparée sur
                place, à partir de produits locaux et de saison.
              </p>
              <blockquote className="mt-6 rounded-xl border-l-4 border-orange-500 bg-neutral-50 p-4 text-sm italic text-slate-600">
                « Chaque plat raconte une histoire — celle de nos racines et de notre passion
                pour bien recevoir. »
              </blockquote>
              <div className="mt-6">
                <Link
                  href="/commander"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-orange-600 transition hover:text-orange-500"
                >
                  Voir toute la carte
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Menu highlights */}
        <section id="menu" className="bg-neutral-50 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-12 text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
                Notre carte
              </p>
              <h2 className="mt-2 text-3xl font-bold text-black sm:text-4xl">
                Quelques-uns de nos plats
              </h2>
              <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-orange-500" />
            </div>

            <div className="space-y-14">
              {categoriesWithItems.map((category) => (
                <div key={category.id}>
                  <h3 className="mb-5 flex items-center gap-3 text-xl font-semibold text-black">
                    {category.name}
                    <span className="h-px flex-1 bg-neutral-200" />
                  </h3>
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {category.items.map((item, index) => (
                      <div
                        key={item.id}
                        className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                      >
                        <div className="relative h-44 w-full overflow-hidden bg-linear-to-br from-black to-neutral-800">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-4xl opacity-50">
                              🍽️
                            </div>
                          )}
                          {index === 0 && (
                            <span className="absolute left-3 top-3 rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-black shadow">
                              Populaire
                            </span>
                          )}
                        </div>
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold text-black">{item.name}</h4>
                            <span className="whitespace-nowrap rounded-full bg-orange-50 px-2.5 py-1 text-sm font-semibold text-orange-600">
                              {formatFCFA(item.price)}
                            </span>
                          </div>
                          {item.description && (
                            <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-14 text-center">
              <Link
                href="/commander"
                className="inline-flex items-center gap-2 rounded-md bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Passer commande maintenant
              </Link>
            </div>
          </div>
        </section>

        {/* CTA banner */}
        <section className="relative overflow-hidden bg-linear-to-r from-black via-neutral-900 to-orange-900">
          <div
            aria-hidden
            className="absolute -left-16 -bottom-16 h-72 w-72 rounded-full bg-orange-500/20 blur-3xl"
          />
          <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-16 text-center">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Envie de découvrir nos saveurs ?
            </h2>
            <p className="max-w-xl text-neutral-300">
              Commandez en ligne en quelques clics, ou venez nous rendre visite à Dakar pour
              vivre l&apos;expérience Saveur Amir.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/commander"
                className="rounded-md bg-orange-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-orange-400"
              >
                Commander en ligne
              </Link>
              <a
                href="#contact"
                className="rounded-md border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:border-orange-400 hover:text-orange-400"
              >
                Nous contacter
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}


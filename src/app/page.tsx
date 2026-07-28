import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

function formatFCFA(value: number) {
  return `${value.toLocaleString("fr-FR")} F`;
}

export const dynamic = "force-dynamic";

export default async function Home() {
  const categories = await prisma.menuCategory.findMany({
    include: { items: { where: { available: true }, orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-black text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero-saveur-amir.svg"
            alt="Saveur Amir"
            className="absolute inset-0 h-full w-full object-cover opacity-70"
          />
          <div className="relative mx-auto max-w-6xl px-4 py-28 sm:py-36">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-400">
              Restaurant sénégalais · Dakar
            </p>
            <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight sm:text-6xl">
              <span className="text-orange-500">Saveur</span> Amir
            </h1>
            <p className="mt-4 max-w-xl text-lg text-neutral-200">
              Une cuisine généreuse entre traditions sénégalaises et classiques européens,
              préparée avec des produits frais, au cœur de Dakar.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/commander"
                className="rounded-md bg-orange-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-orange-400"
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

        {/* About */}
        <section id="a-propos" className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
                Notre histoire
              </p>
              <h2 className="mt-2 text-3xl font-bold text-black">
                L&apos;authenticité sénégalaise, sans frontières
              </h2>
            </div>
            <p className="self-center text-slate-600">
              Installé à Dakar, Saveur Amir vous accueille dans une ambiance chaleureuse pour
              partager les grands classiques de la cuisine sénégalaise — thiéboudienne, yassa,
              mafé — aux côtés de plats européens revisités. Chaque assiette est préparée sur
              place, à partir de produits locaux et de saison.
            </p>
          </div>
        </section>

        {/* Menu highlights */}
        <section id="menu" className="bg-neutral-50 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-10 text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
                Notre carte
              </p>
              <h2 className="mt-2 text-3xl font-bold text-black">Quelques-uns de nos plats</h2>
            </div>

            <div className="space-y-12">
              {categories
                .filter((category) => category.items.length > 0)
                .map((category) => (
                  <div key={category.id}>
                    <h3 className="mb-4 text-xl font-semibold text-black">{category.name}</h3>
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {category.items.map((item) => (
                        <div
                          key={item.id}
                          className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md"
                        >
                          <div className="relative h-44 w-full bg-neutral-900">
                            {item.imageUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="h-full w-full object-cover"
                              />
                            )}
                          </div>
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-semibold text-black">{item.name}</h4>
                              <span className="whitespace-nowrap font-semibold text-orange-600">
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

            <div className="mt-12 text-center">
              <Link
                href="/commander"
                className="rounded-md bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Passer commande maintenant
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}


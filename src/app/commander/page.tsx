import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PublicOrderForm } from "./public-order-form";

export default async function CommanderPage() {
  const categories = await prisma.menuCategory.findMany({
    include: { items: { where: { available: true }, orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="flex-1 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
              Commander en ligne
            </p>
            <h1 className="mt-2 text-3xl font-bold text-black">
              Composez votre commande, <span className="text-orange-600">Saveur Amir</span>{" "}
              s&apos;occupe du reste
            </h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              Choisissez vos plats, indiquez votre nom et votre numéro de téléphone : notre équipe
              vous recontacte pour confirmer votre commande et l&apos;heure de retrait.
            </p>
          </div>

          <PublicOrderForm categories={categories} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

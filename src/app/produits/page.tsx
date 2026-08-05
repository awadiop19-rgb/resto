import Link from "next/link";
import { PageContainer } from "@/components/page-container";
import { prisma } from "@/lib/prisma";
import { ProduitsManager } from "./produits-manager";

export const dynamic = "force-dynamic";

export default async function ProduitsPage() {
  const produits = await prisma.product.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { _count: { select: { movements: true } } },
  });

  return (
    <PageContainer>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Produits</h1>
          <p className="mt-1 text-sm text-slate-500">
            Les consommables suivis en stock, avec leur unité de comptage et leur seuil d&apos;alerte.{" "}
            <Link href="/stock" className="text-orange-600 hover:underline">
              Voir le stock
            </Link>
          </p>
        </div>

        <ProduitsManager
          produits={produits.map((p) => ({
            id: p.id,
            name: p.name,
            unit: p.unit,
            category: p.category,
            faitMaison: p.faitMaison,
            seuilAlerte: p.seuilAlerte,
            active: p.active,
            mouvements: p._count.movements,
          }))}
        />
      </div>
    </PageContainer>
  );
}

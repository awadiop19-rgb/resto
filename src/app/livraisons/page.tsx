import Link from "next/link";
import { auth } from "@/auth";
import { PageContainer } from "@/components/page-container";
import { AutoRefresh } from "@/components/auto-refresh";
import { prisma } from "@/lib/prisma";
import { totalCommande } from "@/lib/total-commande";
import { LivraisonsManager } from "./livraisons-manager";

export const dynamic = "force-dynamic";

export default async function LivraisonsPage() {
  const [commandes, livreurs, zonesConfigurees] = await Promise.all([
    prisma.order.findMany({
      // Les livraisons remises restent visibles un temps pour vérification,
      // mais la file d'affectation ne montre que ce qui reste à traiter.
      where: { type: "LIVRAISON", status: { not: "ANNULEE" } },
      include: {
        items: { include: { menuItem: { select: { name: true } } } },
        livreur: { select: { id: true, name: true } },
        quartier: { select: { name: true } },
        payment: { select: { id: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "LIVREUR", active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.deliveryZone.count({ where: { active: true } }),
  ]);

  const session = await auth();
  const peutConfigurer = session?.user.role === "ADMIN";

  const lignes = commandes.map((commande) => ({
    id: commande.id,
    reference: commande.reference,
    createdAt: commande.createdAt,
    source: commande.source,
    status: commande.status,
    deliveryStatus: commande.deliveryStatus,
    customerName: commande.customerName,
    customerPhone: commande.customerPhone,
    deliveryAddress: commande.deliveryAddress,
    deliveryNote: commande.deliveryNote,
    quartierName: commande.quartier?.name ?? null,
    livreur: commande.livreur,
    assignedAt: commande.assignedAt,
    deliveredAt: commande.deliveredAt,
    paye: commande.payment != null,
    articles: commande.items.map((i) => `${i.quantity}× ${i.menuItem.name}`).join(", "),
    sousTotal: commande.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
    deliveryFee: commande.deliveryFee,
    total: totalCommande(commande.items, commande.deliveryFee),
  }));

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">Livraisons</h1>
            <p className="mt-1 text-sm text-slate-500">
              Affectez un livreur à une ou plusieurs commandes, et suivez les tournées.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {peutConfigurer && (
              <Link
                href="/livraisons/zones"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm transition hover:bg-slate-50"
              >
                Zones et tarifs
              </Link>
            )}
            <AutoRefresh intervalMs={15000} />
          </div>
        </div>
        <LivraisonsManager
          commandes={lignes}
          livreurs={livreurs}
          zonesConfigurees={zonesConfigurees}
          peutConfigurer={peutConfigurer}
        />
      </div>
    </PageContainer>
  );
}

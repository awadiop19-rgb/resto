import Link from "next/link";
import { PageContainer } from "@/components/page-container";
import { prisma } from "@/lib/prisma";
import { ZonesManager } from "./zones-manager";

export const dynamic = "force-dynamic";

export default async function ZonesPage() {
  const zones = await prisma.deliveryZone.findMany({
    include: {
      quartiers: { orderBy: { name: "asc" }, include: { _count: { select: { orders: true } } } },
    },
    orderBy: { name: "asc" },
  });

  const lignes = zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    fee: zone.fee,
    active: zone.active,
    quartiers: zone.quartiers.map((q) => ({
      id: q.id,
      name: q.name,
      commandes: q._count.orders,
    })),
  }));

  return (
    <PageContainer>
      <div className="space-y-6">
        <div>
          <Link href="/livraisons" className="text-sm text-orange-600 hover:underline">
            ← Retour aux livraisons
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Zones de livraison</h1>
          <p className="mt-1 text-sm text-slate-500">
            Chaque zone porte un tarif. Les quartiers rattachés à une zone en héritent, et ce sont
            eux que le client choisit au moment de commander.
          </p>
        </div>
        <ZonesManager zones={lignes} />
      </div>
    </PageContainer>
  );
}

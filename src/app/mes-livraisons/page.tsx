import { auth } from "@/auth";
import { PageContainer } from "@/components/page-container";
import { AutoRefresh } from "@/components/auto-refresh";
import { prisma } from "@/lib/prisma";
import { totalCommande } from "@/lib/total-commande";
import { MesLivraisons } from "./mes-livraisons";

export const dynamic = "force-dynamic";

export default async function MesLivraisonsPage() {
  const session = await auth();
  const { id: userId, role } = session!.user;

  // Un livreur ne voit que ses propres courses ; la répartition reste à la caisse.
  const commandes = await prisma.order.findMany({
    where: {
      type: "LIVRAISON",
      status: { not: "ANNULEE" },
      ...(role === "LIVREUR" ? { livreurId: userId } : { livreurId: { not: null } }),
    },
    include: {
      items: { include: { menuItem: { select: { name: true } } } },
      livreur: { select: { name: true } },
      quartier: { select: { name: true } },
      payment: { select: { id: true } },
    },
    orderBy: [{ deliveryStatus: "asc" }, { assignedAt: "asc" }],
  });

  const lignes = commandes.map((commande) => ({
    id: commande.id,
    reference: commande.reference,
    deliveryStatus: commande.deliveryStatus,
    customerName: commande.customerName,
    customerPhone: commande.customerPhone,
    deliveryAddress: commande.deliveryAddress,
    deliveryNote: commande.deliveryNote,
    quartierName: commande.quartier?.name ?? null,
    livreurName: commande.livreur?.name ?? null,
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
            <h1 className="text-2xl font-semibold">Mes livraisons</h1>
            <p className="mt-1 text-sm text-slate-500">
              {role === "LIVREUR"
                ? "Les commandes qui vous sont confiées."
                : "Toutes les commandes confiées à un livreur."}
            </p>
          </div>
          <AutoRefresh intervalMs={15000} />
        </div>
        <MesLivraisons commandes={lignes} montrerLivreur={role !== "LIVREUR"} />
      </div>
    </PageContainer>
  );
}

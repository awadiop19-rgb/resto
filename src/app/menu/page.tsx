import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MenuManager } from "./menu-manager";
import { PageContainer } from "@/components/page-container";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const session = await auth();

  const [categories, produits, soldes] = await Promise.all([
    prisma.menuCategory.findMany({
      include: { items: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, unit: true, category: true },
    }),
    // Le solde rend le lien tangible : « Coca — 12 u » dit du premier coup d'œil
    // qu'on a désigné le bon produit.
    prisma.stockMovement.groupBy({ by: ["productId"], _sum: { quantity: true } }),
  ]);

  const stockParProduit = new Map(soldes.map((s) => [s.productId, s._sum.quantity ?? 0]));

  return (
    <PageContainer>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Menu</h1>
        <MenuManager
          categories={categories}
          produits={produits.map((p) => ({ ...p, stock: stockParProduit.get(p.id) ?? 0 }))}
          isAdmin={session!.user.role === "ADMIN"}
        />
      </div>
    </PageContainer>
  );
}

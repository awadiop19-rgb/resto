import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/page-container";
import { CashRegisterManager } from "./cash-register-manager";
import { CaisseDashboard } from "./caisse-dashboard";
import { CaissesEnRetard } from "./caisse-en-retard";
import { AutoRefresh } from "@/components/auto-refresh";
import { CommandesPassees } from "./commandes-passees";
import { borneJournee, debutJourneeExploitation, getCaissesNonFermees } from "@/lib/journee-caisse";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

/** Date du jour d'exploitation demandé dans l'URL, ou la veille par défaut. */
function resoudreJour(valeur: string | undefined) {
  const parsed = valeur ? new Date(`${valeur}T12:00:00`) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed;

  const veille = debutJourneeExploitation();
  veille.setDate(veille.getDate() - 1);
  return veille;
}

export default async function CaissePage({
  searchParams,
}: {
  searchParams: Promise<{ jour?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const { jour } = await searchParams;

  // Une caisse laissée ouverte sur une journée antérieure bloque tout le reste :
  // on n'affiche que l'écran de rattrapage tant qu'elle n'est pas clôturée.
  const caissesEnRetard = await getCaissesNonFermees(userId);
  if (caissesEnRetard.length > 0) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold">Caisse</h1>
          <CaissesEnRetard caisses={caissesEnRetard} />
        </div>
      </PageContainer>
    );
  }

  // Le service en cours sert de frontière : ce qui le précède part dans
  // l'historique daté, pour que l'écran d'encaissement ne montre que le jour.
  const debutService = debutJourneeExploitation();
  const jourConsulte = resoudreJour(jour);
  const fenetrePassee = borneJournee(jourConsulte);

  const [cashRegistersToday, unpaidOrders, retardataires, commandesDuJour] = await Promise.all([
    prisma.cashRegister.findMany({
      where: { cashierId: userId, openedAt: { gte: debutService } },
      include: {
        payments: {
          include: { order: { include: { items: { include: { menuItem: true } } } } },
        },
      },
      orderBy: { openedAt: "desc" },
    }),
    prisma.order.findMany({
      where: { status: { not: "ANNULEE" }, payment: null, createdAt: { gte: debutService } },
      include: { items: { include: { menuItem: true } } },
      orderBy: { createdAt: "asc" },
    }),
    // Impayées des services précédents : elles ne sont plus sous les yeux du
    // caissier, un rappel évite qu'elles tombent dans l'oubli.
    prisma.order.findMany({
      where: { status: { not: "ANNULEE" }, payment: null, createdAt: { lt: debutService } },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.findMany({
      where: {
        status: { not: "ANNULEE" },
        createdAt: { gte: fenetrePassee.debut, lt: fenetrePassee.fin },
      },
      include: {
        items: { include: { menuItem: true } },
        payment: { select: { method: true, createdAt: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const cashRegister = cashRegistersToday.find((cr) => cr.status === "OUVERTE") ?? null;

  const payments = cashRegistersToday.flatMap((cr) => cr.payments);
  const totalCash = payments.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amount, 0);
  const totalWave = payments.filter((p) => p.method === "WAVE").reduce((s, p) => s + p.amount, 0);

  const dishCounts = new Map<string, number>();
  for (const payment of payments) {
    for (const item of payment.order.items) {
      dishCounts.set(item.menuItem.name, (dishCounts.get(item.menuItem.name) ?? 0) + item.quantity);
    }
  }
  const dishesSold = Array.from(dishCounts.entries())
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity);

  // Commandes déjà encaissées par ce caissier aujourd'hui, la plus récente d'abord.
  const paidOrders = payments
    .map((payment) => ({
      paymentId: payment.id,
      paidAt: payment.createdAt,
      method: payment.method,
      amount: payment.amount,
      tableNumber: payment.order.tableNumber,
      customerName: payment.order.customerName,
      items: payment.order.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        name: item.menuItem.name,
      })),
    }))
    .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());

  const impayeesPassees = {
    nombre: retardataires.length,
    // La plus récente : c'est le jour vers lequel envoyer le caissier en premier.
    dernierJour: retardataires[0]
      ? format(debutJourneeExploitation(retardataires[0].createdAt), "yyyy-MM-dd")
      : null,
  };

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">Caisse</h1>
          <AutoRefresh intervalMs={15000} />
        </div>
        <CaisseDashboard
          ordersCount={payments.length}
          totalRevenue={totalCash + totalWave}
          totalCash={totalCash}
          totalWave={totalWave}
          dishesSold={dishesSold}
        />
        <CashRegisterManager
          cashRegister={cashRegister}
          unpaidOrders={unpaidOrders}
          paidOrders={paidOrders}
          impayeesPassees={impayeesPassees}
        />
        <CommandesPassees
          jour={format(fenetrePassee.debut, "yyyy-MM-dd")}
          caisseOuverte={cashRegister != null}
          commandes={commandesDuJour.map((commande) => ({
            id: commande.id,
            createdAt: commande.createdAt,
            source: commande.source,
            type: commande.type,
            tableNumber: commande.tableNumber,
            customerName: commande.customerName,
            deliveryFee: commande.deliveryFee,
            paiement: commande.payment
              ? { method: commande.payment.method, paidAt: commande.payment.createdAt }
              : null,
            items: commande.items.map((item) => ({
              id: item.id,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              name: item.menuItem.name,
            })),
          }))}
        />
      </div>
    </PageContainer>
  );
}

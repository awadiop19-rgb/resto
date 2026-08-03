import { prisma } from "@/lib/prisma";
import { ExpenseManager } from "./expense-manager";
import { PageContainer } from "@/components/page-container";

export const dynamic = "force-dynamic";

/** Jour en cours, au format des champs date. Le serveur est a GMT, celui du restaurant. */
function aujourdhui() {
  return new Date().toISOString().slice(0, 10);
}

export default async function DepensesPage({
  searchParams,
}: {
  searchParams: Promise<{ debut?: string; fin?: string }>;
}) {
  const params = await searchParams;

  // La journee en cours par defaut. La page sert d'abord a saisir les depenses du
  // jour ; tout l'historique la rendrait illisible en quelques semaines, et le
  // total affiche a cote de la liste ne voudrait plus rien dire.
  let debut = params.debut || aujourdhui();
  let fin = params.fin || aujourdhui();
  // Bornes inversees dans un lien partage : on les remet dans l'ordre plutot que
  // de renvoyer une liste vide sans explication.
  if (debut > fin) [debut, fin] = [fin, debut];

  const expenses = await prisma.expense.findMany({
    // Bornes en GMT explicites : les dates sont enregistrees dans ce fuseau, et
    // la requete ne doit pas dependre de l'horloge du processus qui l'execute.
    where: {
      date: { gte: new Date(`${debut}T00:00:00.000Z`), lte: new Date(`${fin}T23:59:59.999Z`) },
    },
    include: { user: true },
    orderBy: { date: "desc" },
  });

  return (
    <PageContainer>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Dépenses</h1>
        <ExpenseManager expenses={expenses} debut={debut} fin={fin} aujourdhui={aujourdhui()} />
      </div>
    </PageContainer>
  );
}

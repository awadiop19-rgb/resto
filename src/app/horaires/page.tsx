import { PageContainer } from "@/components/page-container";
import { HorairesManager } from "./horaires-manager";
import { FermeturesManager } from "./fermetures-manager";
import { estOuvert, fermetureDuJour, messageFermeture } from "@/lib/horaires";
import { getReglages, getToutesFermetures } from "@/lib/horaires-data";

export const dynamic = "force-dynamic";

export default async function HorairesPage() {
  const [reglages, fermetures] = await Promise.all([getReglages(), getToutesFermetures()]);
  const maintenant = new Date();
  const ouvert = estOuvert(reglages, maintenant);
  const exceptionnelle = fermetureDuJour(reglages.fermetures, maintenant);

  return (
    <PageContainer>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Horaires d&apos;ouverture</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Ces heures ne gouvernent que la commande en ligne. En dehors, le site continue
            d&apos;afficher la carte mais n&apos;accepte plus de commande, et le client voit le
            moment de la prochaine ouverture. Le service en salle et la caisse ne sont pas
            concernés : une commande peut toujours être saisie au comptoir.
          </p>
        </div>

        {/* Ce que voit le client en ce moment meme : sans cet apercu, il faudrait
            ouvrir le site public dans un autre onglet pour verifier un reglage. */}
        <div
          className={`rounded-xl border p-4 ${
            ouvert ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
          }`}
        >
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.1em] text-slate-500">
            En ce moment
          </p>
          <p
            className={`mt-1 text-lg font-semibold ${
              ouvert ? "text-emerald-700" : "text-slate-900"
            }`}
          >
            {ouvert ? "La commande en ligne est ouverte" : "La commande en ligne est fermée"}
          </p>
          {!ouvert && (
            <p className="mt-1 text-sm text-slate-600">{messageFermeture(reglages, maintenant)}</p>
          )}
          {exceptionnelle && (
            <p className="mt-1 text-sm text-slate-500">
              Fermeture exceptionnelle en cours — les horaires de la semaine ne s&apos;appliquent
              pas aujourd&apos;hui.
            </p>
          )}
        </div>

        <HorairesManager horaires={reglages.horaires} />

        <FermeturesManager fermetures={fermetures} />
      </div>
    </PageContainer>
  );
}

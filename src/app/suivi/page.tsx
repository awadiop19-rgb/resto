import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { prisma } from "@/lib/prisma";
import { formatFCFA } from "@/lib/format";
import { sousTotal, totalCommande } from "@/lib/total-commande";
import { PaiementWave } from "@/components/paiement-wave";
import { normaliserReference } from "@/lib/reference-commande";
import {
  DELIVERY_LABELS,
  TYPE_LABELS,
  etapesSuivi,
  masquerTelephone,
} from "@/lib/libelles-commande";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Suivre ma commande | Saveur Amir",
  description: "Suivez l'avancement de votre commande Saveur Amir avec votre numéro de commande.",
};

export default async function SuiviPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const reference = ref ? normaliserReference(ref) : "";

  const commande = reference
    ? await prisma.order.findUnique({
        where: { reference },
        include: {
          items: { include: { menuItem: { select: { name: true } } } },
          livreur: { select: { name: true } },
          quartier: { select: { name: true } },
          payment: { select: { id: true } },
        },
      })
    : null;

  const introuvable = Boolean(reference) && !commande;

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />

      <main className="flex-1 bg-neutral-50">
        <div className="mx-auto max-w-2xl px-4 py-14">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
              Suivi de commande
            </p>
            <h1 className="mt-2 text-3xl font-bold text-black sm:text-4xl">Où en est ma commande ?</h1>
            <p className="mt-3 text-slate-600">
              Saisissez le numéro reçu à la validation de votre commande.
            </p>
          </div>

          <form method="get" className="mx-auto mt-8 flex max-w-md gap-2">
            <input
              type="text"
              name="ref"
              defaultValue={ref ?? ""}
              placeholder="Ex : K7M2QX"
              aria-label="Numéro de commande"
              className="min-h-12 w-full rounded-lg border border-neutral-300 px-4 text-center font-mono text-lg uppercase tracking-[0.2em] focus:border-orange-500 focus:outline-none"
            />
            <button
              type="submit"
              className="min-h-12 shrink-0 rounded-lg bg-black px-6 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Suivre
            </button>
          </form>

          {introuvable && (
            <p className="mx-auto mt-6 max-w-md rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
              Aucune commande ne correspond à ce numéro. Vérifiez la saisie, ou appelez-nous.
            </p>
          )}

          {commande && (
            <div className="mt-10 space-y-5">
              <div className="rounded-2xl border border-neutral-200 bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Commande</p>
                    <p className="font-mono text-2xl font-bold tracking-[0.2em]">
                      {commande.reference}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-800">
                      {TYPE_LABELS[commande.type]}
                    </span>
                    <p className="mt-1 text-xs text-slate-400">
                      {new Date(commande.createdAt).toLocaleString("fr-FR")}
                    </p>
                  </div>
                </div>

                {commande.status === "ANNULEE" ? (
                  <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                    Cette commande a été annulée. Contactez-nous si vous pensez qu&apos;il s&apos;agit
                    d&apos;une erreur.
                  </p>
                ) : (
                  <ol className="mt-6 space-y-3">
                    {etapesSuivi(commande.type, commande.status, commande.deliveryStatus).map((etape) => (
                      <li key={etape.cle} className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            etape.faite ? "bg-orange-500 text-black" : "bg-neutral-200 text-neutral-400"
                          }`}
                        >
                          {etape.faite ? "✓" : ""}
                        </span>
                        <span
                          className={etape.faite ? "font-medium text-black" : "text-slate-400"}
                        >
                          {etape.libelle}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}

                {commande.type === "LIVRAISON" && commande.deliveryStatus && (
                  <p className="mt-5 rounded-lg bg-neutral-50 px-4 py-3 text-sm text-slate-600">
                    <span className="font-medium text-black">
                      {DELIVERY_LABELS[commande.deliveryStatus]}
                    </span>
                    {commande.livreur && commande.deliveryStatus !== "A_ASSIGNER" && (
                      <> — votre livreur est {commande.livreur.name}.</>
                    )}
                  </p>
                )}
              </div>

              {/* Une commande annulée n'a plus à être payée. */}
              {!commande.payment && commande.status !== "ANNULEE" && (
                <PaiementWave
                  reference={commande.reference!}
                  montant={totalCommande(commande.items, commande.deliveryFee)}
                  dejaDeclare={commande.waveDeclaredAt != null}
                />
              )}

              {commande.payment && (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <span className="font-semibold">Commande réglée.</span> Merci !
                </p>
              )}

              <div className="rounded-2xl border border-neutral-200 bg-white p-6">
                <h2 className="font-semibold text-black">Le détail</h2>
                <ul className="mt-3 divide-y divide-neutral-100 text-sm">
                  {commande.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3 py-2">
                      <span>
                        {item.quantity} × {item.menuItem.name}
                        {item.note && <span className="italic text-slate-400"> — {item.note}</span>}
                      </span>
                      <span className="shrink-0 tabular-nums text-slate-600">
                        {formatFCFA(item.unitPrice * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 space-y-1 border-t border-neutral-100 pt-3 text-sm">
                  {commande.deliveryFee ? (
                    <>
                      <div className="flex justify-between text-slate-600">
                        <span>Sous-total</span>
                        <span className="tabular-nums">{formatFCFA(sousTotal(commande.items))}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>
                          Livraison
                          {commande.quartier && (
                            <span className="text-xs text-slate-400"> · {commande.quartier.name}</span>
                          )}
                        </span>
                        <span className="tabular-nums">{formatFCFA(commande.deliveryFee)}</span>
                      </div>
                    </>
                  ) : null}
                  <div className="flex justify-between pt-1 text-base font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">
                      {formatFCFA(totalCommande(commande.items, commande.deliveryFee))}
                    </span>
                  </div>
                </div>

                <dl className="mt-5 space-y-1.5 border-t border-neutral-100 pt-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Au nom de</dt>
                    <dd className="text-right">{commande.customerName ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Téléphone</dt>
                    <dd className="text-right">{masquerTelephone(commande.customerPhone) ?? "—"}</dd>
                  </div>
                  {commande.type === "LIVRAISON" && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Livraison à</dt>
                      <dd className="max-w-xs text-right">
                        {commande.quartier && (
                          <span className="font-medium">{commande.quartier.name} — </span>
                        )}
                        {commande.deliveryAddress}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              <p className="text-center text-sm text-slate-500">
                Une question ?{" "}
                <Link href="/#contact" className="text-orange-600 hover:underline">
                  Contactez-nous
                </Link>
              </p>
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

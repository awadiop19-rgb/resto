import { Navbar } from "@/components/navbar";

/**
 * Coque des ecrans professionnels.
 *
 * Le decalage a gauche laisse la place au rail fixe a partir de `lg`, et la
 * marge basse celle des onglets du telephone : sans elle, la derniere ligne d'un
 * tableau passerait sous la barre et resterait inatteignable.
 */
export function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="flex-1 lg:pl-56">
        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 lg:pb-10">{children}</main>
      </div>
    </>
  );
}

import { auth, signOut } from "@/auth";
import { Navigation } from "@/components/navigation";
import { NAVIGATION } from "@/lib/navigation";

/**
 * Point d'entree serveur de la navigation : il lit la session, choisit la carte
 * du role et confie l'affichage au composant client, qui a besoin de connaitre
 * la page courante pour marquer le lien actif.
 */
export async function Navbar() {
  const session = await auth();
  if (!session?.user) return null;

  const navigation = NAVIGATION[session.user.role];
  if (!navigation) return null;

  async function deconnexion() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <Navigation
      navigation={navigation}
      utilisateur={{ nom: session.user.name ?? "", role: session.user.role }}
      deconnexion={deconnexion}
    />
  );
}

import type { NomIcone } from "@/lib/navigation";

/**
 * Jeu d'icones de navigation, dessine ici plutot qu'importe.
 *
 * Une bibliotheque complete pour quatorze pictogrammes pesterait plus lourd que
 * l'application ne le merite, et le trait ne serait pas le notre. Toutes suivent
 * la meme grille de 24 et le meme trait de 1,75 : c'est ce qui les fait passer
 * pour une famille plutot que pour une collection.
 */
const TRACES: Record<NomIcone, React.ReactNode> = {
  tableau: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  commandes: (
    <>
      <path d="M5 3.5h14v17l-2.5-1.5L14 20.5 12 19l-2 1.5-2.5-1.5L5 20.5z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  livraisons: (
    <>
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </>
  ),
  menu: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.5" />
    </>
  ),
  caisse: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10.5h18" />
      <path d="M10 14.5h4" />
    </>
  ),
  versements: (
    <>
      <path d="M12 3v10" />
      <path d="M8.5 9.5 12 13l3.5-3.5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  depenses: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
  stock: (
    <>
      <path d="M3 8.5 12 4l9 4.5-9 4.5z" />
      <path d="M3 8.5v7L12 20l9-4.5v-7" />
      <path d="M12 13v7" />
    </>
  ),
  produits: (
    <>
      <path d="M4 11V5a1 1 0 0 1 1-1h6l9 9-7 7z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
  comptabilite: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  journee: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.5l3.5 2" />
    </>
  ),
  mois: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
    </>
  ),
  // Un coffre-fort, avec sa porte et sa molette : `caisse` est deja un tiroir,
  // et les deux ne designent pas le meme argent.
  coffre: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 4v16" />
      <circle cx="14.5" cy="12" r="2.5" />
    </>
  ),
  utilisateurs: (
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M16 5.5a3.5 3.5 0 0 1 0 6.8M17.5 20c0-2.6-.9-4.4-2.3-5.3" />
    </>
  ),
  // Une devanture plutot qu'une horloge : `journee` en est deja une, et deux
  // cadrans voisins dans le meme rail ne se distingueraient plus.
  horaires: (
    <>
      <path d="M5.5 4h13L21 8.5H3z" />
      <path d="M5 8.5V20h14V8.5" />
      <path d="M10 20v-4.5h4V20" />
    </>
  ),
  // Une photographie encadree : `menu` est une assiette, et l'ecran des photos
  // ne parle que d'images.
  photos: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="m4 17 4.5-4.5L12 16l3-2.5L20 18" />
    </>
  ),
  profil: (
    <>
      <circle cx="12" cy="9" r="3.5" />
      <path d="M5.5 19.5c0-3.2 2.9-5 6.5-5s6.5 1.8 6.5 5" />
    </>
  ),
};

export function Icone({ nom, className = "h-5 w-5" }: { nom: NomIcone; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {TRACES[nom]}
    </svg>
  );
}

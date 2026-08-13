"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TAILLE_MAX_OCTETS, TYPES_ACCEPTES, formatOctets } from "@/lib/photos-menu";

type Article = { id: string; name: string; imageUrl: string | null; available: boolean };
type Categorie = { id: string; name: string; items: Article[] };

/** Retire accents et casse : « thiéré » doit se trouver en tapant « thiere ». */
function normalize(valeur: string) {
  return valeur
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Une vignette par article, avec le bouton qui ouvre l'appareil photo.
 *
 * L'article est le sien : chacun garde son envoi en cours, son message et son
 * erreur. Un composant unique qui suivrait les cinquante articles à la fois
 * devrait tenir cinquante états en parallèle pour la même chose.
 */
function CarteArticle({ article }: { article: Article }) {
  const router = useRouter();
  const champ = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState(article.imageUrl);
  const [apercu, setApercu] = useState<string | null>(null);
  const [bilan, setBilan] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function envoyer(fichier: File) {
    // Le même plafond qu'au serveur, appliqué avant de téléverser : sur une
    // connexion de téléphone, découvrir le refus après trois minutes d'attente
    // vaut à peu près pour un plantage.
    if (fichier.size > TAILLE_MAX_OCTETS) {
      setErreur(
        `Photo trop lourde (${formatOctets(fichier.size)}) : ${formatOctets(TAILLE_MAX_OCTETS)} au maximum.`
      );
      return;
    }

    setErreur(null);
    setBilan(null);
    setEnCours(true);
    // Aperçu immédiat : l'envoi peut durer, et sans lui rien ne dit que la bonne
    // photo a été choisie.
    const local = URL.createObjectURL(fichier);
    setApercu(local);

    try {
      const corps = new FormData();
      corps.append("photo", fichier);
      const reponse = await fetch(`/api/menu/${article.id}/photo`, { method: "POST", body: corps });
      const donnees = await reponse.json().catch(() => null);
      if (!reponse.ok) throw new Error(donnees?.erreur ?? "L'envoi de la photo a échoué");

      setPhoto(donnees.url);
      setBilan(
        `Enregistrée : ${formatOctets(donnees.tailleOrigine)} → ${formatOctets(donnees.taille)}, ${donnees.largeur}×${donnees.hauteur} px`
      );
      router.refresh();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'envoi de la photo a échoué");
    } finally {
      setApercu(null);
      URL.revokeObjectURL(local);
      setEnCours(false);
    }
  }

  async function retirer() {
    if (!window.confirm(`Retirer la photo de « ${article.name} » ?`)) return;
    setErreur(null);
    setBilan(null);
    setEnCours(true);
    try {
      const reponse = await fetch(`/api/menu/${article.id}/photo`, { method: "DELETE" });
      const donnees = await reponse.json().catch(() => null);
      if (!reponse.ok) throw new Error(donnees?.erreur ?? "Le retrait de la photo a échoué");
      setPhoto(null);
      router.refresh();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Le retrait de la photo a échoué");
    } finally {
      setEnCours(false);
    }
  }

  const affichee = apercu ?? photo;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="relative h-40 w-full bg-slate-100">
        {affichee ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={affichee}
            alt={article.name}
            className={`h-full w-full object-cover ${enCours ? "opacity-40" : ""}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl opacity-40">
            🍽️
          </div>
        )}
        {enCours && (
          <span className="absolute inset-0 flex items-center justify-center text-sm font-medium text-slate-700">
            Envoi…
          </span>
        )}
        {!article.available && (
          <span className="absolute left-2 top-2 rounded-full bg-slate-900/80 px-2 py-0.5 text-xs text-white">
            Indisponible
          </span>
        )}
      </div>

      <div className="space-y-2 p-3">
        <p className="font-medium text-slate-900">{article.name}</p>

        <input
          ref={champ}
          type="file"
          accept={TYPES_ACCEPTES}
          className="hidden"
          onChange={(e) => {
            const fichier = e.target.files?.[0];
            // Le champ est vidé aussitôt : sans cela, renvoyer le même fichier
            // après un échec ne déclencherait aucun événement.
            e.target.value = "";
            if (fichier) envoyer(fichier);
          }}
        />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={enCours}
            onClick={() => champ.current?.click()}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {photo ? "Changer la photo" : "Ajouter une photo"}
          </button>
          {photo && (
            <button
              type="button"
              disabled={enCours}
              onClick={retirer}
              className="text-sm text-red-600 hover:underline disabled:opacity-50"
            >
              Retirer
            </button>
          )}
        </div>

        {bilan && <p className="text-xs text-emerald-700">{bilan}</p>}
        {erreur && <p className="text-xs text-red-700">{erreur}</p>}
      </div>
    </div>
  );
}

export function PhotosManager({ categories }: { categories: Categorie[] }) {
  const [recherche, setRecherche] = useState("");
  const [sansPhoto, setSansPhoto] = useState(false);

  const manquantes = useMemo(
    () => categories.flatMap((c) => c.items).filter((i) => !i.imageUrl).length,
    [categories]
  );

  const affichees = useMemo(() => {
    const terme = normalize(recherche.trim());
    return categories
      .map((c) => ({
        ...c,
        items: c.items.filter(
          (i) => (!terme || normalize(i.name).includes(terme)) && (!sansPhoto || !i.imageUrl)
        ),
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, recherche, sansPhoto]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Chercher un plat"
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:w-64"
        />
        <button
          type="button"
          onClick={() => setSansPhoto((v) => !v)}
          className={`rounded-full px-3 py-1.5 text-sm ${
            sansPhoto ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600"
          }`}
        >
          Sans photo ({manquantes})
        </button>
      </div>

      {affichees.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
          {sansPhoto ? "Tous les plats trouvés ont une photo." : "Aucun plat ne correspond."}
        </p>
      )}

      {affichees.map((categorie) => (
        <div key={categorie.id} className="space-y-3">
          <h2 className="flex items-center gap-3 font-semibold text-slate-900">
            {categorie.name}
            <span className="h-px flex-1 bg-slate-200" />
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categorie.items.map((article) => (
              <CarteArticle key={article.id} article={article} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

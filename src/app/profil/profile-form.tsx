"use client";

import { useState, useTransition } from "react";
import { updateProfile, changePassword } from "@/lib/actions/profile";
import { assurerSucces } from "@/lib/actions/resultat";
import type { Role } from "@/generated/prisma/client";

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  SERVEUR: "Serveur",
  CUISINE: "Cuisine",
  CAISSIER: "Caissier",
  COMPTABILITE: "Comptabilité",
  LIVREUR: "Livreur",
};

export function ProfileForm({ name, email, role }: { name: string; email: string; role: Role }) {
  const [isPending, startTransition] = useTransition();

  const [profileForm, setProfileForm] = useState({ name, email });
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  function submitProfile() {
    setProfileError(null);
    setProfileSuccess(null);
    if (!profileForm.name.trim() || !profileForm.email.trim()) {
      setProfileError("Nom et email requis");
      return;
    }
    startTransition(async () => {
      try {
        assurerSucces(await updateProfile({ name: profileForm.name.trim(), email: profileForm.email.trim() }));
        setProfileSuccess("Profil mis à jour");
      } catch (e) {
        setProfileError(e instanceof Error ? e.message : "Erreur lors de la mise à jour");
      }
    });
  }

  function submitPassword() {
    setPasswordError(null);
    setPasswordSuccess(null);
    if (!passwordForm.currentPassword) {
      setPasswordError("Mot de passe actuel requis");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError("Le nouveau mot de passe doit contenir 6 caractères minimum");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("La confirmation ne correspond pas au nouveau mot de passe");
      return;
    }
    startTransition(async () => {
      try {
        assurerSucces(
          await changePassword({
            currentPassword: passwordForm.currentPassword,
            newPassword: passwordForm.newPassword,
          })
        );
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setPasswordSuccess("Mot de passe modifié");
      } catch (e) {
        setPasswordError(e instanceof Error ? e.message : "Erreur lors du changement de mot de passe");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">Informations</h2>
        {profileError && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{profileError}</p>
        )}
        {profileSuccess && (
          <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{profileSuccess}</p>
        )}
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Rôle</label>
            <div className="rounded-md bg-slate-50 px-3 py-1.5 text-sm text-slate-500">{ROLE_LABELS[role]}</div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Nom</label>
            <input
              value={profileForm.name}
              onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Email</label>
            <input
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <button
            disabled={isPending}
            onClick={submitProfile}
            className="rounded-md bg-black px-4 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">Changer le mot de passe</h2>
        {passwordError && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{passwordError}</p>
        )}
        {passwordSuccess && (
          <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{passwordSuccess}</p>
        )}
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Mot de passe actuel</label>
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Nouveau mot de passe</label>
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Confirmer le nouveau mot de passe</label>
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <button
            disabled={isPending}
            onClick={submitPassword}
            className="rounded-md bg-black px-4 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            Modifier le mot de passe
          </button>
        </div>
      </div>
    </div>
  );
}

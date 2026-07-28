"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createUser,
  deleteUser,
  resetUserPassword,
  setUserActive,
  updateUser,
  updateUserRole,
} from "@/lib/actions/users";
import type { Role } from "@/generated/prisma/client";

type User = { id: string; name: string; email: string; role: Role; active: boolean };

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  SERVEUR: "Serveur",
  CUISINE: "Cuisine",
  CAISSIER: "Caissier",
  COMPTABILITE: "Comptabilité",
};

export function UserManager({ users, currentUserId }: { users: User[]; currentUserId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "SERVEUR" as Role,
  });

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "">("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "" });

  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetForm, setResetForm] = useState({ password: "", confirmPassword: "" });

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((u) => {
      if (term && !u.name.toLowerCase().includes(term) && !u.email.toLowerCase().includes(term)) return false;
      if (roleFilter && u.role !== roleFilter) return false;
      if (statusFilter === "active" && !u.active) return false;
      if (statusFilter === "inactive" && u.active) return false;
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  function submit() {
    setError(null);
    if (!form.name || !form.email || form.password.length < 6) {
      setError("Nom, email et mot de passe (6 caractères min.) requis");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("La confirmation ne correspond pas au mot de passe");
      return;
    }
    startTransition(async () => {
      try {
        await createUser({ name: form.name, email: form.email, password: form.password, role: form.role });
        setForm({ name: "", email: "", password: "", confirmPassword: "", role: "SERVEUR" });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de la création");
      }
    });
  }

  function changeRole(id: string, role: Role) {
    setError(null);
    startTransition(async () => {
      try {
        await updateUserRole(id, role);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors du changement de rôle");
      }
    });
  }

  function toggleActive(user: User) {
    setError(null);
    if (user.active && !window.confirm(`Désactiver le compte de ${user.name} ?`)) return;
    startTransition(async () => {
      try {
        await setUserActive(user.id, !user.active);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors du changement de statut");
      }
    });
  }

  function startEdit(user: User) {
    setError(null);
    setEditingId(user.id);
    setEditForm({ name: user.name, email: user.email });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({ name: "", email: "" });
  }

  function submitEdit(id: string) {
    setError(null);
    if (!editForm.name.trim() || !editForm.email.trim()) {
      setError("Nom et email requis");
      return;
    }
    startTransition(async () => {
      try {
        await updateUser({ id, name: editForm.name.trim(), email: editForm.email.trim() });
        cancelEdit();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de la modification");
      }
    });
  }

  function startReset(id: string) {
    setError(null);
    setResettingId(id);
    setResetForm({ password: "", confirmPassword: "" });
  }

  function cancelReset() {
    setResettingId(null);
    setResetForm({ password: "", confirmPassword: "" });
  }

  function submitReset(id: string) {
    setError(null);
    if (resetForm.password.length < 6) {
      setError("Le mot de passe doit contenir 6 caractères minimum");
      return;
    }
    if (resetForm.password !== resetForm.confirmPassword) {
      setError("La confirmation ne correspond pas au mot de passe");
      return;
    }
    startTransition(async () => {
      try {
        await resetUserPassword({ id, password: resetForm.password });
        cancelReset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de la réinitialisation");
      }
    });
  }

  function remove(id: string, name: string) {
    setError(null);
    if (!window.confirm(`Supprimer définitivement le compte de ${name} ?`)) return;
    startTransition(async () => {
      try {
        await deleteUser(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de la suppression");
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">Ajouter un utilisateur</h2>
        <div className="grid gap-3 sm:grid-cols-6">
          <input
            placeholder="Nom"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
          <input
            type="password"
            placeholder="Confirmer le mot de passe"
            value={form.confirmPassword}
            onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            {Object.entries(ROLE_LABELS).map(([role, label]) => (
              <option key={role} value={role}>
                {label}
              </option>
            ))}
          </select>
          <button
            disabled={isPending}
            onClick={submit}
            className="rounded-md bg-black px-4 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Liste des utilisateurs</h2>
          <div className="flex flex-wrap gap-2">
            <input
              placeholder="Rechercher (nom, email)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as Role | "")}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">Tous les rôles</option>
              {Object.entries(ROLE_LABELS).map(([role, label]) => (
                <option key={role} value={role}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | "active" | "inactive")}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">Tous les statuts</option>
              <option value="active">Actifs</option>
              <option value="inactive">Inactifs</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-400">
              <th className="pb-2">Nom</th>
              <th className="pb-2">Email</th>
              <th className="pb-2">Rôle</th>
              <th className="pb-2">Statut</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className="border-t border-slate-100 align-top">
                {editingId === user.id ? (
                  <>
                    <td className="py-2 pr-2">
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="py-2 pr-2 text-slate-400">{ROLE_LABELS[user.role]}</td>
                    <td className="py-2 pr-2 text-slate-400">{user.active ? "Actif" : "Inactif"}</td>
                    <td className="py-2 pr-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          disabled={isPending}
                          onClick={() => submitEdit(user.id)}
                          className="rounded-md bg-black px-2 py-1 text-xs text-white hover:bg-neutral-800 disabled:opacity-50"
                        >
                          Enregistrer
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                        >
                          Annuler
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2 pr-2">
                      {user.name} {user.id === currentUserId && <span className="text-xs text-slate-400">(vous)</span>}
                    </td>
                    <td className="py-2 pr-2">{user.email}</td>
                    <td className="py-2 pr-2">
                      <select
                        value={user.role}
                        disabled={user.id === currentUserId}
                        onChange={(e) => changeRole(user.id, e.target.value as Role)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                      >
                        {Object.entries(ROLE_LABELS).map(([role, label]) => (
                          <option key={role} value={role}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          user.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {user.active ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button onClick={() => startEdit(user)} className="text-xs text-slate-600 hover:underline">
                          Modifier
                        </button>
                        <button
                          onClick={() => startReset(user.id)}
                          className="text-xs text-slate-600 hover:underline"
                        >
                          Mot de passe
                        </button>
                        {user.id !== currentUserId && (
                          <button
                            onClick={() => toggleActive(user)}
                            className="text-xs text-amber-700 hover:underline"
                          >
                            {user.active ? "Désactiver" : "Activer"}
                          </button>
                        )}
                        {user.id !== currentUserId && (
                          <button
                            onClick={() => remove(user.id, user.name)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {resettingId &&
              (() => {
                const user = filteredUsers.find((u) => u.id === resettingId);
                if (!user) return null;
                return (
                  <tr key={`${user.id}-reset`} className="border-t border-slate-100 bg-slate-50">
                    <td colSpan={5} className="py-3 pr-2">
                      <div className="flex flex-wrap items-end gap-2">
                        <span className="text-xs text-slate-500">
                          Nouveau mot de passe pour <strong>{user.name}</strong> :
                        </span>
                        <input
                          type="password"
                          placeholder="Nouveau mot de passe"
                          value={resetForm.password}
                          onChange={(e) => setResetForm((f) => ({ ...f, password: e.target.value }))}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                        />
                        <input
                          type="password"
                          placeholder="Confirmer"
                          value={resetForm.confirmPassword}
                          onChange={(e) => setResetForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                        />
                        <button
                          disabled={isPending}
                          onClick={() => submitReset(user.id)}
                          className="rounded-md bg-black px-3 py-1 text-xs text-white hover:bg-neutral-800 disabled:opacity-50"
                        >
                          Enregistrer
                        </button>
                        <button
                          onClick={cancelReset}
                          className="rounded-md border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
                        >
                          Annuler
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })()}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-slate-400">
                  Aucun utilisateur ne correspond à ces critères.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

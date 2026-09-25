"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();

  const [role, setRole] = useState<UserRole>("participant");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Username is mapped to a synthetic email since Supabase Auth
    // is email/password based. This keeps the UX as "username + password"
    // while staying on Supabase Auth (see README for the mapping).
    const email = `${username.trim().toLowerCase()}@users.komunitas.app`;

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("Invalid username or password.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profile && profile.role !== role) {
      setError(`This account is registered as ${profile.role}, not ${role}.`);
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    router.push(role === "admin" ? "/admin" : "/dashboard");
    router.refresh();
  }

  return (
    <main className="ambient-gradient flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher />
        </div>
        <div className="mb-8 text-center">
          <Link href="/" className="text-xl font-extrabold text-orange-dark">
            Komunitas
          </Link>
          <h1 className="mt-4 text-2xl font-bold">{t("auth.welcomeBack")}</h1>
          <p className="mt-1 text-sm text-ink/60">{t("auth.loginSubtitle")}</p>
        </div>

        <div className="card p-6">
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-full bg-cream-warm p-1">
            {(["participant", "admin"] as UserRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-full py-2 text-sm font-semibold transition ${
                  role === r ? "bg-orange text-white shadow-soft" : "text-ink/60"
                }`}
              >
                {r === "participant" ? t("auth.participant") : t("auth.admin")}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("auth.username")}</label>
              <input
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-orange"
                placeholder="yourusername"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("auth.password")}</label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-orange"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-orange py-3 text-sm font-semibold text-white shadow-soft hover:bg-orange-dark disabled:opacity-60"
            >
              {loading
                ? t("auth.loggingIn")
                : `${t("auth.loginAs")} ${role === "participant" ? t("auth.participant") : t("auth.admin")}`}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-ink/60">
          {t("auth.noAccount")}{" "}
          <Link href="/register" className="font-semibold text-orange-dark">
            {t("auth.signUp")}
          </Link>
        </p>
      </div>
    </main>
  );
}

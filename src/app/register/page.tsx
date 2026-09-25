"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Interest } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LocationSelect, type LocationValue } from "@/components/LocationSelect";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();

  const STEPS = [t("register.stepAccount"), t("register.stepProfile"), t("register.stepInterests")];

  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [interests, setInterests] = useState<Interest[]>([]);

  // Account
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Profile
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [location, setLocation] = useState<LocationValue>({
    city: "",
    kecamatan: "",
    kelurahan: "",
  });
  const [bio, setBio] = useState("");

  // Interests
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [primaryInterest, setPrimaryInterest] = useState<string>("");

  useEffect(() => {
    supabase
      .from("interests")
      .select("*")
      .then(({ data }) => setInterests(data ?? []));
  }, [supabase]);

  function toggleInterest(id: string) {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  async function handleFinish() {
    setError(null);
    if (!primaryInterest) {
      setError("Please select a primary interest.");
      return;
    }
    setLoading(true);

    const email = `${username.trim().toLowerCase()}@users.komunitas.app`;

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError || !signUpData.user) {
      setError(signUpError?.message ?? "Could not create account.");
      setLoading(false);
      return;
    }

    const userId = signUpData.user.id;

    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      username: username.trim().toLowerCase(),
      role: "participant",
      full_name: fullName,
      nickname,
      age: age ? Number(age) : null,
      gender,
      whatsapp_number: whatsapp,
      kelurahan: location.kelurahan,
      kecamatan: location.kecamatan,
      city: location.city,
      bio,
      primary_interest_id: primaryInterest,
    });

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    if (selectedInterests.length > 0) {
      await supabase.from("user_interests").insert(
        selectedInterests.map((interest_id) => ({ user_id: userId, interest_id }))
      );
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="ambient-gradient flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher />
        </div>
        <div className="mb-8 text-center">
          <Link href="/" className="text-xl font-extrabold text-orange-dark">
            Komunitas
          </Link>
          <h1 className="mt-4 text-2xl font-bold">{t("auth.createAccount")}</h1>
        </div>

        <div className="mb-6 flex items-center justify-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  i <= step ? "bg-orange text-white" : "bg-cream-warm text-ink/40"
                }`}
              >
                {i + 1}
              </div>
              {i < STEPS.length - 1 && <div className="h-px w-8 bg-ink/10" />}
            </div>
          ))}
        </div>

        <div className="card p-6">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">{t("auth.username")}</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-xl border border-ink/10 px-4 py-2.5 text-sm outline-none focus:border-orange"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("auth.password")}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-ink/10 px-4 py-2.5 text-sm outline-none focus:border-orange"
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label={t("register.fullName")} value={fullName} onChange={setFullName} full />
                <Field label={t("register.nickname")} value={nickname} onChange={setNickname} />
                <Field label={t("register.age")} value={age} onChange={setAge} type="number" />
                <Field label={t("register.gender")} value={gender} onChange={setGender} />
                <Field label={t("register.whatsapp")} value={whatsapp} onChange={setWhatsapp} full />
              </div>

              <LocationSelect value={location} onChange={setLocation} />

              <div>
                <label className="mb-1 block text-sm font-medium">{t("register.bio")}</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-ink/10 px-4 py-2.5 text-sm outline-none focus:border-orange"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-ink/60">{t("register.selectInterestsHint")}</p>
              <div className="flex flex-wrap gap-2">
                {interests.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => toggleInterest(i.id)}
                    className={`rounded-full border px-3.5 py-2 text-sm font-medium transition ${
                      selectedInterests.includes(i.id)
                        ? "border-orange bg-orange/10 text-orange-dark"
                        : "border-ink/10 text-ink/60 hover:bg-cream-warm"
                    }`}
                  >
                    {i.emoji} {i.label}
                  </button>
                ))}
              </div>

              {selectedInterests.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    {t("register.primaryInterest")}
                  </label>
                  <select
                    value={primaryInterest}
                    onChange={(e) => setPrimaryInterest(e.target.value)}
                    className="w-full rounded-xl border border-ink/10 px-4 py-2.5 text-sm outline-none focus:border-orange"
                  >
                    <option value="">{t("register.selectOne")}</option>
                    {interests
                      .filter((i) => selectedInterests.includes(i.id))
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.emoji} {i.label}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep((s) => s - 1)}
              className="text-sm font-medium text-ink/50 disabled:opacity-0"
            >
              {t("register.back")}
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="rounded-full bg-orange px-6 py-2.5 text-sm font-semibold text-white shadow-soft hover:bg-orange-dark"
              >
                {t("register.continue")}
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleFinish}
                className="rounded-full bg-orange px-6 py-2.5 text-sm font-semibold text-white shadow-soft hover:bg-orange-dark disabled:opacity-60"
              >
                {loading ? t("register.creating") : t("register.finish")}
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-ink/60">
          {t("auth.alreadyHaveAccount")}{" "}
          <Link href="/login" className="font-semibold text-orange-dark">
            {t("auth.logIn")}
          </Link>
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  full = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-ink/10 px-4 py-2.5 text-sm outline-none focus:border-orange"
      />
    </div>
  );
}

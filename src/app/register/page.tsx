"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { friendlyErrorKey, otpErrorKey } from "@/lib/errors";
import {
  BIO_MAX,
  isStrongPassword,
  isValidEmail,
  normalizeEmail,
  normalizeWhatsapp,
} from "@/lib/validation";
import { geocodeArea } from "@/lib/wilayah";
import { onboardingStep } from "@/lib/onboarding";
import { GENDERS, type Gender, type Interest, type Profile } from "@/types";
import { AuthShell, PasswordInput, ResendButton, useCooldown } from "@/components/AuthShell";
import { OtpInput, OTP_LENGTH } from "@/components/OtpInput";
import { EMPTY_LOCATION, LocationSelect, type LocationValue } from "@/components/LocationSelect";
import { Alert, FieldShell, PrimaryButton, focusFirstError, inputClass } from "@/components/ui";
import { InterestPicker, PrimaryInterestSelect } from "@/components/InterestPicker";

type Step = "loading" | "account" | "verify" | "profile" | "interests" | "done";
const STEP_ORDER: Step[] = ["account", "verify", "profile", "interests"];

export default function RegisterPage() {
  return (
    <Suspense>
      <Register />
    </Suspense>
  );
}

/**
 * Sign Up:
 *   1  Account   — email + password; Supabase creates the auth user and
 *                  emails a 6-digit code (a DB trigger creates the profile row)
 *   1B Verify    — verify the code; this signs the user in
 *   2  Profile   — personal information (saved to the existing profile row)
 *   3  Interests — hobbies + primary interest; marks onboarding complete
 * A signed-in user whose onboarding is incomplete resumes at step 2 or 3.
 */
function Register() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const { t } = useLanguage();

  const [step, setStep] = useState<Step>("loading");
  const [showResumeNotice, setShowResumeNotice] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [initialProfile, setInitialProfile] = useState<Partial<Profile> | null>(null);

  // Resume detection: already signed in (e.g. closed the browser mid-way).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setStep("account");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;

      const next = onboardingStep(profile);
      if (next === "done") {
        router.replace("/dashboard");
        return;
      }
      setUserId(user.id);
      setEmail(user.email ?? "");
      setInitialProfile(profile);
      setShowResumeNotice(true);
      setStep(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stepIndex = STEP_ORDER.indexOf(step);
  const stepLabels = [
    t("register.stepAccount"),
    t("register.stepVerify"),
    t("register.stepProfile"),
    t("register.stepInterests"),
  ];

  const title =
    step === "verify"
      ? t("auth.verifyEmailTitle")
      : step === "profile"
      ? t("register.personalInfo")
      : step === "interests"
      ? t("register.interestsTitle")
      : step === "done"
      ? t("register.readyTitle")
      : t("auth.createAccountTitle");

  return (
    <AuthShell
      wide={step === "profile" || step === "interests"}
      title={title}
      subtitle={
        step === "account"
          ? t("auth.createAccountSubtitle")
          : step === "profile"
          ? t("register.personalInfoHint")
          : undefined
      }
      footer={
        step === "account" ? (
          <>
            {t("auth.alreadyHaveAccount")}{" "}
            <Link href="/login" className="font-semibold text-orange-dark">
              {t("auth.signIn")}
            </Link>
          </>
        ) : undefined
      }
    >
      {stepIndex >= 0 && (
        <ol className="mb-6 flex items-center justify-center gap-2">
          {stepLabels.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span
                title={label}
                aria-current={i === stepIndex ? "step" : undefined}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  i <= stepIndex ? "bg-orange text-white" : "bg-cream-warm text-ink/40"
                }`}
              >
                {i < stepIndex ? "✓" : i + 1}
              </span>
              <span className={`hidden text-xs sm:inline ${i === stepIndex ? "font-semibold" : "text-ink/50"}`}>
                {label}
              </span>
              {i < stepLabels.length - 1 && <span className="h-px w-5 bg-ink/10" />}
            </li>
          ))}
        </ol>
      )}

      {step === "loading" && <p className="py-8 text-center text-sm text-ink/50">{t("common.loading")}</p>}

      {showResumeNotice && (step === "profile" || step === "interests") ? (
        <div className="space-y-4 text-center">
          <p className="font-semibold">{t("register.incompleteTitle")}</p>
          <p className="text-sm text-ink/60">{t("register.incompleteDesc")}</p>
          <PrimaryButton className="w-full" onClick={() => setShowResumeNotice(false)}>
            {t("register.continueRegistration")}
          </PrimaryButton>
        </div>
      ) : (
        <>
          {step === "account" && (
            <AccountStep
              email={email}
              setEmail={setEmail}
              onCreated={(sessionUserId) => {
                if (sessionUserId) {
                  // Email confirmation is disabled in this Supabase project,
                  // so the account is already active and signed in.
                  setUserId(sessionUserId);
                  setStep("profile");
                } else {
                  setStep("verify");
                }
              }}
            />
          )}
          {step === "verify" && (
            <VerifyStep
              email={normalizeEmail(email)}
              onVerified={(id) => {
                setUserId(id);
                setStep("profile");
              }}
              onUseAnotherEmail={() => setStep("account")}
            />
          )}
          {step === "profile" && userId && (
            <ProfileStep
              userId={userId}
              initial={initialProfile}
              onSaved={(saved) => {
                setInitialProfile((prev) => ({ ...prev, ...saved }));
                setStep("interests");
              }}
            />
          )}
          {step === "interests" && (
            <InterestsStep
              initialPrimary={initialProfile?.primary_interest_id ?? ""}
              onBack={() => setStep("profile")}
              onDone={() => {
                setStep("done");
                setTimeout(() => {
                  router.replace("/dashboard");
                  router.refresh();
                }, 1500);
              }}
            />
          )}
          {step === "done" && (
            <div className="space-y-4 py-4 text-center">
              <CheckCircle2 size={48} className="mx-auto text-green-600" />
              <p className="text-sm text-ink/60">{t("register.readySubtitle")}</p>
              <PrimaryButton
                onClick={() => {
                  router.replace("/dashboard");
                  router.refresh();
                }}
              >
                {t("register.goDashboard")}
              </PrimaryButton>
            </div>
          )}
        </>
      )}
    </AuthShell>
  );
}

// ---------------------------------------------------------------------------
// Session 1 — create the auth account
// ---------------------------------------------------------------------------

function AccountStep({
  email,
  setEmail,
  onCreated,
}: {
  email: string;
  setEmail: (v: string) => void;
  onCreated: (sessionUserId: string | null) => void;
}) {
  const supabase = createClient();
  const { t } = useLanguage();
  const busy = useRef(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"email" | "password" | "confirm", TranslationKey>>
  >({});
  const [error, setError] = useState<TranslationKey | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    setError(null);
    setEmailTaken(false);

    const clean = normalizeEmail(email);
    const errs: typeof fieldErrors = {};
    if (!isValidEmail(clean)) errs.email = "auth.emailInvalid";
    if (!isStrongPassword(password)) errs.password = "auth.passwordWeak";
    if (password !== confirm) errs.confirm = "auth.passwordMismatch";
    setFieldErrors(errs);
    if (Object.keys(errs).length) {
      focusFirstError(["email", "password", "confirm"], errs);
      return;
    }

    busy.current = true;
    setLoading(true);
    try {
      const { data: status, error: statusError } = await supabase.rpc("auth_email_status", {
        p_email: clean,
      });
      if (statusError) return setError(friendlyErrorKey(statusError, "auth_email_status"));
      if (status === "confirmed") return setEmailTaken(true);

      // For an existing *unverified* account Supabase re-sends the code
      // instead of creating a duplicate user.
      const { data, error: signUpError } = await supabase.auth.signUp({ email: clean, password });
      if (signUpError) {
        if (signUpError.code === "weak_password") {
          setFieldErrors({ password: "auth.passwordWeak" });
          return;
        }
        if (signUpError.code === "user_already_exists" || signUpError.code === "email_exists") {
          return setEmailTaken(true);
        }
        const key = friendlyErrorKey(signUpError, "signUp");
        return setError(key === "err.generic" ? "auth.emailSendFailed" : key);
      }
      // Supabase hides existing accounts behind a fake user with no identities.
      if (data.user && data.user.identities?.length === 0) return setEmailTaken(true);

      onCreated(data.session ? data.user?.id ?? null : null);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <FieldShell id="email" label={t("auth.email")} error={fieldErrors.email ? t(fieldErrors.email) : null}>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("auth.emailPlaceholder")}
          className={inputClass(Boolean(fieldErrors.email) || emailTaken)}
        />
      </FieldShell>
      <FieldShell
        id="password"
        label={t("auth.password")}
        error={fieldErrors.password ? t(fieldErrors.password) : null}
        hint={t("auth.passwordRules")}
      >
        <PasswordInput
          id="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hasError={Boolean(fieldErrors.password)}
        />
      </FieldShell>
      <FieldShell
        id="confirm"
        label={t("auth.confirmPassword")}
        error={fieldErrors.confirm ? t(fieldErrors.confirm) : null}
      >
        <PasswordInput
          id="confirm"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          hasError={Boolean(fieldErrors.confirm)}
        />
      </FieldShell>

      {emailTaken && (
        <Alert>
          {t("auth.emailTaken")}{" "}
          <Link
            href={`/login?email=${encodeURIComponent(normalizeEmail(email))}`}
            className="font-semibold underline"
          >
            {t("auth.signInInstead")}
          </Link>
        </Alert>
      )}
      {error && <Alert>{t(error)}</Alert>}

      <PrimaryButton type="submit" className="w-full" loading={loading} loadingText={t("auth.creatingAccount")}>
        {t("auth.createAccountBtn")}
      </PrimaryButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Session 1B — verify the emailed code
// ---------------------------------------------------------------------------

function VerifyStep({
  email,
  onVerified,
  onUseAnotherEmail,
}: {
  email: string;
  onVerified: (userId: string) => void;
  onUseAnotherEmail: () => void;
}) {
  const supabase = createClient();
  const { t } = useLanguage();
  const cooldown = useCooldown();
  const busy = useRef(false);

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [info, setInfo] = useState<TranslationKey | null>(null);

  // signUp just sent the first code.
  useEffect(() => {
    cooldown.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verify(token = code) {
    if (busy.current) return;
    setError(null);
    if (token.length !== OTP_LENGTH) return setError("auth.codeIncomplete");
    busy.current = true;
    setLoading(true);
    const { data, error: verifyError } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    busy.current = false;
    setLoading(false);
    if (verifyError || !data.user) return setError(otpErrorKey(verifyError));
    setInfo("auth.emailVerified");
    onVerified(data.user.id);
  }

  async function resend() {
    if (resending) return;
    setError(null);
    setInfo(null);
    setResending(true);
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
    setResending(false);
    if (resendError) {
      const key = friendlyErrorKey(resendError, "resend signup");
      return setError(key === "err.generic" ? "auth.emailSendFailed" : key);
    }
    cooldown.start();
    setInfo("auth.codeResent");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        verify();
      }}
      className="space-y-5"
    >
      <div className="text-center">
        <p className="font-semibold">{t("auth.codeSent")}</p>
        <p className="mt-1 text-sm text-ink/60">{t("auth.codeSentTo", { email })}</p>
      </div>

      <OtpInput
        value={code}
        onChange={(v) => {
          setCode(v);
          if (error) setError(null);
        }}
        onComplete={(v) => verify(v)}
        hasError={Boolean(error)}
        disabled={loading}
      />

      {info && !error && <Alert tone="info">{t(info)}</Alert>}
      {error && <Alert>{t(error)}</Alert>}

      <PrimaryButton type="submit" className="w-full" loading={loading} loadingText={t("auth.verifying")}>
        {t("auth.verifyEmailBtn")}
      </PrimaryButton>

      <div className="flex items-center justify-between">
        <ResendButton seconds={cooldown.seconds} sending={resending} onResend={resend} />
        <button type="button" onClick={onUseAnotherEmail} className="text-sm font-medium text-ink/60">
          {t("auth.useAnotherEmail")}
        </button>
      </div>
      <p className="text-center text-xs text-ink/40">{t("auth.checkSpam")}</p>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Session 2 — personal information
// ---------------------------------------------------------------------------

type ProfileField =
  | "fullName"
  | "nickname"
  | "gender"
  | "whatsapp"
  | "city"
  | "kecamatan"
  | "kelurahan"
  | "bio";
// Form order == element ids, for scrolling to the first invalid field.
const PROFILE_FIELD_ORDER: ProfileField[] = [
  "fullName",
  "nickname",
  "gender",
  "whatsapp",
  "city",
  "kecamatan",
  "kelurahan",
  "bio",
];

function ProfileStep({
  userId,
  initial,
  onSaved,
}: {
  userId: string;
  initial: Partial<Profile> | null;
  onSaved: (saved: Partial<Profile>) => void;
}) {
  const supabase = createClient();
  const { t } = useLanguage();
  const busy = useRef(false);

  const [fullName, setFullName] = useState(initial?.full_name ?? "");
  const [nickname, setNickname] = useState(initial?.nickname ?? "");
  const [gender, setGender] = useState<Gender | "">(initial?.gender ?? "");
  const [whatsapp, setWhatsapp] = useState(initial?.whatsapp_number ?? "");
  const [location, setLocation] = useState<LocationValue>(
    initial?.city_id
      ? {
          provinceId: initial.province_id ?? "",
          province: initial.province ?? "",
          cityId: initial.city_id,
          city: initial.city ?? "",
          kecamatanId: initial.kecamatan_id ?? "",
          kecamatan: initial.kecamatan ?? "",
          kelurahanId: initial.kelurahan_id ?? "",
          kelurahan: initial.kelurahan ?? "",
        }
      : EMPTY_LOCATION
  );
  const [bio, setBio] = useState(initial?.bio ?? "");

  const [errors, setErrors] = useState<Partial<Record<ProfileField, TranslationKey>>>({});
  const [error, setError] = useState<TranslationKey | null>(null);
  const [saving, setSaving] = useState(false);

  function validate() {
    const e: typeof errors = {};
    if (!fullName.trim()) e.fullName = "register.errFullName";
    if (!nickname.trim()) e.nickname = "register.errNickname";
    if (!gender) e.gender = "register.errGender";
    if (!normalizeWhatsapp(whatsapp)) e.whatsapp = "register.errWhatsapp";
    if (!location.cityId) e.city = "register.errCity";
    if (!location.kecamatanId) e.kecamatan = "register.errKecamatan";
    if (!location.kelurahanId) e.kelurahan = "register.errKelurahan";
    if (!bio.trim()) e.bio = "register.errBio";
    else if (bio.length > BIO_MAX) e.bio = "register.errBioLong";
    return e;
  }

  // Clear a field's error as soon as it's edited.
  function clear(field: ProfileField) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    setError(null);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) {
      setError("register.fixErrors");
      focusFirstError(PROFILE_FIELD_ORDER, errs);
      return;
    }

    busy.current = true;
    setSaving(true);
    try {
      // Approximate centroid of the kelurahan, used only as a manual
      // location fallback. Best effort: registration doesn't depend on it.
      const point = await geocodeArea({
        city: location.city,
        kecamatan: location.kecamatan,
        kelurahan: location.kelurahan,
      });

      const saved = {
        full_name: fullName.trim(),
        nickname: nickname.trim(),
        gender: gender as Gender,
        whatsapp_number: normalizeWhatsapp(whatsapp)!,
        province_id: location.provinceId || location.cityId.slice(0, 2),
        province: location.province || null,
        city_id: location.cityId,
        city: location.city,
        kecamatan_id: location.kecamatanId,
        kecamatan: location.kecamatan,
        kelurahan_id: location.kelurahanId,
        kelurahan: location.kelurahan,
        bio: bio.trim(),
        area_lat: point?.lat ?? null,
        area_lng: point?.lng ?? null,
      };
      const { error: updateError } = await supabase.from("profiles").update(saved).eq("id", userId);
      if (updateError) return setError(friendlyErrorKey(updateError, "save profile"));
      onSaved(saved);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  const err = (f: ProfileField) => (errors[f] ? t(errors[f]!) : null);

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldShell id="fullName" label={t("register.fullName")} error={err("fullName")} className="sm:col-span-2">
          <input
            id="fullName"
            autoComplete="name"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              clear("fullName");
            }}
            className={inputClass(Boolean(errors.fullName))}
          />
        </FieldShell>
        <FieldShell id="nickname" label={t("register.nickname")} error={err("nickname")}>
          <input
            id="nickname"
            autoComplete="nickname"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              clear("nickname");
            }}
            className={inputClass(Boolean(errors.nickname))}
          />
        </FieldShell>
        <FieldShell id="gender" label={t("register.gender")} error={err("gender")}>
          <select
            id="gender"
            value={gender}
            onChange={(e) => {
              setGender(e.target.value as Gender | "");
              clear("gender");
            }}
            className={inputClass(Boolean(errors.gender))}
          >
            <option value="">{t("register.genderSelect")}</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {t(`gender.${g}`)}
              </option>
            ))}
          </select>
        </FieldShell>
        <FieldShell
          id="whatsapp"
          label={t("register.whatsapp")}
          error={err("whatsapp")}
          hint={t("register.whatsappHint")}
          className="sm:col-span-2"
        >
          <input
            id="whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={whatsapp}
            onChange={(e) => {
              setWhatsapp(e.target.value);
              clear("whatsapp");
            }}
            className={inputClass(Boolean(errors.whatsapp))}
          />
        </FieldShell>
      </div>

      <LocationSelect
        value={location}
        idPrefix=""
        onChange={(v) => {
          setLocation(v);
          if (v.cityId) clear("city");
          if (v.kecamatanId) clear("kecamatan");
          if (v.kelurahanId) clear("kelurahan");
        }}
        errors={{ city: err("city"), kecamatan: err("kecamatan"), kelurahan: err("kelurahan") }}
      />

      <FieldShell
        id="bio"
        label={t("register.bio")}
        error={err("bio")}
        hint={
          <span className={bio.length > BIO_MAX ? "text-red-600" : ""}>
            {bio.length}/{BIO_MAX}
          </span>
        }
      >
        <textarea
          id="bio"
          value={bio}
          rows={3}
          onChange={(e) => {
            setBio(e.target.value);
            clear("bio");
          }}
          placeholder={t("register.bioPlaceholder")}
          className={inputClass(Boolean(errors.bio))}
        />
      </FieldShell>

      {error && <Alert>{t(error)}</Alert>}

      <PrimaryButton type="submit" className="w-full" loading={saving} loadingText={t("register.savingProfile")}>
        {t("common.continue")}
      </PrimaryButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Session 3 — hobbies + primary interest
// ---------------------------------------------------------------------------

function InterestsStep({
  initialPrimary,
  onBack,
  onDone,
}: {
  initialPrimary: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const supabase = createClient();
  const { t } = useLanguage();
  const busy = useRef(false);

  const [interests, setInterests] = useState<Interest[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [primary, setPrimary] = useState(initialPrimary);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: all, error: loadError }, { data: mine }] = await Promise.all([
        supabase.from("interests").select("*").neq("is_active", false).order("sort_order"),
        supabase.from("user_interests").select("interest_id"),
      ]);
      if (loadError) {
        friendlyErrorKey(loadError, "load interests");
        setLoadFailed(true);
        return;
      }
      setInterests(all ?? []);
      setSelected((mine ?? []).map((r: { interest_id: string }) => r.interest_id));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(id: string) {
    setError(null);
    const next = selected.includes(id) ? selected.filter((i) => i !== id) : [...selected, id];
    setSelected(next);
    if (!next.includes(primary)) setPrimary(""); // primary must stay among selected
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    if (selected.length === 0) return setError("register.errInterests");
    if (!primary || !selected.includes(primary)) {
      setError("register.errPrimary");
      focusFirstError(["primary"], { primary: true });
      return;
    }
    busy.current = true;
    setSaving(true);
    const { error: rpcError } = await supabase.rpc("set_user_interests", {
      p_interest_ids: selected,
      p_primary: primary,
    });
    busy.current = false;
    setSaving(false);
    if (rpcError) return setError(friendlyErrorKey(rpcError, "set_user_interests"));
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <p className="text-sm text-ink/60">{t("register.selectInterestsHint")}</p>

      {loadFailed ? (
        <Alert>{t("err.generic")}</Alert>
      ) : (
        <InterestPicker interests={interests} selected={selected} onToggle={toggle} />
      )}

      <PrimaryInterestSelect
        interests={interests}
        selected={selected}
        value={primary}
        onChange={(v) => {
          setPrimary(v);
          setError(null);
        }}
        hasError={error === "register.errPrimary"}
      />

      {error && <Alert>{t(error)}</Alert>}

      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="text-sm font-medium text-ink/50">
          {t("common.back")}
        </button>
        <PrimaryButton type="submit" loading={saving} loadingText={t("register.finishing")}>
          {t("register.finish")}
        </PrimaryButton>
      </div>
    </form>
  );
}

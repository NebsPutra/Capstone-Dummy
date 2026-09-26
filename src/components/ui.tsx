"use client";

import { cn } from "@/lib/utils";

export function inputClass(hasError?: boolean) {
  return cn(
    "w-full rounded-xl border bg-white px-4 py-2.5 text-sm outline-none transition focus:border-orange disabled:bg-cream-warm disabled:opacity-60",
    hasError ? "border-red-400 bg-red-50/40" : "border-ink/10"
  );
}

/** Label + control + inline error/hint. `id` must match the control's id. */
export function FieldShell({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string | null;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink/50">{hint}</p>
      ) : null}
    </div>
  );
}

/** Scroll to and focus the first invalid field, in form order. */
export function focusFirstError(order: string[], errors: Record<string, unknown>) {
  const first = order.find((key) => errors[key]);
  if (!first) return;
  const el = document.getElementById(first);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  (el as HTMLElement).focus?.({ preventScroll: true });
}

export function PrimaryButton({
  loading,
  loadingText,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingText?: string;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full bg-orange px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-orange-dark disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      )}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "info" | "success";
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl px-4 py-3 text-sm",
        tone === "error" && "bg-red-50 text-red-700",
        tone === "info" && "bg-cream-warm text-ink/70",
        tone === "success" && "bg-green-50 text-green-700"
      )}
    >
      {children}
    </div>
  );
}

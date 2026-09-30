"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Modal built on the native <dialog>: showModal() gives a focus trap, Escape
 * to close, the top layer (so page transforms can't trap it) and focus
 * returns to the opener on close. Mount it to open, unmount to close.
 * A child with data-autofocus gets focus first.
 */
export function Modal({
  onClose,
  labelledBy,
  className,
  children,
}: {
  onClose: () => void;
  labelledBy: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Layout effect: the cleanup's close() must run while the dialog is still attached.
  useLayoutEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault(); // Escape: let the parent unmount us
        onClose();
      }}
      className="m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 text-ink backdrop:bg-transparent"
    >
      <div className="flex h-full w-full items-end justify-center bg-ink/40 sm:items-center sm:p-4" onClick={onClose}>
        <div className={className} onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </dialog>
  );
}

export function inputClass(hasError?: boolean) {
  return cn(
    "w-full rounded-xl border bg-surface px-4 py-2.5 text-sm outline-none transition focus:border-orange disabled:bg-cream-warm disabled:opacity-60",
    hasError ? "border-danger/60 bg-danger-soft/40" : "border-ink/10"
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
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink/65">{hint}</p>
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
        "inline-flex items-center justify-center gap-2 rounded-full bg-orange-deep px-6 py-3 text-sm font-semibold text-white shadow-soft transition duration-150 hover:-translate-y-0.5 hover:bg-orange-deeper hover:shadow-lift active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0",
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
        tone === "error" && "bg-danger-soft text-danger",
        tone === "info" && "bg-cream-warm text-ink/70",
        tone === "success" && "bg-success-soft text-success"
      )}
    >
      {children}
    </div>
  );
}

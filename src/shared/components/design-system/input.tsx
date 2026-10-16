"use client";

import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helper, id, ...props }, ref) => {
    // Id stabil & unik (bukan dari `label` yang bisa berulang) supaya
    // `<label htmlFor>` selalu benar dan dua input berlabel sama tidak bentrok.
    const autoId = useId();
    const inputId = id ?? props.name ?? `input-${autoId}`;
    // Nama aksesibel: label terlihat bila ada; selain itu aria-label eksplisit
    // atau placeholder — sehingga tidak ada input tanpa nama (WCAG 4.1.2).
    const ariaLabel = label ? undefined : (props["aria-label"] ?? props.placeholder);
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "flex h-11 w-full rounded-xl border bg-white px-3.5 text-base text-slate-900 placeholder:text-slate-500 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:bg-slate-50",
            error ? "border-danger-500" : "border-slate-200",
            className
          )}
          aria-label={ariaLabel}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${inputId}-error` : helper ? `${inputId}-helper` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-sm text-danger-600">
            {error}
          </p>
        )}
        {!error && helper && (
          <p id={`${inputId}-helper`} className="text-sm text-slate-500">
            {helper}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

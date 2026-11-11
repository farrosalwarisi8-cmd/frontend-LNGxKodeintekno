"use client";

import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helper?: string;
}

/**
 * Area teks multiline dengan label — memakai token/kelas semantik yang sama
 * dengan komponen `Input` design-system (tanpa warna hex tertulis).
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helper, id, required, ...props }, ref) => {
    const autoId = useId();
    const textareaId = id ?? props.name ?? `textarea-${autoId}`;
    const ariaLabel = label ? undefined : (props["aria-label"] ?? props.placeholder);

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-slate-700">
            {label}
            {required ? <span className="text-danger-600"> *</span> : null}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          required={required}
          className={cn(
            "flex min-h-24 w-full rounded-xl border bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-500 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:bg-slate-50",
            error ? "border-danger-500" : "border-slate-200",
            className
          )}
          aria-label={ariaLabel}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${textareaId}-error` : helper ? `${textareaId}-helper` : undefined}
          {...props}
        />
        {error ? (
          <p id={`${textareaId}-error`} className="text-sm text-danger-600">
            {error}
          </p>
        ) : helper ? (
          <p id={`${textareaId}-helper`} className="text-sm text-slate-500">
            {helper}
          </p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

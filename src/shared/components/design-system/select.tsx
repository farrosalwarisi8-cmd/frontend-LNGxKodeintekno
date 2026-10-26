"use client";

import { forwardRef, useId, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helper?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helper, id, options, placeholder, ...props }, ref) => {
    const autoId = useId();
    const selectId = id ?? props.name ?? `select-${autoId}`;
    // Nama aksesibel: label terlihat bila ada; selain itu aria-label eksplisit
    // atau placeholder — sehingga tidak ada select tanpa nama (WCAG 4.1.2).
    const ariaLabel = label ? undefined : (props["aria-label"] ?? placeholder);
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-text-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              "flex h-11 w-full appearance-none rounded-xl border bg-card px-3.5 pr-10 text-base text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted",
              error ? "border-danger-500" : "border-input",
              className
            )}
            aria-label={ariaLabel}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? `${selectId}-error` : helper ? `${selectId}-helper` : undefined}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        {error && (
          <p id={`${selectId}-error`} className="text-sm text-danger-600">
            {error}
          </p>
        )}
        {!error && helper && (
          <p id={`${selectId}-helper`} className="text-sm text-muted-foreground">
            {helper}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

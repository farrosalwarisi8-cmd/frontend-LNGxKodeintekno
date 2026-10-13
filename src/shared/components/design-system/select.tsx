"use client";

import { forwardRef, type SelectHTMLAttributes } from "react";
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
    const selectId = id ?? props.name ?? label;
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              "flex h-11 w-full appearance-none rounded-xl border bg-white px-3.5 pr-10 text-base text-slate-900 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:bg-slate-50",
              error ? "border-danger-500" : "border-slate-200",
              className
            )}
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
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        </div>
        {error && (
          <p id={`${selectId}-error`} className="text-sm text-danger-600">
            {error}
          </p>
        )}
        {!error && helper && (
          <p id={`${selectId}-helper`} className="text-sm text-slate-500">
            {helper}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

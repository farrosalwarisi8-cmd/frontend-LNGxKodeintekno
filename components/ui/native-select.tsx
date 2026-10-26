"use client";

import { cn } from "@/lib/utils";

export interface NativeSelectProps {
  id?: string;
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Native <select> element — fully keyboard accessible and compatible with
 * screen readers. Unlike custom dropdowns (Base UI Select), native select:
 * - Responds to ArrowUp/ArrowDown/Enter without custom event handling
 * - Stores value in the DOM (inputValue() works in tests)
 * - Works with keyboard-only navigation out of the box
 */
export function NativeSelect({
  id,
  name,
  value,
  onChange,
  label,
  error,
  options,
  placeholder,
  className,
  disabled,
}: NativeSelectProps) {
  const selectId = id ?? name ?? label;

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-text-secondary">
          {label}
        </label>
      )}
      <select
        id={selectId}
        name={name}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        className={cn(
          "flex h-11 w-full rounded-xl border bg-card px-3.5 text-base text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted",
          error ? "border-danger-500" : "border-input",
          className
        )}
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
      {error && <p className="text-sm text-danger-600">{error}</p>}
    </div>
  );
}

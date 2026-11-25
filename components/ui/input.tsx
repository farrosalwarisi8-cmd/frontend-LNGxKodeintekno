"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  /** Icon rendered inside the input on the left side. Automatically adds left padding. */
  leftIcon?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helper, id, leftIcon, ...props }, ref) => {
    const inputId = id ?? props.name ?? label;

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-text-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground [&>svg]:size-4">
              {leftIcon}
            </span>
          )}
          <InputPrimitive
            ref={ref}
            id={inputId}
            className={cn(
              "flex h-11 w-full rounded-xl border bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted",
              error ? "border-danger-500" : "border-input",
              leftIcon && "pl-10",
              className
            )}
            aria-invalid={error ? true : undefined}
            aria-describedby={
              error
                ? `${inputId}-error`
                : helper
                  ? `${inputId}-helper`
                  : undefined
            }
            {...props}
          />
        </div>
        {error && (
          <p id={`${inputId}-error`} className="text-sm text-danger-600">
            {error}
          </p>
        )}
        {!error && helper && (
          <p id={`${inputId}-helper`} className="text-sm text-muted-foreground">
            {helper}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };

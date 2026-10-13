"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    const variants = {
      primary: "bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-500",
      secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 focus-visible:ring-slate-500",
      outline: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-500",
      ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-500",
      danger: "bg-danger-600 text-white hover:bg-danger-500 focus-visible:ring-danger-500",
    };

    // h-9 (36px) pada tombol kecil supaya tetap nyaman disentuh di mobile.
    const sizes = {
      sm: "h-9 px-3 text-xs",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-6 text-base",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

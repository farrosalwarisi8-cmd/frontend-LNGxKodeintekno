"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl border border-transparent bg-clip-padding font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary-600 text-primary-foreground hover:bg-primary-hover focus-visible:ring-ring",
        outline: "border border-border bg-card text-text-secondary hover:bg-muted focus-visible:ring-ring",
        ghost: "text-text-secondary hover:bg-muted hover:text-foreground focus-visible:ring-ring",
        danger: "bg-danger-600 text-danger-foreground hover:bg-danger-700 focus-visible:ring-danger",
        secondary: "bg-muted text-text-secondary hover:bg-border focus-visible:ring-ring",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "danger" | "secondary";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

function Button({
  className,
  variant = "default",
  size = "md",
  loading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </ButtonPrimitive>
  );
}

Button.displayName = "Button";

export { Button, buttonVariants };

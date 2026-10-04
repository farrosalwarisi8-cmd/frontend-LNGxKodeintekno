"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import type { ConsentStatus, EmploymentStatus } from "@/features/people/api/people.types";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "purple" | "outline";
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variants = {
      default: "bg-slate-100 text-slate-700",
      success: "bg-success-100 text-success-600",
      warning: "bg-warning-100 text-warning-600",
      danger: "bg-danger-100 text-danger-600",
      info: "bg-info-100 text-info-600",
      purple: "bg-purple-100 text-purple-600",
      outline: "border border-slate-200 text-slate-600",
    };

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export function ConsentStatusBadge({ status }: { status: ConsentStatus }) {
  const config: Record<ConsentStatus, { label: string; variant: BadgeProps["variant"] }> = {
    PENDING: { label: "Pending", variant: "warning" },
    APPROVED: { label: "Approved", variant: "success" },
    REJECTED: { label: "Rejected", variant: "danger" },
    EXPIRED: { label: "Expired", variant: "danger" },
    DELIVERY_FAILED: { label: "Delivery Failed", variant: "danger" },
  };
  const { label, variant } = config[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function EmploymentStatusBadge({ status }: { status: EmploymentStatus }) {
  const config: Record<EmploymentStatus, { label: string; variant: BadgeProps["variant"] }> = {
    ACTIVE: { label: "Aktif", variant: "success" },
    INACTIVE: { label: "Nonaktif", variant: "default" },
    ARCHIVED: { label: "Arsip", variant: "outline" },
  };
  const { label, variant } = config[status];
  return <Badge variant={variant}>{label}</Badge>;
}

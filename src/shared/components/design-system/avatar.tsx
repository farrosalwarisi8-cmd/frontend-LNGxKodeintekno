"use client";

import { cn } from "@/lib/utils";

export interface AvatarProps {
  name: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Avatar({ name, className, size = "md" }: AvatarProps) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const sizes = {
    sm: "size-8 text-xs",
    md: "size-10 text-sm",
    lg: "size-12 text-base",
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700",
        sizes[size],
        className
      )}
    >
      {initials}
    </div>
  );
}

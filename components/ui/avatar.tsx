"use client";

import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import { cn } from "cn";

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
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size === "md" ? "default" : size}
      className={cn(
        "flex items-center justify-center rounded-full bg-primary-100 text-primary-700 font-semibold select-none",
        sizes[size],
        className
      )}
    >
      <AvatarPrimitive.Fallback className="size-full">{initials}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

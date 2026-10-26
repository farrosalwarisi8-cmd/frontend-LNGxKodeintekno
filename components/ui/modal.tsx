"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "cn";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
}: ModalProps) {
  const sizes = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onClose} modal>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-foreground/40" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex flex-col -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-card shadow-xl outline-none sm:max-w-[calc(100%-2rem)]",
            sizes[size]
          )}
        >
          <div className="flex items-start justify-between border-b border-border p-6">
            <div>
              {title && <h2 className="text-lg font-semibold text-foreground">{title}</h2>}
              {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            </div>
            <DialogPrimitive.Close
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-text-secondary"
              aria-label="Tutup"
            >
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 max-h-[65vh] overflow-y-auto p-6 pr-2">{children}</div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

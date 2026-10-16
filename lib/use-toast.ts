"use client";

import { toast as sonnerToast } from "sonner";

type ToastOptions = Parameters<typeof sonnerToast>[1];

/**
 * Helper toast seragam untuk seluruh aplikasi.
 * Seluruh notifikasi sukses/gagal lewat satu titik agar bahasa dan gaya konsisten.
 */
export function toast(title: string, options?: ToastOptions & { description?: string }) {
  const { description, ...rest } = options ?? {};
  return sonnerToast(title, { description, ...rest });
}

/** Notifikasi sukses standar. */
export function toastSuccess(title: string, description?: string) {
  return toast(title, { description, icon: "✅" });
}

/** Notifikasi gagal standar. */
export function toastError(title: string, description?: string) {
  return toast(title, { description, icon: "❌" });
}

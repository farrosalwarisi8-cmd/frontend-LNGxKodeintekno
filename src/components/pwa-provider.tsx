"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { startOfflineAutoSync } from "@/lib/offline/sync-engine";
import { isServiceWorkerEnabled } from "@/lib/env";

/**
 * Registrasi service worker + pengaktifan sinkronisasi offline otomatis.
 *
 * Ditempatkan di root layout agar berlaku di seluruh halaman (termasuk halaman
 * login yang di-cache pertama kali), tetapi tidak merender apa pun.
 *
 * SW hanya didaftarkan pada build production. Pada `next dev`, aset dikompilasi
 * ulang terus-menerus sehingga cache service worker justru menyajikan bundel
 * lama; override `NEXT_PUBLIC_ENABLE_SW=true` bila ingin menguji di dev.
 */
export default function PwaProvider() {
  useEffect(() => {
    if (isServiceWorkerEnabled() && "serviceWorker" in navigator) {
      // updateViaCache "none": file sw.js selalu divalidasi ke server.
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {
          // Registrasi gagal (mis. HTTP non-secure) tidak boleh memblokir app.
        });
    }

    const stop = startOfflineAutoSync();

    const onSync = (event: Event) => {
      const detail = (event as CustomEvent<{ synced: number; conflicts: number; failed: number }>)
        .detail;
      if (!detail) return;
      if (detail.synced > 0) {
        toast.success(`${detail.synced} catatan offline tersinkron ke server.`);
      }
      if (detail.conflicts > 0) {
        toast.warning(
          `${detail.conflicts} catatan perlu penyelesaian konflik di halaman Sinkronisasi Offline.`
        );
      }
      if (detail.failed > 0) {
        toast.error(`${detail.failed} catatan offline gagal dikirim. Akan dicoba ulang.`);
      }
    };
    window.addEventListener("kodein:offline-sync", onSync);

    return () => {
      stop();
      window.removeEventListener("kodein:offline-sync", onSync);
    };
  }, []);

  return null;
}

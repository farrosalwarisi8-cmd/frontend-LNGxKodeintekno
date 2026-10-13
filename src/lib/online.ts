/**
 * Helper status online yang aman terhadap hydration.
 *
 * Nilai awal HARUS identik di server dan client (`true`), karena
 * `navigator.onLine` tidak boleh dibaca saat server render. Status
 * sesungguhnya disinkronkan setelah mount lewat event online/offline.
 */
export const INITIAL_ONLINE = true;

/** Transisi state dari event browser. */
export function onlineStateFromEvent(type: "online" | "offline"): boolean {
  return type === "online";
}

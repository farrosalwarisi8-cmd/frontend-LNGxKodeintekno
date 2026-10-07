/**
 * Helper notifikasi murni (diuji unit test) untuk badge & panel notifikasi.
 */

export interface NotifiableNotification {
  id: string;
  userId?: string;
  read: boolean;
  title?: string;
  message?: string;
  createdAt?: string;
  link?: string;
}

/** Jumlah unread untuk user aktif (null user = 0). */
export function unreadCount(
  notifications: NotifiableNotification[],
  userId: string | null | undefined
): number {
  if (!userId) return 0;
  return notifications.filter((n) => n.userId === userId && !n.read).length;
}

/** Notifikasi milik user aktif (panel hanya menampilkan miliknya). */
export function notificationsForUser(
  notifications: NotifiableNotification[],
  userId: string | null | undefined
): NotifiableNotification[] {
  if (!userId) return [];
  return notifications.filter((n) => n.userId === userId);
}

/** Transisi state mark-as-read (immutable) — dipakai update optimis store. */
export function applyMarkRead<T extends NotifiableNotification>(
  notifications: T[],
  id: string
): T[] {
  return notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
}

/** Rollback jika API mark-as-read gagal. */
export function applyMarkUnread<T extends NotifiableNotification>(
  notifications: T[],
  id: string
): T[] {
  return notifications.map((n) => (n.id === id ? { ...n, read: false } : n));
}

/** Format badge: 0 -> null (jangan tampilkan), >99 -> "99+". */
export function formatBadgeCount(count: number): string | null {
  if (count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

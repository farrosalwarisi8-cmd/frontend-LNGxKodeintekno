# Laporan Fase 5 — Frontend Notification, Queue, dan Provider

## Status
- **BLOCKED** untuk end-to-end staging, karena backend staging, akun, provider email/WhatsApp, queue worker, dan endpoint hakikat status nyata tidak tersedia. Namun frontend quality gate lulus dan 2 defect truthfulness/idempotensi frontend telah diperbaiki.

## Scope
- Frontend changed: **YES**
- Backend changed: **NO**
- Database changed: **NO**
- Migration changed: **NO**
- Provider changed: **NO**
- Production data changed: **NO**

## Environment
- Frontend URL: tidak tersedia di environment kerja ini
- Backend URL: tidak tersedia di environment kerja ini
- Build mode: production build dapat dibuat dengan `NEXT_PUBLIC_API_URL` yang valid (lihat laporan Fase 1)
- Frontend commit: working tree setelah commit `0822364`
- Browser/version: Playwright + Chrome tersedia, tetapi skenario provider staging tidak dijalankan
- Viewports: pending diverifikasi staging
- Mock/demo mode: disabled by default pada production

## Baseline vs final
| Check | Baseline | Final |
|---|---|---|
| Typecheck | PASS | PASS |
| Lint | PASS | PASS |
| Unit test | 344 passed / 19 skipped | 344 passed / 19 skipped |
| Production build | PASS | PASS |
| Staging notification E2E | Not run | BLOCKED |

## Frontend defects fixed
1. **Mapping notifikasi memperlakukan `SENT`/`DELIVERED` sebagai `READ`** di `lib/remote-sync.ts` `mapNotification`.
   - Sebelum: status backend `SENT` atau `DELIVERED` otomatis membuat notifikasi dianggap sudah terbaca, sehingga unread count berkurang padahal notifikasi belum dibaca pengguna.
   - Sesudah: `read` hanya `true` bila backend status benar-benar `READ`. Status `QUEUED`, `SENT`, `FAILED`, dan `DELIVERED` tetap unread, sesuai kebutuhan unread notification dan delivery status.
2. **Idempotensi request mark-as-read di `components/notification-bell.tsx`.**
   - `handleMarkRead` sekarang mengabaikan notifikasi yang sudah read dan mengabaikan request duplikat ketika mark id yang sama sedang in-flight.
   - `handleMarkAllRead` sekarang memblokir run overlapping (double submit) dan tetap rollback state bila request gagal.

## Truthfulness/status policy
- Frontend **tidak** menampilkan status `SUCCESS`/`SENT` hanya karena request API berhasil dibuat. Setelah fix, status visual unread/read mengikuti backend status `READ`.
- Queue (VISIT module) memetakan `ticket.status` backend langsung melalui `QUEUE_STATUS_MAP`; tidak ada override frontend dari request success.
- Reporting/notification delivery status tetap berasal dari response backend; frontend hanya melakukan optimistic update pada "mark read" dan rollback bila request gagal.

## Test coverage matrix
| Area | Status | Catatan |
|---|---|---|
| Unread notification | PASS (unit) | `unreadCount` dan `notificationsForUser` lulus |
| Mark as read | PASS (UI implementasi) | Optimistic update + rollback + idempotensi request in-flight |
| Mark all as read | PASS (UI implementasi) | Rollback penuh bila salah satu request gagal; guard double submit |
| Delivery status | BLOCKED | Backend status nyata tidak tersedia; frontend tidak menyimpulkan SENT = success |
| Queue status | PARTIAL (mapping) | Status diambil dari backend `WAITING/CALLED/IN_SERVICE/COMPLETED/CANCELLED` |
| Retry | PASS (UI) | Retry refetch notification tersedia pada state `error` |
| Failed state | PASS (mapping) | Pesan error netral dari `mapApiError`, tidak menampilkan stack trace |
| Email sandbox/staging | BLOCKED | Provider & credential tidak tersedia di phase ini |
| WhatsApp sandbox/staging | BLOCKED | Provider & credential tidak tersedia di phase ini |
| Provider timeout | PARTIAL (error path) | `api-client` melempar error network yang dipetakan menjadi pesan pengguna; belum diverifikasi E2E |
| Idempotency | IMPROVED | Duplicate mark-as-read in-flight diblokir di frontend; backend idempotency tetap tanggung jawab backend |

## Backend/infrastructure blockers
- `BACKEND/INFRASTRUCTURE BLOCKER — di luar scope frontend-only`: Backend staging HTTPS, URL frontend staging, akun test, CORS/domain policy, provider email/WhatsApp, queue worker, dan data staging tidak tersedia.
- Tidak dilakukan perubahan backend, queue, provider, database, migration, endpoint, atau data production.

## Known limitations
- Pengujian delivery status/provider khusus tidak dapat dilakukan tanpa sandbox/staging provider nyata.
- `BackendNotification.status` baru dipakai untuk menentukan read/unread, belum ada UI/admin yang menampilkan status delivery (`QUEUED`, `FAILED`) per kanal.
- `markAsRead` tetap optimistic; rollback dilakukan pada error, tetapi konfirmasi akhir sepenuhnya ada di backend.

## Next phase readiness
- Frontend siap dari sisi logika notifikasi dan queue mapping, tetapi E2E Phase 5 belum dapat dibuktikan karena dependency backend/provider.
- **NOT READY** untuk dinyatakan PASS end-to-end sampai backend/provider/container staging nyata tersedia.

## Final decision
- **BLOCKED** (external dependency: backend/provider staging tidak tersedia)
- Frontend changes selesai dan tervalidasi dengan typecheck, lint, dan unit test.

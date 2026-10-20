"use client";

/**
 * Panel daftar order laboratorium — Fase A2 (Tugas 1).
 *
 * - Pencarian, filter (status, jenis tes, tanggal), urutan, pagination.
 * - State lengkap: loading (skeleton), kosong (empty state), error
 *   (tombol coba lagi), dan offline.
 * - Filter site TIDAK ditampilkan: kontrak GET /diagnostic/lab-orders tidak
 *   mengembalikan field site (scoping dilakukan server) → lihat BLOCKER di
 *   LAPORAN_A2_LAB_RADIOLOGI.md. Tidak ada filter yang dipalsukan.
 * - Setiap baris menampilkan tautan kunjungan/MCU hanya menurut permission
 *   (lihat ContextLinks).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, FlaskConical, Inbox, Search } from "lucide-react";
import { Card } from "@/shared/components/design-system/card";
import { Input } from "@/shared/components/design-system/input";
import { Button } from "@/shared/components/design-system/button";
import { EmptyState } from "@/shared/components/design-system/empty-state";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { NativeSelect } from "@/components/ui/native-select";
import { useCurrentUser } from "@/lib/store";
import { formatDateTime } from "@/lib/format";
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_FILTERS,
  filterLabOrders,
  paginate,
  sortLabOrders,
  testTypeOptions,
  type LabOrderFilters,
  type SortDirection,
} from "@/features/lab/order-utils";
import {
  LAB_ORDER_STATUS_FILTERS,
  labItemStatusInfo,
  labOrderStatusInfo,
} from "@/features/lab/status-map";
import { LabStatusBadge } from "@/features/lab/components/lab-status-badge";
import { ContextLinks } from "@/features/lab/components/context-links";
import type { AsyncState, LabWorkspace } from "@/features/lab/api";

export function LabOrdersPanel({ state }: { state: AsyncState<LabWorkspace> }) {
  const user = useCurrentUser();
  const [filters, setFilters] = useState<LabOrderFilters>(EMPTY_FILTERS);
  const [direction, setDirection] = useState<SortDirection>("newest");
  const [page, setPage] = useState(1);

  const orders = useMemo(() => state.data?.orders ?? [], [state.data]);
  const results = useMemo(() => state.data?.results ?? [], [state.data]);

  const typeOptions = useMemo(() => testTypeOptions(orders), [orders]);

  const filtered = useMemo(
    () => sortLabOrders(filterLabOrders(orders, filters), direction),
    [orders, filters, direction]
  );
  const { items: pageItems, totalPages, total } = paginate(filtered, page, DEFAULT_PAGE_SIZE);

  const patch = (next: Partial<LabOrderFilters>) => {
    setFilters((f) => ({ ...f, ...next }));
    setPage(1);
  };

  const verifiedItemIds = useMemo(
    () => new Set(results.filter((r) => r.verified_at).map((r) => r.lab_order_item_id)),
    [results]
  );

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />
            <Input
              label="Cari order lab"
              placeholder="Cari ID order, kode, atau nama tes..."
              value={filters.search}
              onChange={(e) => patch({ search: e.target.value })}
              className="pl-10"
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:items-end">
            <NativeSelect
              label="Status"
              value={filters.status}
              onChange={(v) => patch({ status: v })}
              options={[
                { value: "", label: "Semua status" },
                ...LAB_ORDER_STATUS_FILTERS.map((s) => ({ value: s.value, label: s.label })),
              ]}
              className="lg:w-48"
            />
            <NativeSelect
              label="Jenis tes"
              value={filters.testType}
              onChange={(v) => patch({ testType: v })}
              options={[
                { value: "", label: "Semua jenis tes" },
                ...typeOptions,
              ]}
              className="lg:w-56"
            />
            <NativeSelect
              label="Urutan"
              value={direction}
              onChange={(v) => {
                setDirection(v as SortDirection);
                setPage(1);
              }}
              options={[
                { value: "newest", label: "Terbaru" },
                { value: "oldest", label: "Terlama" },
              ]}
              className="lg:w-40"
            />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:max-w-md">
          <Input
            label="Tanggal order dari"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => patch({ dateFrom: e.target.value })}
          />
          <Input
            label="Tanggal order sampai"
            type="date"
            value={filters.dateTo}
            onChange={(e) => patch({ dateTo: e.target.value })}
          />
        </div>
      </Card>

      <p className="text-sm text-slate-500" role="status">
        {total} order ditemukan
        {state.offline ? " · Anda offline — data terakhir yang tampil" : ""}
      </p>

      {state.error && (
        <ErrorState
          title={state.offline ? "Anda sedang offline" : "Gagal memuat daftar order lab"}
          message={state.error}
          onRetry={state.reload}
        />
      )}

      {state.loading && !state.error && (
        <div className="space-y-2" aria-busy="true" aria-label="Memuat daftar order lab">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {!state.loading && !state.error && total === 0 && (
        <EmptyState
          icon={FlaskConical}
          title="Tidak ada order lab ditemukan"
          description={
            orders.length === 0
              ? "Belum ada order laboratorium pada scope Anda."
              : "Coba ubah kata kunci atau filter pencarian Anda."
          }
        />
      )}

      {!state.loading && !state.error && total > 0 && (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white lg:block">
            <table className="w-full">
              <caption className="sr-only">Daftar order laboratorium</caption>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Order</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Waktu order</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Jenis tes</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Konteks</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Detail</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((order) => {
                  const status = labOrderStatusInfo(order.status);
                  const testNames = (order.order_items ?? [])
                    .map((i) => i.test_type?.name ?? i.lab_test_type_id)
                    .join(", ");
                  const doneCount = (order.order_items ?? []).filter((i) =>
                    verifiedItemIds.has(i.id)
                  ).length;
                  return (
                    <tr key={order.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-sm font-medium text-slate-900">
                        {order.id}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {formatDateTime(order.ordered_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        <div className="max-w-56 truncate" title={testNames}>
                          {testNames || "—"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {(order.order_items ?? []).map((i) => labItemStatusInfo(i.status).label).join(" · ")}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <LabStatusBadge info={status} />
                        {doneCount > 0 && (
                          <div className="mt-1 text-xs text-slate-500">
                            {doneCount}/{order.order_items?.length} hasil terverifikasi
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ContextLinks
                          role={user?.role ?? null}
                          encounterId={order.encounter_id}
                          mcuCycleId={order.mcu_cycle_id}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/lab/${encodeURIComponent(order.id)}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-primary-600 hover:bg-primary-50"
                          aria-label={`Buka detail order ${order.id}`}
                        >
                          Detail
                          <ChevronRight className="size-4" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 lg:hidden">
            {pageItems.map((order) => {
              const testNames = (order.order_items ?? [])
                .map((i) => i.test_type?.name ?? i.lab_test_type_id)
                .join(", ");
              return (
                <Card key={order.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-sm font-medium text-slate-900">
                        {order.id}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatDateTime(order.ordered_at)}
                      </div>
                      <div className="mt-1 truncate text-sm text-slate-600">{testNames || "—"}</div>
                      <div className="mt-2">
                        <LabStatusBadge info={labOrderStatusInfo(order.status)} />
                      </div>
                    </div>
                    <Link
                      href={`/lab/${encodeURIComponent(order.id)}`}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-primary-600 hover:bg-primary-50"
                      aria-label={`Buka detail order ${order.id}`}
                    >
                      Detail
                      <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                    </Link>
                  </div>
                  <div className="mt-3 border-t border-slate-100 pt-2 text-sm">
                    <ContextLinks
                      role={user?.role ?? null}
                      encounterId={order.encounter_id}
                      mcuCycleId={order.mcu_cycle_id}
                    />
                  </div>
                </Card>
              );
            })}
          </div>

          <nav aria-label="Halaman daftar order lab" className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Sebelumnya
            </Button>
            <span className="text-sm text-slate-600" role="status">
              Halaman {page} dari {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Berikutnya
            </Button>
          </nav>
        </>
      )}

      {!state.loading && !state.error && total > 0 && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Inbox className="size-4" aria-hidden="true" />
          <span>
            Sumber: GET /diagnostic/lab-orders (tanpa parameter query — filter diterapkan di
            klien).
          </span>
        </div>
      )}
    </div>
  );
}

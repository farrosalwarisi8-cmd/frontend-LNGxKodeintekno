"use client";

/**
 * Detail order laboratorium — Fase A2 (Tugas 1, 2, 3, 5, 6).
 *
 * Dilindungi tiga lapis: menu (permission nav), route (RouteGuard →
 * input-lab-result), dan aksi (Can action per tombol).
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { Card } from "@/shared/components/design-system/card";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { formatDateTime } from "@/lib/format";
import { useLabWorkspace, useLabOrder, resultsForOrder } from "@/features/lab/api";
import {
  labItemStatusInfo,
  labOrderStatusInfo,
} from "@/features/lab/status-map";
import { LabStatusBadge } from "@/features/lab/components/lab-status-badge";
import { ContextLinks } from "@/features/lab/components/context-links";
import { ReceiveSampleAction } from "@/features/lab/components/receive-sample-action";
import { ResultEntryForm } from "@/features/lab/components/result-entry-form";
import { VerifyPanel } from "@/features/lab/components/verify-panel";
import { useCurrentUser } from "@/lib/store";

export default function LabOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = decodeURIComponent(params.orderId ?? "");
  const user = useCurrentUser();

  const orderState = useLabOrder(orderId || null);
  const workspace = useLabWorkspace();

  const order = orderState.data;
  const results =
    workspace.data && order ? resultsForOrder(workspace.data.results, order) : [];

  if (orderState.loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Memuat detail order lab">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (orderState.error || !order) {
    return (
      <ErrorState
        title="Gagal memuat detail order lab"
        message={orderState.error ?? "Order tidak ditemukan pada scope Anda."}
        onRetry={orderState.reload}
      />
    );
  }

  const reloadAll = () => {
    orderState.reload();
    workspace.reload();
  };

  const pendingItems = (order.order_items ?? []).filter(
    (i) => !results.some((r) => r.lab_order_item_id === i.id)
  );
  const status = labOrderStatusInfo(order.status);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/lab"
            className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="Kembali ke daftar order lab"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Detail order lab</h1>
            <p className="font-mono text-sm text-slate-500">{order.id}</p>
          </div>
        </div>
        <LabStatusBadge info={status} />
      </div>

      <Card className="space-y-3 p-4">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Waktu order</dt>
            <dd className="font-medium text-slate-800">{formatDateTime(order.ordered_at)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Pemesan</dt>
            <dd className="font-mono text-slate-800">{order.ordered_by ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Jumlah item</dt>
            <dd className="font-medium text-slate-800">
              {order.order_items?.length ?? 0} pemeriksaan
            </dd>
          </div>
        </dl>

        <div className="border-t border-slate-100 pt-3">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
            Konteks tertaut (dari data API)
          </p>
          <ContextLinks
            role={user?.role ?? null}
            encounterId={order.encounter_id}
            mcuCycleId={order.mcu_cycle_id}
          />
        </div>

        <div className="border-t border-slate-100 pt-3">
          <ReceiveSampleAction
            disabledByFlow={order.status === "CANCELLED" || order.status === "COMPLETED"}
          />
        </div>
      </Card>

      <section aria-labelledby="items-heading" className="space-y-3">
        <h2 id="items-heading" className="text-base font-semibold text-slate-900">
          Item pemeriksaan
        </h2>
        {(order.order_items ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">Order ini tidak memiliki item.</p>
        ) : (
          <ul className="space-y-2">
            {(order.order_items ?? []).map((item) => {
              const result = results.find((r) => r.lab_order_item_id === item.id);
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      <FlaskConical className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                      {item.test_type?.name ?? item.lab_test_type_id}
                    </div>
                    <div className="text-xs text-slate-500">
                      {item.test_type?.code ? `${item.test_type.code} · ` : ""}
                      {item.test_type?.specimen_type ?? "Spesimen tidak disebutkan"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <LabStatusBadge info={labItemStatusInfo(item.status)} />
                    {result?.verified_at && <LabStatusBadge info={labItemStatusInfo("COMPLETED")} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {pendingItems.length > 0 && (
        <section aria-labelledby="input-heading" className="space-y-3">
          <h2 id="input-heading" className="text-base font-semibold text-slate-900">
            Input hasil manual
          </h2>
          <Card className="p-4">
            <ResultEntryForm order={order} results={results} onSubmitted={reloadAll} />
          </Card>
        </section>
      )}

      <section aria-labelledby="verify-heading" className="space-y-3">
        <h2 id="verify-heading" className="text-base font-semibold text-slate-900">
          Verifikasi analis
        </h2>
        <VerifyPanel order={order} results={results} onVerified={reloadAll} />
      </section>

      {workspace.error && (
        <ErrorState
          title="Sebagian data hasil gagal dimuat"
          message={workspace.error}
          onRetry={workspace.reload}
        />
      )}
    </div>
  );
}

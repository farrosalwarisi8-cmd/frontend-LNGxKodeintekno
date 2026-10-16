"use client";

import { Can } from "@/components/can";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, UserRound, ChevronRight, Plus, Info } from "lucide-react";
import type { ListPeopleParams } from "../api/people.types";
import { usePeople } from "../hooks/use-people";
import { useDebounce } from "@/shared/utils/use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { PeopleListSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { formatRelativeTime } from "@/shared/utils/date";
import { maskEmail } from "@/shared/utils/masking";

/**
 * Catatan kontrak API (jangan dihilangkan tanpa mengubah backend):
 * `GET /api/v1/patients` hanya menerima `page`, `limit`, dan `search`.
 * Tidak ada parameter filter site/unit/organisasi/status/consent, dan endpoint
 * ini juga tidak mengembalikan status employment maupun status consent.
 * Karena itu filter bawaan fixture DULU dihapus: filter yang tidak diteruskan
 * ke backend hanya menyesatkan (hasil tetap sama) dan kolom status menampilkan
 * nilai karangan frontend.
 */
export function PeopleList() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);

  const params: ListPeopleParams = {
    search: debouncedSearch || undefined,
    page,
    pageSize: 10,
  };

  const { data, loading, error, refetch } = usePeople(params);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Registrasi &amp; Consent</h1>
          <p className="text-sm text-slate-500">
            MPI Modul 01 — pendaftaran pekerja, MRN, dan consent digital
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Butuh direktori pekerja dari backend?{" "}
            <Link href="/employees" className="font-medium text-primary-600 hover:underline">
              Buka Direktori Pekerja
            </Link>
          </p>
        </div>
        <Can action="people.create">
          <Link href="/people/new">
            <Button>
              <Plus className="size-4" />
              Tambah pekerja
            </Button>
          </Link>
        </Can>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Cari nama, MRN, atau Employee ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10"
              aria-label="Cari pekerja"
            />
          </div>
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-slate-500" role="status">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Filter site/unit/status/consent belum tersedia: API daftar pekerja saat ini hanya mendukung
            pencarian. Gunakan kolom pencarian (nama, MRN, atau Employee ID).
          </span>
        </p>
      </Card>

      {loading ? (
        <PeopleListSkeleton />
      ) : error ? (
        <ErrorState onRetry={refetch} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="Tidak ada pekerja ditemukan"
          description={
            debouncedSearch
              ? "Coba ubah kata kunci pencarian Anda (nama, MRN, atau Employee ID)."
              : "Mulai dengan menambahkan pekerja pertama."
          }
          action={
            <Can action="people.create">
              <Link href="/people/new">
                <Button variant="outline" size="sm">
                  <Plus className="size-3.5" />
                  Tambah pekerja
                </Button>
              </Link>
            </Can>
          }
        />
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {data.total} pekerja · Diperbarui {formatRelativeTime(data.data[0]?.updatedAt)}
          </p>

          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Nama</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">MRN</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Employee ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Site</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((person) => (
                  <tr
                    key={person.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`Buka profil ${person.fullName}`}
                    className="cursor-pointer transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                    onClick={() => router.push(`/people/${person.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/people/${person.id}`);
                      }
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{person.fullName}</div>
                      <div className="text-xs text-slate-500">{maskEmail(person.emailMasked)}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-slate-600">{person.mrn}</td>
                    <td className="px-4 py-3 font-mono text-sm text-slate-600">{person.employeeNo}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{person.siteName}</td>
                    <td className="px-4 py-3">
                      <ChevronRight className="size-4 text-slate-500" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 lg:hidden">
            {data.data.map((person) => (
              <Link key={person.id} href={`/people/${person.id}`}>
                <Card className="flex items-center gap-3 p-4 transition-colors hover:border-primary-200 hover:bg-primary-50/30">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                    {person.fullName.split(/\s+/).map((p) => p[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900">{person.fullName}</div>
                    <div className="text-xs text-slate-500">
                      {person.mrn} · {person.employeeNo}
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-slate-500" />
                </Card>
              </Link>
            ))}
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Sebelumnya
              </Button>
              <span className="text-sm text-slate-500">
                Halaman {data.page} dari {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Berikutnya
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

"use client";

/**
 * API Key (klien interoperabilitas) — endpoint backend Domain 10:
 *   POST /api/v1/admin/api-clients   (SYSTEM_ADMIN)
 *
 * Backend menyimpan HANYA hash SHA-256 kunci dan mengembalikan kunci mentah
 * SEKALI pada saat pembuatan. Karena itu halaman ini:
 *   - menampilkan kunci sekali dengan peringatan "salin sekarang",
 *   - tidak menyediakan daftar kunci (backend tidak mengekspos endpoint list),
 *   - menuntut scope minimal agar klien tidak dibuat tanpa hak akses.
 */

import { Can } from "@/components/can";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Modal } from "@/shared/components/design-system/modal";
import { EmptyState } from "@/shared/components/design-system/empty-state";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { formatDate } from "@/lib/format";
import {
  integrationService,
  type CreateApiClientResult,
} from "@/lib/services/integration.service";
import { masterDataService } from "@/lib/services/master-data.service";
import {
  KeyRound,
  Plus,
  Copy,
  Check,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";

/** Scope yang bisa diberikan klien interoperabilitas. */
const AVAILABLE_SCOPES = ["mcu_status:read", "turnstile:verify", "hris:sync"];

const EMPTY_FORM = {
  organizationId: "",
  clientName: "",
  allowedNetwork: "",
  rateLimitPerMinute: "300",
  scopes: [] as string[],
};

/** Catatan klien yang dibuat pada sesi ini (tidak ada endpoint list di backend). */
interface CreatedClientNote {
  clientId: string;
  clientName: string;
  createdAt: string;
}

export default function ApiKeysPage() {
  const [organizations, setOrganizations] = useState<
    Array<{ id: string; name: string; code: string }>
  >([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [orgError, setOrgError] = useState<string | null>(null);

  const [created, setCreated] = useState<CreatedClientNote[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Kunci mentah — ditampilkan sekali, lalu hilang dari state.
  const [revealedKey, setRevealedKey] = useState<CreateApiClientResult | null>(null);
  const [copied, setCopied] = useState(false);

  const loadOrganizations = useCallback(async () => {
    setLoadingOrgs(true);
    setOrgError(null);
    try {
      const orgs = await masterDataService.listOrganizations();
      setOrganizations(orgs.map((o) => ({ id: o.id, name: o.name, code: o.code })));
    } catch (e) {
      setOrgError(e instanceof Error ? e.message : "Gagal memuat daftar organisasi.");
    } finally {
      setLoadingOrgs(false);
    }
  }, []);

  useEffect(() => {
    // Defer agar setState tidak dipanggil sinkron di dalam effect
    // (react-hooks/set-state-in-effect), konsisten dengan halaman lain.
    const timer = setTimeout(() => void loadOrganizations(), 0);
    return () => clearTimeout(timer);
  }, [loadOrganizations]);

  const toggleScope = (scope: string) => {
    setFormData((f) => ({
      ...f,
      scopes: f.scopes.includes(scope)
        ? f.scopes.filter((s) => s !== scope)
        : [...f.scopes, scope],
    }));
  };

  const handleSubmit = async () => {
    setActionError(null);
    if (!formData.organizationId.trim()) {
      setActionError("Organisasi wajib dipilih.");
      return;
    }
    if (!formData.clientName.trim()) {
      setActionError("Nama klien wajib diisi.");
      return;
    }
    if (formData.scopes.length === 0) {
      setActionError("Pilih minimal satu scope agar klien tidak dibuat tanpa hak akses.");
      return;
    }
    const rate = Number(formData.rateLimitPerMinute);
    setSaving(true);
    try {
      const result = await integrationService.createApiClient({
        organizationId: formData.organizationId.trim(),
        clientName: formData.clientName.trim(),
        allowedNetwork: formData.allowedNetwork.trim() || undefined,
        rateLimitPerMinute: Number.isFinite(rate) && rate > 0 ? rate : undefined,
        scopes: formData.scopes,
      });
      setRevealedKey(result);
      setCopied(false);
      setCreated((prev) => [
        {
          clientId: result.clientId,
          clientName: result.clientName,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setShowModal(false);
      setFormData({ ...EMPTY_FORM });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal membuat API client.");
    } finally {
      setSaving(false);
    }
  };

  const copyKey = async () => {
    if (!revealedKey) return;
    try {
      await navigator.clipboard.writeText(revealedKey.apiKey);
      setCopied(true);
    } catch {
      // Clipboard diblokir (izin browser) — pengguna tetap bisa pilih manual.
      setCopied(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">API Key</h1>
          <p className="text-sm text-muted-foreground">
            Kunci akses untuk sistem eksternal (turnstile, HRIS) — hanya untuk
            System Administrator
          </p>
        </div>
        <Can action="api-keys.manage">
          <Button
            onClick={() => {
              setActionError(null);
              setShowModal(true);
            }}
          >
            <Plus className="size-4" />
            Buat API Client
          </Button>
        </Can>
      </div>

      {/* Kunci mentah: tampil sekali, lalu tidak dapat diambil lagi */}
      {revealedKey && (
        <Card className="border-warning-300 bg-warning-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-600" />
            <div className="min-w-0 flex-1 space-y-2">
              <h2 className="text-sm font-semibold text-foreground">
                Salin kunci sekarang — tidak akan ditampilkan lagi
              </h2>
              <p className="text-xs text-muted-foreground">
                Backend hanya menyimpan hash SHA-256 kunci. Setelah halaman ini
                ditutup atau dimuat ulang, kunci untuk{" "}
                <span className="font-medium">{revealedKey.clientName}</span> tidak
                dapat dilihat kembali.
              </p>
              <div className="flex items-center gap-2">
                <code
                  className="min-w-0 flex-1 truncate rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs"
                  data-testid="revealed-api-key"
                >
                  {revealedKey.apiKey}
                </code>
                <Button variant="outline" onClick={copyKey}>
                  {copied ? (
                    <Check className="size-4 text-success-600" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {copied ? "Tersalin" : "Salin"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Catatan klien yang dibuat di sesi ini */}
      <Card className="p-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">
            Klien yang dibuat pada sesi ini
          </h2>
          <p className="text-xs text-muted-foreground">
            Backend tidak menyediakan endpoint daftar API client, sehingga riwayat
            lengkap hanya tersedia di audit log.
          </p>
        </div>
        {created.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="Belum ada klien dibuat"
              description="Buat API client untuk memberi akses sistem eksternal."
              icon={KeyRound}
            />
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {created.map((c) => (
              <li
                key={c.clientId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{c.clientName}</p>
                  <p className="font-mono text-xs text-muted-foreground">{c.clientId}</p>
                </div>
                <Badge variant="success">Aktif</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Scope yang tersedia */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-4 text-muted-foreground" />
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Scope yang tersedia</h3>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_SCOPES.map((scope) => (
                <Badge key={scope} variant="default">
                  {scope}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Konsumen <code className="font-mono">GET /mcu-status/</code> wajib
              mengirim header <code className="font-mono">X-API-Key</code> dan
              hanya menerima 15 field status kelayakan kerja — tanpa diagnosis,
              SOAP, obat, atau hasil lab.
            </p>
          </div>
        </div>
      </Card>

      {showModal && (
        <Modal open onClose={() => setShowModal(false)} title="Buat API Client">
          <div className="space-y-3">
            {loadingOrgs && <Skeleton className="h-10 w-full" />}
            {!loadingOrgs && orgError && (
              <ErrorState
                title="Gagal memuat organisasi"
                message={orgError}
                onRetry={loadOrganizations}
              />
            )}
            {!loadingOrgs && !orgError && (
              <>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-foreground">
                    Organisasi
                  </span>
                  <select
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                    value={formData.organizationId}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, organizationId: e.target.value }))
                    }
                  >
                    <option value="">Pilih organisasi…</option>
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} ({o.code})
                      </option>
                    ))}
                  </select>
                </label>
                <Input
                  label="Nama Klien"
                  value={formData.clientName}
                  onChange={(e) => setFormData((f) => ({ ...f, clientName: e.target.value }))}
                  placeholder="Turnstile Access Control - Bontang Plant"
                />
                <Input
                  label="Whitelist Jaringan (CIDR)"
                  value={formData.allowedNetwork}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, allowedNetwork: e.target.value }))
                  }
                  placeholder="192.168.1.0/24"
                />
                <Input
                  label="Batas Request / Menit"
                  type="number"
                  value={formData.rateLimitPerMinute}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, rateLimitPerMinute: e.target.value }))
                  }
                />
                <div>
                  <span className="mb-1 block text-sm font-medium text-foreground">
                    Scope (minimal satu)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_SCOPES.map((scope) => {
                      const active = formData.scopes.includes(scope);
                      return (
                        <button
                          key={scope}
                          type="button"
                          onClick={() => toggleScope(scope)}
                          className={
                            active
                              ? "rounded-full border border-primary-600 bg-primary-soft px-3 py-1 text-xs font-medium text-primary-700"
                              : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                          }
                        >
                          {scope}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
            {actionError && <p className="text-xs text-danger-600">{actionError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowModal(false)}>
                Batal
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? "Menyimpan..." : "Buat Kunci"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <p className="text-xs text-muted-foreground">
        Terakhir diperbarui {formatDate(new Date().toISOString())}
      </p>
    </div>
  );
}

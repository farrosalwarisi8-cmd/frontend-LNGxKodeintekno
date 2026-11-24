import { beforeEach, describe, expect, it } from "vitest";
import {
  envelope,
  installBrowserStubs,
  mockFetch,
  pathOf,
} from "./helpers";

/**
 * Kontrak TTE frontend → backend, dibuktikan dari OpenAPI snapshot Fase 6 dan
 * live wiring report. Mock HANYA di level fetch (bukan bukti provider nyata).
 */
describe("document.service — kontrak TTE", () => {
  beforeEach(() => {
    installBrowserStubs();
    localStorage.clear();
  });

  it("POST /documents/render-pdf mengirim tiga field yang terbukti", async () => {
    const calls = mockFetch(() => ({
      body: envelope({
        documentId: "doc-1",
        title: "Sertifikat FTW",
        objectKey: "docs/doc-1.pdf",
        verificationUrl: "https://api.example.com/api/v1/public/verify/token123",
      }),
    }));
    const { documentService } = await import("@/lib/services/document.service");
    await documentService.renderPdf("FTW_CERTIFICATE", "mcu-1", "Sertifikat FTW");

    expect(pathOf(calls[0].url)).toBe("/api/v1/documents/render-pdf");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body).toEqual({
      documentType: "FTW_CERTIFICATE",
      referenceId: "mcu-1",
      title: "Sertifikat FTW",
    });
  });

  it("POST /signatures/request — path dan body sesuai RequestSignatureDto", async () => {
    const calls = mockFetch(() => ({ body: envelope({ id: "sig-1", status: "PENDING" }) }));
    const { documentService } = await import("@/lib/services/document.service");
    await documentService.requestSignature("doc-1", "CERTIFIED_PSRE", "PRIVY");

    expect(pathOf(calls[0].url)).toBe("/api/v1/signatures/request");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body).toEqual({
      documentId: "doc-1",
      signatureType: "CERTIFIED_PSRE",
      providerCode: "PRIVY",
    });
    const raw = JSON.stringify(calls[0].body ?? {});
    expect(raw).not.toMatch(/PSP_|requestId|accountId|callbackUrl|signerEmail|signerName|apiKey|secret/i);
  });

  it("menolak enum signatureType buatan dan dokumen kosong sebelum request", async () => {
    const calls = mockFetch(() => ({ body: envelope({ id: "sig-1" }) }));
    const { documentService } = await import("@/lib/services/document.service");

    await expect(documentService.requestSignature("doc-1", "DIGITAL")).rejects.toThrow(/Jenis tanda tangan/);
    await expect(documentService.requestSignature("", "CERTIFIED_PSRE")).rejects.toThrow(/Dokumen/);
    expect(calls).toHaveLength(0);
  });

  it("TIDAK memanggil GET /signatures — status berasal dari signature_reqs pada /documents", async () => {
    const calls = mockFetch(() => ({
      body: envelope([
        {
          id: "doc-1",
          title: "Dokumen A",
          signature_reqs: [
            { id: "sig-1", status: "PROCESSING", signature_type: "CERTIFIED_PSRE", provider_code: "PRIVY" },
          ],
        },
      ]),
    }));
    const { documentService } = await import("@/lib/services/document.service");
    const res = await documentService.getSignatures({ page: 1, limit: 100 });

    expect(calls).toHaveLength(1);
    expect(pathOf(calls[0].url)).toBe("/api/v1/documents?page=1&limit=100");
    expect(res.data[0]).toMatchObject({
      id: "sig-1",
      document_id: "doc-1",
      status: "PROCESSING",
      provider_code: "PRIVY",
    });
    expect(calls.some((c) => pathOf(c.url).startsWith("/api/v1/signatures"))).toBe(false);
  });

  it("retry membuat request BARU untuk dokumen yang sama (bukan endpoint retry)", async () => {
    const calls = mockFetch((req) => {
      if (req.method === "GET") {
        return {
          body: envelope([
            { id: "doc-1", signature_reqs: [{ id: "sig-old", status: "FAILED", signature_type: "CERTIFIED_PSRE", provider_code: "PRIVY" }] },
          ]),
        };
      }
      return { body: envelope({ id: "sig-new", status: "PENDING" }) };
    });
    const { documentService } = await import("@/lib/services/document.service");
    const result = await documentService.retrySignature("sig-old");

    expect(result.id).toBe("sig-new");
    expect(pathOf(calls[0].url)).toBe("/api/v1/documents?page=1&limit=100");
    expect(pathOf(calls[1].url)).toBe("/api/v1/signatures/request");
    expect(calls[1].body).toMatchObject({ documentId: "doc-1", signatureType: "CERTIFIED_PSRE", providerCode: "PRIVY" });
    expect(calls.some((c) => /\/signatures\/[^/]+\/retry/.test(pathOf(c.url)))).toBe(false);
  });

  it("download melalui satu jalur backend dan menolak URL tidak aman", async () => {
    const calls = mockFetch(() => ({
      body: envelope({ url: "https://storage.example.com/signed.pdf?token=abc", expiresIn: 3600 }),
    }));
    const { documentService } = await import("@/lib/services/document.service");
    const result = await documentService.downloadDocument("doc-1", "Sertifikat FTW");

    expect(pathOf(calls[0].url)).toBe("/api/v1/documents/doc-1/download");
    expect(result.source).toBe("backend");
    expect(result.url).toContain("https://storage.example.com/signed.pdf");
    expect(result.filename).toMatch(/^sertifikat-ftw-doc-1\.pdf$/);
  });

  it("download gagal bila backend mengembalikan URL berbahaya", async () => {
    mockFetch(() => ({ body: envelope({ url: "javascript:alert(1)" }) }));
    const { documentService } = await import("@/lib/services/document.service");
    await expect(documentService.downloadDocument("doc-1")).rejects.toThrow(/tidak aman/);
  });

  it("verify publik memakai path token dan tidak mengarang field klinis", async () => {
    const calls = mockFetch(() => ({
      body: envelope({ isValid: false, status: "NOT_SIGNED", documentNumber: "doc-1" }),
    }));
    const { documentService } = await import("@/lib/services/document.service");
    const res = await documentService.verifyPublic("token123");

    expect(pathOf(calls[0].url)).toBe("/api/v1/public/verify/token123");
    expect(res.status).toBe("NOT_SIGNED");
    expect(JSON.stringify(res)).not.toMatch(/diagnos|soap|medication/i);
  });

  it("verify publik meng-encode token agar tidak mengubah path/query API", async () => {
    const calls = mockFetch(() => ({ body: envelope({ isValid: false, status: "INVALID" }) }));
    const { documentService } = await import("@/lib/services/document.service");
    await documentService.verifyPublic("abc/def?x=1#frag");

    expect(pathOf(calls[0].url)).toBe("/api/v1/public/verify/abc%2Fdef%3Fx%3D1%23frag");
    expect(calls[0].url).not.toContain("#");
  });

  it("verify publik menolak token kosong tanpa memanggil backend", async () => {
    const calls = mockFetch(() => ({ body: envelope({ isValid: false }) }));
    const { documentService } = await import("@/lib/services/document.service");
    await expect(documentService.verifyPublic("   ")).rejects.toThrow(/Token verifikasi/);
    expect(calls).toHaveLength(0);
  });

  it("status signature kosong TIDAK diisi PENDING (fallback UI harus 'tidak dikenali')", async () => {
    mockFetch(() => ({
      body: envelope([
        { id: "doc-1", signature_reqs: [{ id: "sig-1", signature_type: "CERTIFIED_PSRE" }] },
      ]),
    }));
    const { documentService } = await import("@/lib/services/document.service");
    const res = await documentService.getSignatures();
    expect(res.data[0].status).toBe("");
  });

  it("retry menolak jenis tanda tangan yang tidak diketahui tanpa POST", async () => {
    const calls = mockFetch(() => ({
      body: envelope([
        { id: "doc-1", signature_reqs: [{ id: "sig-old", status: "FAILED" }] },
      ]),
    }));
    const { documentService } = await import("@/lib/services/document.service");
    await expect(documentService.retrySignature("sig-old")).rejects.toThrow(/jenis tanda tangan/);
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });
});

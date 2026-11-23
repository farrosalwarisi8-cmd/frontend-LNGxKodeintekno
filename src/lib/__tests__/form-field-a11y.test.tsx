import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Input } from "../../../components/ui/input";
import { NativeSelect } from "../../../components/ui/native-select";

/**
 * Asosiasi error field: `aria-invalid` saja tidak cukup — pesan error harus
 * terhubung lewat `aria-describedby` ke elemen yang benar-benar ada, supaya
 * screen reader membacakan alasannya saat field difokuskan.
 */
describe("asosiasi error field (aria-describedby)", () => {
  it("Input: error terhubung ke id pesan error", () => {
    const html = renderToStaticMarkup(
      <Input label="Nama Lengkap" value="" onChange={() => {}} error="Nama lengkap wajib diisi." />
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="Nama Lengkap-error"');
    expect(html).toContain('id="Nama Lengkap-error"');
    expect(html).toContain("Nama lengkap wajib diisi.");
  });

  it("NativeSelect: error terhubung ke id pesan error", () => {
    const html = renderToStaticMarkup(
      <NativeSelect
        label="Site/Office"
        value=""
        onChange={() => {}}
        error="Site wajib dipilih."
        options={[{ value: "s1", label: "HQ" }]}
      />
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="Site/Office-error"');
    expect(html).toContain('id="Site/Office-error"');
    expect(html).toContain("Site wajib dipilih.");
  });

  it("tanpa error: tidak menandai aria-invalid maupun describedby palsu", () => {
    const html = renderToStaticMarkup(
      <NativeSelect label="Job Task" value="j1" onChange={() => {}} options={[{ value: "j1", label: "Operator" }]} />
    );
    expect(html).not.toContain("aria-invalid");
    expect(html).not.toContain("aria-describedby");
  });
});

import { describe, it, expect } from "vitest";
import { PUBLIC_PATHS, isPublicPath, normalizePath } from "../../../lib/public-paths";

describe("PUBLIC_PATHS", () => {
  it("berisi hanya route publik yang disepakati", () => {
    expect([...PUBLIC_PATHS]).toEqual(["/login", "/public", "/verify"]);
  });

  it("/demo bukan route publik (keputusan Tahap 2: internal, butuh login)", () => {
    expect(PUBLIC_PATHS).not.toContain("/demo");
    expect(isPublicPath("/demo")).toBe(false);
    expect(isPublicPath("/demo/")).toBe(false);
  });
});

describe("isPublicPath()", () => {
  it("mengizinkan route publik", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/login/")).toBe(true);
    expect(isPublicPath("/public/consent/token-1")).toBe(true);
    expect(isPublicPath("/verify/abc")).toBe(true);
  });

  it("menolak route internal", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/people/new")).toBe(false);
    expect(isPublicPath("/users")).toBe(false);
    expect(isPublicPath("/mcu/review")).toBe(false);
  });

  it("normalisasi slash ganda & trailing slash", () => {
    expect(normalizePath("//login//")).toBe("/login");
    expect(normalizePath("")).toBe("/");
    expect(isPublicPath("//verify//token")).toBe(true);
  });
});

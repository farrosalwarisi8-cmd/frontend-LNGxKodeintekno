// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

/** Pathname aktif dikendalikan tes; komponen membaca lewat usePathname(). */
let pathname = "/dashboard";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

const { RouteFocus } = await import("../../../components/route-focus");

let container: HTMLDivElement;
let shell: HTMLDivElement;
let root: Root;

function mountShell(html: string) {
  // Shell dipisah dari container root: createRoot().render() mengosongkan
  // container-nya, jadi markup <main> harus hidup di elemen lain.
  shell = document.createElement("div");
  shell.innerHTML = html;
  document.body.appendChild(shell);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<RouteFocus />);
  });
}

/** Render ulang dengan pathname baru (meniru navigasi client-side). */
function navigate(to: string) {
  pathname = to;
  act(() => {
    root.render(<RouteFocus />);
  });
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  pathname = "/dashboard";
  // Frame animasi dijalankan sinkron agar efek fokus deterministik di jsdom.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  shell?.remove();
  vi.unstubAllGlobals();
});

describe("RouteFocus", () => {
  it("tidak merebut fokus pada render pertama (halaman baru dibuka)", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    mountShell('<main id="main-content" tabindex="-1"><h1>Dashboard</h1></main>');
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("memindahkan fokus ke <h1> halaman tujuan saat route berubah", () => {
    mountShell('<main id="main-content" tabindex="-1"><h1>Rekam Medis</h1></main>');
    const heading = shell.querySelector("h1") as HTMLElement;
    navigate("/medical-records");
    expect(document.activeElement).toBe(heading);
    // Fokus terprogram tanpa menambah stop Tab.
    expect(heading.getAttribute("tabindex")).toBe("-1");
  });

  it("fallback ke <main> bila halaman tujuan belum punya <h1>", () => {
    mountShell('<main id="main-content" tabindex="-1"><div>memuat…</div></main>');
    const main = shell.querySelector("main") as HTMLElement;
    navigate("/people/new");
    expect(document.activeElement).toBe(main);
  });

  it("tidak melakukan apa-apa bila <main id=main-content> tidak ada", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    mountShell("<div>tanpa shell</div>");
    navigate("/people");
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});

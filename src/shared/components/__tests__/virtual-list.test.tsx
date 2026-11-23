// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { VirtualList, getVisibleRange } from "../virtual-list";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const ITEMS = Array.from({ length: 100 }, (_, i) => `row-${i}`);

function renderList(): { container: HTMLDivElement; root: Root; region: HTMLElement } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <VirtualList
        items={ITEMS}
        itemHeight={48}
        overscan={3}
        style={{ height: 240 }}
        aria-label="Daftar uji"
        renderItem={(item, _index, style) => (
          <div style={style} data-testid={`item-${item}`}>
            {item}
          </div>
        )}
      />
    );
  });
  const region = container.querySelector('[role="region"]') as HTMLElement;
  return { container, root, region };
}

describe("getVisibleRange()", () => {
  it("jendela item bergeser saat scrollTop bertambah", () => {
    expect(getVisibleRange({ scrollTop: 0, containerHeight: 240, itemHeight: 48, itemCount: 100 })).toEqual({
      start: 0,
      end: 11,
    });
    expect(
      getVisibleRange({ scrollTop: 480, containerHeight: 240, itemHeight: 48, itemCount: 100 }).start
    ).toBeGreaterThan(0);
  });

  it("tidak melewati batas daftar", () => {
    const { end } = getVisibleRange({
      scrollTop: 99999,
      containerHeight: 240,
      itemHeight: 48,
      itemCount: 5,
    });
    expect(end).toBeLessThanOrEqual(5);
  });
});

describe("VirtualList", () => {
  let rendered: ReturnType<typeof renderList> | null = null;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = "";
  });

  afterEach(() => {
    if (rendered) {
      act(() => rendered!.root.unmount());
      rendered.container.remove();
      rendered = null;
    }
    document.body.innerHTML = "";
  });

  it("render awal menampilkan sebagian item saja", () => {
    rendered = renderList();
    expect(rendered.region).toBeTruthy();
    expect(document.querySelector('[data-testid="item-row-0"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="item-row-99"]')).toBeNull();
  });

  it("scroll tidak melempar error dan menggeser jendela item", async () => {
    rendered = renderList();
    const { region } = rendered;

    await act(async () => {
      // Simulasi browser: scrollTop berubah lalu event scroll dikirim.
      Object.defineProperty(region, "scrollTop", { value: 480, configurable: true });
      region.dispatchEvent(new Event("scroll", { bubbles: true }));
      // Tunggu satu frame agar rAF dieksekusi.
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(document.querySelector('[data-testid="item-row-0"]')).toBeNull();
    expect(document.querySelector('[data-testid="item-row-10"]')).toBeTruthy();
  });
});

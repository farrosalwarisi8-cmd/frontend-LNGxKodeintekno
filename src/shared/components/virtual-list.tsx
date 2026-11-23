"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/**
 * Virtual scroll ringan untuk daftar panjang (pekerja, audit log, dll.).
 *
 * Hanya merender item yang masuk layar (plus overscan) untuk menjaga
 * render tetap ringan di HP menengah. Item ditempatkan absolut di dalam
 * kontainer scroll, sehingga DOM tidak tumbuh seiring jumlah data.
 *
 * `renderItem` menerima `(item, index, style)` — `style` HARUS disebarkan
 * ke elemen akun item agar posisi/ukuran virtualisasi berlaku.
 */
interface VirtualListProps<Item> {
  items: Item[];
  itemHeight?: number; // px, default 48
  overscan?: number; // jumlah item tambahan di luar layar, default 3
  renderItem: (item: Item, index: number, style: CSSProperties) => ReactNode;
  className?: string;
  style?: CSSProperties; // diteruskan ke kontainer scroll (mis. maxHeight)
  "aria-label"?: string;
}

/**
 * Hitung rentang item yang perlu dirender.
 *
 * Fungsi murni supaya batas jendela bisa diuji tanpa DOM; komponen memakai
 * fungsi yang sama sehingga test tidak menguji logika yang berbeda.
 */
export function getVisibleRange({
  scrollTop,
  containerHeight,
  itemHeight,
  itemCount,
  overscan = 3,
}: {
  scrollTop: number;
  containerHeight: number;
  itemHeight: number;
  itemCount: number;
  overscan?: number;
}): { start: number; end: number } {
  if (itemCount <= 0 || itemHeight <= 0) return { start: 0, end: 0 };
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount = Math.ceil(containerHeight / itemHeight) + 2 * overscan;
  const end = Math.min(itemCount, start + Math.max(visibleCount, 1));
  return { start, end };
}

export function VirtualList<Item>({
  items,
  itemHeight = 48,
  overscan = 3,
  renderItem,
  className,
  style,
  "aria-label": ariaLabel,
}: VirtualListProps<Item>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const rafRef = useRef<number | null>(null);
  // Nilai scroll terakhir dibaca SINKRON dari event. Callback rAF tidak boleh
  // menyentuh `e.currentTarget` karena React mengosongkan event (null) setelah
  // handler selesai — itulah penyebab "Cannot read properties of null".
  const latestScrollTopRef = useRef(0);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    latestScrollTopRef.current = e.currentTarget.scrollTop;
    // Satu rAF aktif saja: frame berikutnya membaca nilai terbaru.
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setScrollTop(latestScrollTopRef.current);
    });
  }, []);

  useEffect(() => {
    const measure = () => {
      setContainerHeight(containerRef.current?.clientHeight ?? 0);
    };
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Batalkan frame yang masih tertunda saat unmount agar tidak ada setState
  // setelah komponen dilepas. Juga saat daftar berganti.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  // Reset posisi scroll DOM secara imperatif saat daftar berubah (mis. hasil
  // pencarian baru) — dilakukan lewat DOM, bukan setState di dalam effect,
  // untuk menghindari cascading render.
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = 0;
    latestScrollTopRef.current = 0;
  }, [items]);

  const totalHeight = items.length * itemHeight;
  const { start, end } = getVisibleRange({
    scrollTop,
    containerHeight,
    itemHeight,
    itemCount: items.length,
    overscan,
  });

  const containerStyle: CSSProperties = {
    position: "relative",
    overflowY: "auto",
    ...style,
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
      onScroll={onScroll}
      role="region"
      aria-label={ariaLabel}
      // Kontainer scroll harus bisa menerima fokus keyboard (WCAG 2.1.1).
      tabIndex={0}
    >
      <div style={{ height: totalHeight, position: "relative", width: "100%" }}>
        {items.slice(start, end).map((item, i) => {
          const index = start + i;
          const itemStyle: CSSProperties = {
            position: "absolute",
            top: (index - start) * itemHeight,
            left: 0,
            width: "100%",
            height: itemHeight,
            boxSizing: "border-box",
          };
          return (
            <div key={index} style={itemStyle}>
              {renderItem(item, index, itemStyle)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

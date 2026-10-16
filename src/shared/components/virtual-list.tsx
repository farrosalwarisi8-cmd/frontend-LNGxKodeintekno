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

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setScrollTop(e.currentTarget.scrollTop);
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
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Reset posisi scroll DOM secara imperatif saat daftar berubah (mis. hasil
  // pencarian baru) — dilakukan lewat DOM, bukan setState di dalam effect,
  // untuk menghindari cascading render.
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = 0;
  }, [items]);

  const totalHeight = items.length * itemHeight;
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount = Math.ceil(containerHeight / itemHeight) + 2 * overscan;
  const end = Math.min(items.length, start + visibleCount);

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
            <div key={String(index)} style={itemStyle}>
              {renderItem(item, index, itemStyle)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

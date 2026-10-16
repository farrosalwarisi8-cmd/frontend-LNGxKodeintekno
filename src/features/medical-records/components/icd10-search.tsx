"use client";

import { useId, useRef, useState } from "react";
import { Input } from "@/shared/components/design-system/input";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

export interface Icd10Option {
  id: string;
  code: string;
  description: string;
}

export interface Icd10SearchProps {
  options: Icd10Option[];
  /** Dipanggil saat dokter memilih satu diagnosis (mis. Enter atau klik). */
  onSelect: (id: string) => void;
  disabled?: boolean;
  /** Jumlah saran maksimum yang ditampilkan sekaligus. */
  max?: number;
  label?: string;
}

/**
 * Pencarian ICD-10 cepat untuk dokter.
 *
 * Mengapa bukan `<select>`: katalog ICD-10 punya ratusan entri, sehingga
 * menggulir daftar jauh lebih lambat daripada mengetik kode/nama. Kombobox ini
 * dioperasikan penuh dari keyboard:
 *   - ketik untuk menyaring (kode maupun deskripsi),
 *   - ↓/↑ memindahkan sorotan, Enter memilih,
 *   - Escape menutup & membersihkan.
 *
 * Diimplementasikan mengikuti pola combobox WAI-ARIA (`role="combobox"` +
 * `role="listbox"`) sehingga tetap terbaca pembaca layar dan lolos audit axe.
 */
export function Icd10Search({
  options,
  onSelect,
  disabled = false,
  max = 8,
  label = "Cari diagnosis ICD-10",
}: Icd10SearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? options
        .filter(
          (o) =>
            o.code.toLowerCase().includes(needle) ||
            o.description.toLowerCase().includes(needle)
        )
        .slice(0, max)
    : [];

  const optionId = (id: string) => `${listId}-opt-${id}`;

  const pick = (option: Icd10Option | undefined) => {
    if (!option) return;
    onSelect(option.id);
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (matches.length === 0) return;
      setOpen(true);
      setActiveIndex((prev) => {
        if (e.key === "ArrowDown") return (prev + 1) % matches.length;
        return (prev - 1 + matches.length) % matches.length;
      });
      return;
    }
    if (e.key === "Enter") {
      if (open && matches.length > 0) {
        e.preventDefault();
        pick(matches[Math.min(activeIndex, matches.length - 1)]);
      }
      return;
    }
    if (e.key === "Escape") {
      setQuery("");
      setOpen(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
          aria-hidden="true"
        />
        <Input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-expanded={open && matches.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && matches[activeIndex] ? optionId(matches[activeIndex].id) : undefined
          }
          placeholder="Ketik kode atau nama diagnosis (mis. E11 / diabetes)"
          value={query}
          disabled={disabled}
          className="pl-10"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => setOpen(false)}
        />
      </div>

      {open && needle.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Saran diagnosis ICD-10"
          className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500" role="presentation">
              Tidak ada diagnosis yang cocok.
            </li>
          ) : (
            matches.map((option, index) => (
              <li
                key={option.id}
                id={optionId(option.id)}
                role="option"
                aria-selected={index === activeIndex}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm",
                  index === activeIndex ? "bg-primary-50 text-primary-700" : "text-slate-700"
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(e) => {
                  // Jangan biarkan blur menutup daftar sebelum pilihan diproses.
                  e.preventDefault();
                  pick(option);
                }}
              >
                <span className="font-mono text-xs font-semibold">{option.code}</span>
                <span className="min-w-0 truncate">{option.description}</span>
              </li>
            ))
          )}
        </ul>
      )}
      <p className="text-xs text-slate-500">
        Ketik untuk mencari, ↑/↓ untuk memilih, Enter untuk menambahkan.
      </p>
    </div>
  );
}

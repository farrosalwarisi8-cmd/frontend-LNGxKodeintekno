"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";
import type { Employee } from "@/lib/types";

export function EmployeePicker({
  onSelect,
  placeholder = "Cari berdasarkan Employee ID, nama, atau nomor identitas…",
}: {
  onSelect: (emp: Employee) => void;
  placeholder?: string;
}) {
  const employees = useStore((s) => s.employees);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees.slice(0, 8);
    return employees
      .filter(
        (e) =>
          e.employeeId.toLowerCase().includes(q) ||
          e.fullName.toLowerCase().includes(q) ||
          e.nationalId.includes(q)
      )
      .slice(0, 8);
  }, [query, employees]);

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-md">
          {matches.length === 0 && (
            <p className="px-2 py-3 text-center text-sm text-muted-foreground">
              Tidak ditemukan
            </p>
          )}
          {matches.map((e) => (
            <button
              key={e.id}
              type="button"
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              onMouseDown={(ev) => {
                ev.preventDefault();
                onSelect(e);
                setQuery(`${e.employeeId} — ${e.fullName}`);
                setOpen(false);
              }}
            >
              <span className="font-medium">{e.employeeId}</span>
              <span className="text-muted-foreground">{e.fullName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

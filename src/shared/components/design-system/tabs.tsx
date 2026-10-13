"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export function Tabs({
  value: controlledValue,
  onValueChange,
  children,
  className,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  const [internalValue, setInternalValue] = useState("");
  const value = controlledValue ?? internalValue;
  const handleChange = (v: string) => {
    setInternalValue(v);
    onValueChange?.(v);
  };

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleChange }}>
      <div className={cn("space-y-4", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex gap-1 rounded-lg bg-slate-100 p-1", className)}>
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsTrigger must be used within <Tabs>");
  const active = ctx.value === value;
  return (
    <button
      type="button"
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-600 hover:text-slate-900",
        className
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsContent must be used within <Tabs>");
  if (ctx.value !== value) return null;
  return <div className={className}>{children}</div>;
}

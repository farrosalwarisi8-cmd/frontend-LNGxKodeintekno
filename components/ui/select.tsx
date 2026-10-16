"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { cn } from "cn";
import { ChevronDown } from "lucide-react";

export interface SelectProps {
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  value?: string | null;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  label?: string;
  error?: string;
  helper?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

function changeEvent(value: string | string[] | null): React.ChangeEvent<HTMLSelectElement> {
  return {
    target: { value: value === null ? "" : Array.isArray(value) ? value.join(",") : String(value) },
  } as unknown as React.ChangeEvent<HTMLSelectElement>;
}

function SelectTrigger({ className, children, ...props }: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex w-full items-center justify-between gap-1.5 rounded-xl border bg-white px-3.5 pr-10 text-base text-slate-900 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 data-placeholder:text-slate-400",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={<ChevronDown className="pointer-events-none size-4 text-slate-400" />}
      />
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({ className, children, ...props }: SelectPrimitive.Popup.Props) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner className="isolate z-50">
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "relative z-50 max-h-[240px] min-w-[200px] overflow-x-hidden overflow-y-auto rounded-xl border border-slate-200 bg-white text-slate-900 shadow-lg ring-1 ring-slate-200",
            className
          )}
          {...props}
        >
          <SelectPrimitive.ScrollUpArrow />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectPrimitive.ScrollDownArrow />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("block text-sm font-medium text-slate-700", className)}
      {...props}
    />
  );
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1.5 pl-3 pr-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={<span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />}
      >
        <span className="pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-slate-200", className)}
      {...props}
    />
  );
}

export function Select({
  id,
  name,
  disabled,
  required,
  value,
  onChange,
  label,
  error,
  helper,
  options,
  placeholder,
}: SelectProps) {
  const selectId = id ?? name ?? label;
  const isEmpty = value === "" || value === undefined || value === null;

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <SelectPrimitive.Root
        id={selectId}
        name={name}
        disabled={disabled}
        required={required}
        value={isEmpty ? "" : String(value)}
        onValueChange={(v) => onChange?.(changeEvent(v))}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error
            ? `${selectId}-error`
            : helper
              ? `${selectId}-helper`
              : undefined
        }
      >
        <SelectTrigger>
          <SelectPrimitive.Value className="flex-1 text-left">
            {isEmpty ? placeholder : ""}
          </SelectPrimitive.Value>
        </SelectTrigger>
        {options.length > 0 && (
          <SelectContent>
            {placeholder && (
              <SelectItem value="" disabled className="text-slate-400">
                {placeholder}
              </SelectItem>
            )}
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
              </SelectItem>
            ))}
          </SelectContent>
        )}
      </SelectPrimitive.Root>
      {error && (
        <p id={`${selectId}-error`} className="text-sm text-danger-600">
          {error}
        </p>
      )}
      {!error && helper && (
        <p id={`${selectId}-helper`} className="text-sm text-slate-500">
          {helper}
        </p>
      )}
    </div>
  );
}

export { SelectContent, SelectItem, SelectLabel, SelectSeparator, SelectTrigger };

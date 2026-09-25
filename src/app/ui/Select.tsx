"use client";

import { Check, ChevronDown } from "lucide-react";
import { PopoverPanel, TRIGGER_CLASS, usePopover } from "./Popover";

export interface SelectOption {
  value: string;
  label: string;
}
export interface SelectGroup {
  label?: string;
  options: SelectOption[];
}

export function Select({
  value,
  groups,
  onChange,
}: {
  value: string;
  groups: SelectGroup[];
  onChange: (value: string) => void;
}) {
  const { open, setOpen, ref } = usePopover();
  const current = groups.flatMap((g) => g.options).find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open} className={TRIGGER_CLASS}>
        <span className="truncate">{current?.label ?? "—"}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <PopoverPanel className="max-h-72 min-w-full overflow-y-auto">
          <ul role="listbox">
            {groups.map((g, i) => (
              <li key={g.label ?? i}>
                {g.label && (
                  <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    {g.label}
                  </div>
                )}
                {g.options.map((o) => {
                  const selected = o.value === value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        setOpen(false);
                        if (!selected) onChange(o.value);
                      }}
                      className={`flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-left text-sm ${
                        selected
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {o.label}
                      {selected && <Check className="h-4 w-4" />}
                    </button>
                  );
                })}
              </li>
            ))}
          </ul>
        </PopoverPanel>
      )}
    </div>
  );
}

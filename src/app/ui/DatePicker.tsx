"use client";

import { useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, XCircle } from "lucide-react";
import { PopoverPanel, TRIGGER_CLASS, usePopover } from "./Popover";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function parse(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? { y: +match[1], m: +match[2] - 1, d: +match[3] } : null;
}

// value/onChange usam "YYYY-MM-DD" (mesmo formato do input nativo).
export function DatePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { open, setOpen, ref } = usePopover();
  const selected = parse(value);
  const now = new Date();
  const [view, setView] = useState({ y: selected?.y ?? now.getFullYear(), m: selected?.m ?? now.getMonth() });

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const today = iso(now.getFullYear(), now.getMonth(), now.getDate());
  const shift = (delta: number) =>
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const label = selected ? `${pad(selected.d)}/${pad(selected.m + 1)}/${selected.y}` : "dd/mm/aaaa";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          if (!open && selected) setView({ y: selected.y, m: selected.m });
          setOpen(!open);
        }}
        className={TRIGGER_CLASS}
      >
        <span className={selected ? "" : "text-zinc-400"}>{label}</span>
        <Calendar className="h-4 w-4 shrink-0 text-zinc-400" />
      </button>
      {selected && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpar data"
          className="absolute right-8 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          <XCircle className="h-4 w-4" />
        </button>
      )}
      {open && (
        <PopoverPanel className="w-64 p-3">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shift(-1)} aria-label="Mês anterior" className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold capitalize text-zinc-900 dark:text-zinc-50">
              {MONTHS[view.m]} de {view.y}
            </span>
            <button type="button" onClick={() => shift(1)} aria-label="Próximo mês" className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
            {WEEKDAYS.map((w, i) => (
              <div key={i} className="py-1 font-medium text-zinc-400">{w}</div>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <div key={i} />;
              const v = iso(view.y, view.m, d);
              const isSel = v === value;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(v)}
                  className={`rounded-lg py-1.5 text-sm ${
                    isSel
                      ? "bg-emerald-600 font-semibold text-white"
                      : v === today
                        ? "font-semibold text-emerald-600 ring-1 ring-emerald-500/40 hover:bg-zinc-100 dark:text-emerald-400 dark:hover:bg-zinc-800"
                        : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between border-t border-zinc-100 pt-2 text-xs dark:border-zinc-800">
            <button type="button" onClick={() => pick("")} className="rounded px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Limpar</button>
            <button type="button" onClick={() => pick(today)} className="rounded px-2 py-1 font-medium text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40">Hoje</button>
          </div>
        </PopoverPanel>
      )}
    </div>
  );
}
